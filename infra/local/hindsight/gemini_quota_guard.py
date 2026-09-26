"""Persistently suppress Gemini calls after a confirmed daily quota response."""

from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, time, timedelta, timezone
from functools import wraps
from pathlib import Path
from zoneinfo import ZoneInfo

from google.genai.models import AsyncModels

_PACIFIC = ZoneInfo("America/Los_Angeles")
_STATE_PATH = Path(
    os.environ.get("LOCALAPPDATA", str(Path.home() / ".local" / "share"))
) / "Nexus" / "Hindsight" / "gemini-rpd-circuit.json"
_LOCK = threading.Lock()
_BLOCKED_UNTIL: datetime | None = None
_ORIGINAL_GENERATE_CONTENT = AsyncModels.generate_content


class DailyQuotaCircuitOpen(RuntimeError):
    """Raised locally while the daily Gemini request quota remains exhausted."""


def _next_reset(now: datetime | None = None) -> datetime:
    local_now = (now or datetime.now(timezone.utc)).astimezone(_PACIFIC)
    next_day = local_now.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, tzinfo=_PACIFIC).astimezone(timezone.utc)


def _is_daily_quota_error(error: Exception) -> bool:
    if getattr(error, "code", None) != 429:
        return False
    message = re.sub(r"[^a-z0-9]", "", str(error).lower())
    return any(
        marker in message
        for marker in ("generaterequestsperday", "requestsperday", "perday", "dailyquota")
    )


def _load_blocked_until(now: datetime | None = None) -> datetime | None:
    global _BLOCKED_UNTIL
    current = now or datetime.now(timezone.utc)
    with _LOCK:
        if _BLOCKED_UNTIL is None and _STATE_PATH.exists():
            try:
                record = json.loads(_STATE_PATH.read_text(encoding="utf-8"))
                _BLOCKED_UNTIL = datetime.fromisoformat(record["blocked_until"])
                if _BLOCKED_UNTIL.tzinfo is None:
                    _BLOCKED_UNTIL = _BLOCKED_UNTIL.replace(tzinfo=timezone.utc)
            except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
                # A corrupt state file fails closed for the remainder of this Pacific day.
                _BLOCKED_UNTIL = _next_reset(current)

        if _BLOCKED_UNTIL is not None and current >= _BLOCKED_UNTIL:
            _BLOCKED_UNTIL = None
            try:
                _STATE_PATH.unlink(missing_ok=True)
            except OSError:
                pass
        return _BLOCKED_UNTIL


def _trip_daily_quota_circuit(now: datetime | None = None) -> datetime:
    global _BLOCKED_UNTIL
    blocked_until = _next_reset(now)
    record = {"blocked_until": blocked_until.isoformat(), "reason": "gemini_daily_request_quota"}
    with _LOCK:
        _BLOCKED_UNTIL = blocked_until
        try:
            _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            temporary = _STATE_PATH.with_suffix(f".tmp-{os.getpid()}")
            temporary.write_text(json.dumps(record), encoding="utf-8")
            temporary.replace(_STATE_PATH)
        except OSError:
            # Keep the in-memory breaker even if persistence is unavailable.
            pass
    return blocked_until


@wraps(_ORIGINAL_GENERATE_CONTENT)
async def _guarded_generate_content(self, *args, **kwargs):
    blocked_until = _load_blocked_until()
    if blocked_until is not None:
        raise DailyQuotaCircuitOpen(
            "Gemini daily quota circuit is open; no provider request sent. "
            f"Retry after {blocked_until.isoformat()}."
        )

    try:
        return await _ORIGINAL_GENERATE_CONTENT(self, *args, **kwargs)
    except Exception as error:
        if _is_daily_quota_error(error):
            _trip_daily_quota_circuit()
        raise


def install() -> None:
    """Install a guarded Gemini SDK method for the Hindsight process."""
    if AsyncModels.generate_content is not _guarded_generate_content:
        AsyncModels.generate_content = _guarded_generate_content


install()
