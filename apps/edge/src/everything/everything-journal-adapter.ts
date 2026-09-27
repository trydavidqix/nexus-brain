import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, win32 } from "node:path";
import type { RuntimeCommand, RuntimeCorrelation } from "@nexus-brain/contracts/runtime";
import { GitReadAdapter } from "../git/git-read-adapter.js";
import { SafeCommandRunner } from "../bridge/command-runner.js";

export type EverythingAction = "CREATE" | "MODIFY" | "DELETE" | "MOVE" | "RENAME";

export interface JournalPosition {
  journalId: string;
  changeId: number;
}

export interface EverythingFileEvent {
  eventId: string;
  journalId: string;
  changeId: number;
  action: EverythingAction;
  path: string;
  oldPath: string | null;
  newPath: string | null;
  changedAt: string;
  projectRoot: string;
}

export interface GitFallbackSnapshot {
  projectRoot: string;
  status: string;
  diff: string;
}

export interface EverythingHealth {
  status: "healthy" | "degraded" | "unavailable";
  everythingVersion: string | null;
  journalSupported: boolean;
  gitFallbackAvailable: boolean;
  reason: "ready" | "everything_unavailable" | "everything_15_required" | "journal_unavailable";
}

export interface EverythingPollResult {
  source: "everything-journal" | "git-fallback";
  health: EverythingHealth;
  position: JournalPosition | null;
  cursorReset: boolean;
  events: EverythingFileEvent[];
  gitFallback: GitFallbackSnapshot[];
}

export interface EverythingJournalAdapterOptions {
  projectRoots: readonly string[];
  statePath: string;
  commandRunner: SafeCommandRunner;
  executable?: string;
  instance?: string;
  ignorePatterns?: readonly string[];
  maxEventsPerPoll?: number;
  now?: () => Date;
}

interface StoredCursor {
  version: 1;
  position: JournalPosition;
}

interface JournalRecord {
  journalId: string;
  changeId: number;
  action: string;
  filename: string;
  newFilename?: string;
  changedAt?: string;
}

const DEFAULT_IGNORES = [
  "**/.git", "**/.git/**", "**/node_modules", "**/node_modules/**", "**/.next", "**/.next/**",
  "**/dist", "**/dist/**", "**/build", "**/build/**", "**/coverage", "**/coverage/**",
  "**/.cache", "**/.cache/**", "**/tmp", "**/tmp/**", "**/*.log", "**/*.tmp",
];
const MAX_OUTPUT_BYTES = 1_048_576;
const VERSION_15 = /^1\.([5-9]|[1-9]\d)\./;

function isWindowsPath(value: string): boolean {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\");
}

function normalizedPath(value: string): string {
  return isWindowsPath(value) ? win32.normalize(value) : resolve(value);
}

function canonicalPath(value: string): string {
  return normalizedPath(value).toLowerCase();
}

function relativePath(root: string, target: string): string {
  const normalizedRoot = canonicalPath(root);
  const normalizedTarget = canonicalPath(target);
  return isWindowsPath(normalizedRoot) && isWindowsPath(normalizedTarget)
    ? win32.relative(normalizedRoot, normalizedTarget)
    : relative(normalizedRoot, normalizedTarget);
}

