import type { EverythingFileEvent } from "./everything-journal-adapter.js";

export interface ChangeSet {
  projectRoot: string;
  startedAt: string;
  endedAt: string;
  events: EverythingFileEvent[];
}

interface PendingBurst {
  projectRoot: string;
  firstSeenAt: number;
  lastSeenAt: number;
  events: EverythingFileEvent[];
}

function keyFor(event: EverythingFileEvent): string {
  return (event.oldPath ?? event.path).toLowerCase();
}

function coalesce(events: readonly EverythingFileEvent[]): EverythingFileEvent[] {
  const byPath = new Map<string, EverythingFileEvent>();
  for (const event of events) {
    const key = keyFor(event);
    const previous = byPath.get(key);
    if (!previous) {
      byPath.set(key, event);
      continue;
    }
    if (previous.action === "CREATE" && event.action === "DELETE") {
      byPath.delete(key);
      continue;
    }
    byPath.set(key, {
      ...event,
      eventId: `${previous.eventId},${event.eventId}`,
      action: previous.action === "CREATE" ? "CREATE" : event.action,
      oldPath: previous.oldPath ?? event.oldPath,
      newPath: event.newPath ?? previous.newPath,
      changedAt: previous.changedAt,
    });
  }
  return [...byPath.values()];
}

/** Groups rapid Journal bursts by project. It never writes runtime state. */
export class BurstAggregator {
  private readonly pending = new Map<string, PendingBurst>();

  constructor(private readonly windowMs = 4_000) {
    if (!Number.isFinite(windowMs) || windowMs < 0) throw new Error("everything_burst_window_invalid");
  }

  push(events: readonly EverythingFileEvent[], now = Date.now()): void {
    for (const event of events) {
      const key = event.projectRoot.toLowerCase();
      const burst = this.pending.get(key);
      if (burst) {
        burst.lastSeenAt = now;
        burst.events.push(event);
      } else {
        this.pending.set(key, { projectRoot: event.projectRoot, firstSeenAt: now, lastSeenAt: now, events: [event] });
      }
    }
  }

  flushReady(now = Date.now()): ChangeSet[] {
    const ready: ChangeSet[] = [];
    for (const [key, burst] of this.pending) {
      if (now - burst.lastSeenAt < this.windowMs) continue;
      this.pending.delete(key);
      const events = coalesce(burst.events);
      if (events.length === 0) continue;
      ready.push({
        projectRoot: burst.projectRoot,
        startedAt: new Date(burst.firstSeenAt).toISOString(),
        endedAt: new Date(burst.lastSeenAt).toISOString(),
        events,
      });
    }
    return ready;
  }

  pendingCount(): number {
    return this.pending.size;
  }
}
