import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeCommand, RuntimeCommandResult } from "@nexus-brain/contracts/runtime";
import { SafeCommandRunner } from "../src/bridge/command-runner.js";
import { BurstAggregator } from "../src/everything/burst-aggregator.js";
import { EverythingJournalAdapter, type EverythingFileEvent } from "../src/everything/everything-journal-adapter.js";

const temporaryRoots: string[] = [];

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "nexus-everything-"));
  temporaryRoots.push(base);
  const root = join(base, "project");
  const statePath = join(base, "state", "cursor.json");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(root, { recursive: true });
  return { base, root, statePath };
}

function result(command: RuntimeCommand, stdout: string, exitCode: number | null = 0): RuntimeCommandResult {
  return { commandId: command.id, exitCode, signal: null, stdout, stderr: "", truncated: false, timedOut: false, durationMs: 1 };
}

function runnerWith(run: (command: RuntimeCommand) => RuntimeCommandResult | Promise<RuntimeCommandResult>): SafeCommandRunner {
  return { run: vi.fn(run) } as unknown as SafeCommandRunner;
}

const correlation = { organizationId: "test", traceId: "trace" };

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("EverythingJournalAdapter", () => {
  it("baselines a new cursor without replaying prior filesystem history", async () => {
    const paths = await fixture();
    const runner = runnerWith((command) => {
      if (command.args[0] === "-get-everything-version") return result(command, "1.5.0.1423b");
      return result(command, "17 900");
    });
    const adapter = new EverythingJournalAdapter({ projectRoots: [paths.root], statePath: paths.statePath, commandRunner: runner });

    const response = await adapter.poll(correlation);

    expect(response).toMatchObject({ source: "everything-journal", health: { status: "healthy" }, position: { journalId: "17", changeId: 900 }, events: [] });
    expect(JSON.parse(await readFile(paths.statePath, "utf8"))).toEqual({ version: 1, position: { journalId: "17", changeId: 900 } });
    expect(runner.run).toHaveBeenCalledTimes(2);
  });

  it("reads bounded changes, preserves root scope, and excludes ignored and outside paths", async () => {
    const paths = await fixture();
    let positionReads = 0;
    const runner = runnerWith((command) => {
      if (command.args[0] === "-get-everything-version") return result(command, "1.5.0.1423b");
      if (command.args[0] === "-get-journal-pos") {
        positionReads += 1;
        return result(command, positionReads === 1 ? "17 100" : "17 104");
      }
      return result(command, JSON.stringify([
        { "Journal ID": 17, "Change ID": 101, Action: "File Create", "Date Changed": "2026-09-27 10:00:00", Filename: join(paths.root, "src", "main.ts") },
        { "Journal ID": 17, "Change ID": 102, Action: "File Modify", "Date Changed": "2026-09-27 10:00:01", Filename: join(paths.root, "node_modules", "pkg", "index.js") },
        { "Journal ID": 17, "Change ID": 103, Action: "File Delete", "Date Changed": "2026-09-27 10:00:02", Filename: join(paths.base, "outside.txt") },
        { "Journal ID": 17, "Change ID": 104, Action: "File Rename", "Date Changed": "2026-09-27 10:00:03", Filename: join(paths.root, "src", "old.ts"), "New Filename": join(paths.root, "src", "new.ts") },
      ]));
    });
    const adapter = new EverythingJournalAdapter({ projectRoots: [paths.root], statePath: paths.statePath, commandRunner: runner });

    await adapter.poll(correlation);
    const response = await adapter.poll(correlation);

    expect(response.events).toHaveLength(2);
    expect(response.events.map(({ action }) => action)).toEqual(["CREATE", "RENAME"]);
    expect(response.events[0]?.path).toContain("main.ts");
    expect(response.events[1]).toMatchObject({ oldPath: expect.stringContaining("old.ts"), newPath: expect.stringContaining("new.ts") });
    expect(response.position?.changeId).toBe(104);
  });

  it("preserves 64-bit Everything journal IDs from JSON without JavaScript rounding", async () => {
    const paths = await fixture();
    const journalId = "134349843413634424";
    let positionReads = 0;
    const filename = join(paths.root, "src", "large-journal-id.ts");
    const record = `{"journal_id":${journalId},"change_id":6,"action":"File Create","filename":${JSON.stringify(filename)}}`;
    const runner = runnerWith((command) => {
      if (command.args[0] === "-get-everything-version") return result(command, "1.5.0.1423b");
      if (command.args[0] === "-get-journal-pos") {
        positionReads += 1;
        return result(command, `${journalId} ${positionReads === 1 ? 5 : 7}`);
      }
      return result(command, `[${record}]`);
    });
    const adapter = new EverythingJournalAdapter({ projectRoots: [paths.root], statePath: paths.statePath, commandRunner: runner });

    await adapter.poll(correlation);
    const response = await adapter.poll(correlation);

    expect(response.events).toHaveLength(1);
    expect(response.events[0]).toMatchObject({ eventId: `${journalId}:6`, journalId, changeId: 6, action: "CREATE" });
  });

  it("re-baselines rather than replaying across a changed journal ID", async () => {
    const paths = await fixture();
    let positionReads = 0;
    const runner = runnerWith((command) => {
      if (command.args[0] === "-get-everything-version") return result(command, "1.5.0.1423b");
      positionReads += 1;
      return result(command, positionReads === 1 ? "17 100" : "18 1");
    });
    const adapter = new EverythingJournalAdapter({ projectRoots: [paths.root], statePath: paths.statePath, commandRunner: runner });

    await adapter.poll(correlation);
    const response = await adapter.poll(correlation);

    expect(response).toMatchObject({ cursorReset: true, position: { journalId: "18", changeId: 1 }, events: [] });
    expect(runner.run).toHaveBeenCalledTimes(4);
  });

  it("uses read-only Git snapshots when Everything 1.5 IPC is unavailable", async () => {
    const paths = await fixture();
    const runner = runnerWith((command) => {
      if (command.executable === "es.exe") return result(command, "1.4.1.1032");
      return result(command, command.args[0] === "status" ? "## feature/test" : "");
    });
    const adapter = new EverythingJournalAdapter({ projectRoots: [paths.root], statePath: paths.statePath, commandRunner: runner });

    const response = await adapter.poll(correlation);

    expect(response).toMatchObject({
      source: "git-fallback",
      health: { status: "degraded", journalSupported: false, reason: "everything_15_required" },
      events: [],
    });
    expect(response.gitFallback).toEqual([{ projectRoot: paths.root.toLowerCase(), status: "## feature/test", diff: "" }]);
  });

  it("does not allow cursor state inside a project root", async () => {
    const paths = await fixture();
    expect(() => new EverythingJournalAdapter({
      projectRoots: [paths.root], statePath: join(paths.root, ".nexus-state", "cursor.json"), commandRunner: runnerWith(() => { throw new Error("unused"); }),
    })).toThrow("everything_cursor_must_be_outside_project_roots");
  });
});