function isWithin(root: string, target: string): boolean {
  const rel = relativePath(root, target);
  const separator = isWindowsPath(root) ? win32.sep : process.platform === "win32" ? win32.sep : "/";
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${separator}`) && !(isWindowsPath(root) ? win32.isAbsolute(rel) : isAbsolute(rel)));
}

function matchesSegment(glob: string, segment: string): boolean {
  let previous = Array<boolean>(segment.length + 1).fill(false);
  previous[0] = true;
  for (const token of glob.toLowerCase()) {
    const current = Array<boolean>(segment.length + 1).fill(false);
    if (token === "*") current[0] = previous[0]!;
    for (let index = 1; index <= segment.length; index += 1) {
      current[index] = token === "*"
        ? previous[index]! || current[index - 1]!
        : previous[index - 1]! && (token === "?" || token === segment[index - 1]!.toLowerCase());
    }
    previous = current;
  }
  return previous[segment.length]!;
}

function matchesGlob(glob: readonly string[], path: string): boolean {
  const segments = path.split("/");
  let previous = Array<boolean>(segments.length + 1).fill(false);
  previous[0] = true;
  for (const token of glob) {
    const current = Array<boolean>(segments.length + 1).fill(false);
    if (token === "**") current[0] = previous[0]!;
    for (let index = 1; index <= segments.length; index += 1) {
      current[index] = token === "**"
        ? previous[index]! || current[index - 1]!
        : previous[index - 1]! && matchesSegment(token, segments[index - 1]!);
    }
    previous = current;
  }
  return previous[segments.length]!;
}

function parsePosition(stdout: string): JournalPosition {
  const values = stdout.match(/\d+/g) ?? [];
  if (values.length < 2) throw new Error("everything_journal_position_invalid");
  const changeId = Number(values[1]);
  if (!Number.isSafeInteger(changeId) || changeId < 0) throw new Error("everything_journal_position_invalid");
  return { journalId: values[0]!, changeId };
}

function normalizedRecord(value: unknown): JournalRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("everything_journal_record_invalid");
  const record = value as Record<string, unknown>;
  const fields = new Map(Object.entries(record).map(([key, field]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), field]));
  const get = (...names: string[]) => names.map((name) => fields.get(name)).find((field) => field !== undefined);
  const journalId = get("journalid", "journal");
  const changeId = get("changeid", "change");
  const action = get("action", "journalaction");
  const filename = get("filename", "path", "name");
  const newFilename = get("newfilename", "newpath", "newname");
  const changedAt = get("datechanged", "changedat", "date", "timestamp");
  if (journalId === undefined || changeId === undefined || action === undefined || typeof filename !== "string") {
    throw new Error("everything_journal_record_invalid");
  }
  const parsedChangeId = Number(String(changeId).replace(/^#/, ""));
  if (!Number.isSafeInteger(parsedChangeId) || parsedChangeId < 0) throw new Error("everything_journal_record_invalid");
  return {
    journalId: String(journalId).replace(/^#/, ""),
    changeId: parsedChangeId,
    action: String(action),
    filename,
    ...(typeof newFilename === "string" && newFilename ? { newFilename } : {}),
    ...(typeof changedAt === "string" && changedAt ? { changedAt } : {}),
  };
}

function preserveLargeJournalIds(value: string): string {
  return value.replace(/("journal[_ -]?id"\s*:\s*)(\d+)/gi, "$1\"$2\"");
}

function parseJournalOutput(stdout: string): JournalRecord[] {
  const text = stdout.trim();
  if (!text) return [];
  const safeText = preserveLargeJournalIds(text);
  try {
    const parsed: unknown = JSON.parse(safeText);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map(normalizedRecord);
  } catch (error) {
    if (error instanceof Error && error.message === "everything_journal_record_invalid") throw error;
    const lines = safeText.split(/\r?\n/).filter(Boolean);
    return lines.map((line) => normalizedRecord(JSON.parse(line) as unknown));
  }
}

function mapAction(action: string): EverythingAction | null {
  const value = action.toLowerCase().replace(/[ _-]+/g, "");
  if (value.includes("create")) return "CREATE";
  if (value.includes("delete")) return "DELETE";
  if (value.includes("rename")) return "RENAME";
  if (value.includes("move")) return "MOVE";
  if (value.includes("modify")) return "MODIFY";
  return null;
}

export class EverythingJournalAdapter {
  private readonly executable: string;
  private readonly instance?: string;
  private readonly roots: readonly string[];
  private readonly ignores: readonly (readonly string[])[];
  private readonly now: () => Date;
  private readonly maxEvents: number;
  private polling = false;

  constructor(private readonly options: EverythingJournalAdapterOptions) {
    if (options.projectRoots.length === 0) throw new Error("everything_project_roots_required");
    this.roots = options.projectRoots.map(normalizedPath);
    this.executable = options.executable ?? "es.exe";
    this.instance = options.instance;
    this.ignores = [...DEFAULT_IGNORES, ...(options.ignorePatterns ?? [])]
      .map((glob) => glob.replace(/\\/g, "/").toLowerCase().split("/"));
    this.now = options.now ?? (() => new Date());
    this.maxEvents = Math.max(1, Math.min(Math.trunc(options.maxEventsPerPoll ?? 500), 5000));
    const statePath = resolve(options.statePath);
    if (this.roots.some((root) => isWithin(root, statePath))) {
      throw new Error("everything_cursor_must_be_outside_project_roots");
    }
  }

  async health(correlation: RuntimeCorrelation): Promise<EverythingHealth> {
    return (await this.probe(correlation)).health;
  }

  private async probe(correlation: RuntimeCorrelation): Promise<{ health: EverythingHealth; position: JournalPosition | null }> {
    let everythingVersion: string;
    try {
      const version = await this.run(correlation, ["-get-everything-version"]);
      everythingVersion = version.stdout.trim();
    } catch {
      return {
        health: { status: "unavailable", everythingVersion: null, journalSupported: false, gitFallbackAvailable: true, reason: "everything_unavailable" },
        position: null,
      };
    }
    if (!VERSION_15.test(everythingVersion)) {
      return {
        health: { status: "degraded", everythingVersion, journalSupported: false, gitFallbackAvailable: true, reason: "everything_15_required" },
        position: null,
      };
    }
    try {
      const result = await this.run(correlation, ["-get-journal-pos"]);
      const position = parsePosition(result.stdout);
      return {
        health: { status: "healthy", everythingVersion, journalSupported: true, gitFallbackAvailable: true, reason: "ready" },
        position,
      };
    } catch {
      return {
        health: { status: "degraded", everythingVersion, journalSupported: false, gitFallbackAvailable: true, reason: "journal_unavailable" },
        position: null,
      };
    }
  }

  async poll(correlation: RuntimeCorrelation): Promise<EverythingPollResult> {
    if (this.polling) throw new Error("everything_poll_already_running");
    this.polling = true;
    try {
      const probe = await this.probe(correlation);
      const health = probe.health;
      if (health.status !== "healthy") {
        return {
          source: "git-fallback", health, position: null, cursorReset: false, events: [],
          gitFallback: await this.readGitFallback(correlation),
        };
      }
      const current = probe.position!;
      const stored = await this.readCursor();
      if (!stored) {
        await this.writeCursor(current);
        return { source: "everything-journal", health, position: current, cursorReset: false, events: [], gitFallback: [] };
      }
      if (stored.position.journalId !== current.journalId) {
        await this.writeCursor(current);
        return { source: "everything-journal", health, position: current, cursorReset: true, events: [], gitFallback: [] };
      }
      if (current.changeId <= stored.position.changeId) {
        return { source: "everything-journal", health, position: stored.position, cursorReset: false, events: [], gitFallback: [] };
      }

      const result = await this.run(correlation, [
        "-journal", "-from-journal-pos", stored.position.journalId, String(stored.position.changeId),
        "-to-journal-pos", current.journalId, String(current.changeId), "-json", "-max-results", String(this.maxEvents),
      ]);
      if (result.truncated || result.timedOut) throw new Error("everything_journal_output_incomplete");
      const records = parseJournalOutput(result.stdout);
      const events = records.flatMap((record) => {
        if (record.journalId !== current.journalId) return [];
        const event = this.toEvent(record);
        return event ? [event] : [];
      });
      const nextPosition = records.length >= this.maxEvents && records.length > 0
        ? { journalId: current.journalId, changeId: records[records.length - 1]!.changeId + 1 }
        : current;
      await this.writeCursor(nextPosition);
      return { source: "everything-journal", health, position: nextPosition, cursorReset: false, events, gitFallback: [] };
    } finally {
      this.polling = false;
    }
  }

  private toEvent(record: JournalRecord): EverythingFileEvent | null {
    const action = mapAction(record.action);
    if (!action) return null;
    const filename = canonicalPath(record.filename);
    const newFilename = record.newFilename ? canonicalPath(record.newFilename) : null;
    const root = this.roots.find((candidate) => isWithin(candidate, filename) || (newFilename !== null && isWithin(candidate, newFilename)));
    if (!root) return null;
    const oldPath = isWithin(root, filename) && !this.isIgnored(filename, root) ? normalizedPath(record.filename) : null;
    const newPath = newFilename && isWithin(root, newFilename) && !this.isIgnored(newFilename, root)
      ? normalizedPath(record.newFilename!) : null;
    if (!oldPath && !newPath) return null;
    const path = newPath ?? oldPath!;
    const relativeName = relativePath(root, path).replace(/\\/g, "/");
    if (this.ignores.some((pattern) => matchesGlob(pattern, relativeName))) return null;
    const parsedDate = record.changedAt ? new Date(record.changedAt) : this.now();
    return {
      eventId: `${record.journalId}:${record.changeId}`,
      journalId: record.journalId,
      changeId: record.changeId,
      action,
      path,
      oldPath,
      newPath,
      changedAt: Number.isNaN(parsedDate.getTime()) ? this.now().toISOString() : parsedDate.toISOString(),
      projectRoot: root,
    };
  }

  private isIgnored(candidate: string, root: string): boolean {
    const relativeName = relativePath(root, candidate).replace(/\\/g, "/");
    return this.ignores.some((pattern) => matchesGlob(pattern, relativeName));
  }

  private async readGitFallback(correlation: RuntimeCorrelation): Promise<GitFallbackSnapshot[]> {
    const results: GitFallbackSnapshot[] = [];
    for (const projectRoot of this.roots) {
      try {
        const adapter = new GitReadAdapter({ workspaceRoot: projectRoot, commandRunner: this.options.commandRunner });
        const [status, diff] = await Promise.all([adapter.status(correlation), adapter.diffFromHead(correlation)]);
        results.push({ projectRoot, status, diff });
      } catch {
        results.push({ projectRoot, status: "unavailable", diff: "unavailable" });
      }
    }
    return results;
  }

  private async readCursor(): Promise<StoredCursor | null> {
    try {
      const parsed = JSON.parse(await readFile(this.options.statePath, "utf8")) as Partial<StoredCursor>;
      if (parsed.version !== 1 || !parsed.position || typeof parsed.position.journalId !== "string" || !Number.isSafeInteger(parsed.position.changeId)) {
        throw new Error("everything_cursor_invalid");
      }
      return parsed as StoredCursor;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("everything_cursor_unreadable");
    }
  }

  private async writeCursor(position: JournalPosition): Promise<void> {
    const path = resolve(this.options.statePath);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version: 1, position } satisfies StoredCursor)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  }

  private async run(correlation: RuntimeCorrelation, args: readonly string[]) {
    const cwd = this.options.projectRoots[0]!;
    const command: RuntimeCommand = {
      id: randomUUID(), correlation, capabilityId: "everything.journal", executable: this.executable,
      args: this.instance ? ["-instance", this.instance, ...args] : args,
      cwd, timeoutMs: 10_000, maxOutputBytes: MAX_OUTPUT_BYTES, risk: "R0",
    };
    const result = await this.options.commandRunner.run(command);
    if (result.exitCode !== 0 || result.timedOut || result.truncated) throw new Error("everything_command_failed");
    return result;
  }
}
