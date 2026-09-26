import asyncio
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import gemini_quota_guard as guard


class ProviderError(Exception):
    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code


class GeminiQuotaGuardTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_path_patch = patch.object(guard, "_STATE_PATH", Path(self.temp_dir.name) / "circuit.json")
        self.state_path_patch.start()
        self.block_patch = patch.object(guard, "_BLOCKED_UNTIL", None)
        self.block_patch.start()

    def tearDown(self) -> None:
        self.block_patch.stop()
        self.state_path_patch.stop()
        self.temp_dir.cleanup()

    def test_classifies_daily_quota_but_not_per_minute_or_service_unavailable(self) -> None:
        self.assertTrue(guard._is_daily_quota_error(ProviderError(429, "GenerateRequestsPerDayPerModel")))
        self.assertFalse(guard._is_daily_quota_error(ProviderError(429, "RequestsPerMinutePerModel")))
        self.assertFalse(guard._is_daily_quota_error(ProviderError(503, "service unavailable")))

    def test_daily_quota_trips_persistent_breaker_before_following_provider_call(self) -> None:
        original = AsyncMock(side_effect=ProviderError(429, "GenerateRequestsPerDayPerModel-FreeTier"))
        with patch.object(guard, "_ORIGINAL_GENERATE_CONTENT", original):
            with self.assertRaises(ProviderError):
                asyncio.run(guard._guarded_generate_content(object(), model="test"))
            guard._BLOCKED_UNTIL = None  # Simulate a Hindsight process restart.
            with self.assertRaises(guard.DailyQuotaCircuitOpen):
                asyncio.run(guard._guarded_generate_content(object(), model="test"))
        original.assert_awaited_once()
        self.assertTrue(guard._STATE_PATH.exists())

    def test_service_unavailable_does_not_trip_daily_breaker(self) -> None:
        original = AsyncMock(side_effect=ProviderError(503, "temporarily unavailable"))
        with patch.object(guard, "_ORIGINAL_GENERATE_CONTENT", original):
            with self.assertRaises(ProviderError):
                asyncio.run(guard._guarded_generate_content(object(), model="test"))
        original.assert_awaited_once()
        self.assertFalse(guard._STATE_PATH.exists())

    def test_reset_is_next_midnight_pacific_in_utc(self) -> None:
        now = datetime(2026, 9, 26, 19, 0, tzinfo=timezone.utc)
        reset = guard._next_reset(now)
        self.assertEqual(reset, datetime(2026, 9, 27, 7, 0, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