describe("BurstAggregator", () => {
  const event = (input: Partial<EverythingFileEvent> & Pick<EverythingFileEvent, "eventId" | "action" | "path">): EverythingFileEvent => ({
    eventId: input.eventId, journalId: "1", changeId: 1, action: input.action, path: input.path,
    oldPath: input.oldPath ?? null, newPath: input.newPath ?? null, changedAt: "2026-09-27T10:00:00.000Z",
    projectRoot: input.projectRoot ?? "C:\\Projects\\Nexus",
  });

  it("groups file bursts by project and coalesces repeated modifications", () => {
    const aggregator = new BurstAggregator(4_000);
    aggregator.push([event({ eventId: "1:1", action: "CREATE", path: "C:\\Projects\\Nexus\\src\\x.ts" })], 1_000);
    aggregator.push([event({ eventId: "1:2", action: "MODIFY", path: "C:\\Projects\\Nexus\\src\\x.ts" })], 2_000);

    expect(aggregator.flushReady(5_999)).toEqual([]);
    const changes = aggregator.flushReady(6_000);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.events).toHaveLength(1);
    expect(changes[0]?.events[0]).toMatchObject({ action: "CREATE", eventId: "1:1,1:2" });
  });

  it("drops a create-delete pair that leaves no file after the burst", () => {
    const aggregator = new BurstAggregator(0);
    aggregator.push([
      event({ eventId: "1:1", action: "CREATE", path: "C:\\Projects\\Nexus\\new.txt" }),
      event({ eventId: "1:2", action: "DELETE", path: "C:\\Projects\\Nexus\\new.txt" }),
    ], 1_000);
    expect(aggregator.flushReady(1_000)).toEqual([]);
  });
});
