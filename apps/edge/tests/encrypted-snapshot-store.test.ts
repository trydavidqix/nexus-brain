import { mkdtemp, readFile, readdir, rm, mkdir, writeFile, symlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EncryptedSnapshotStore, type SnapshotIdentity } from "../src/snapshot/encrypted-snapshot-store.js";

const identity: SnapshotIdentity = { project_id: "nexus", task_id: "task-1", agent_id: "agent-1" };
const snapshotId = "11111111-1111-4111-8111-111111111111";
const temporaryRoots: string[] = [];
vi.setConfig({ testTimeout: 60_000 });

async function roots() {
  const parent = await mkdtemp(join(tmpdir(), "nexus-nb11-"));
  temporaryRoots.push(parent);
  const workspaceRoot = join(parent, "workspace");
  const storageRoot = join(parent, "local-state");
  await mkdir(workspaceRoot);
  return { parent, workspaceRoot, storageRoot };
}

function store(options: { workspaceRoot: string; storageRoot: string; id?: () => string }) {
  return new EncryptedSnapshotStore({ ...options, id: options.id ?? (() => snapshotId) });
}

function restoreInFreshNodeProcess(input: { workspaceRoot: string; storageRoot: string; snapshotId: string; destination: string }) {
  const script = [
    "const { EncryptedSnapshotStore } = await import(process.env.NEXUS_TEST_SNAPSHOT_MODULE)",
    "let inputText = ''",
    "for await (const chunk of process.stdin) inputText += chunk",
    "const input = JSON.parse(inputText)",
    "const store = new EncryptedSnapshotStore({ workspaceRoot: input.workspaceRoot, storageRoot: input.storageRoot })",
    "const result = await store.restore({ snapshot_id: input.snapshotId, identity: input.identity, destination: input.destination })",
    "process.stdout.write(JSON.stringify(result))",
  ].join("\n");
  const env = Object.fromEntries(["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "PATH"]
    .flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name] as string]]));
  const child = spawn(process.execPath, ["--import", "tsx/esm", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...env, NEXUS_TEST_SNAPSHOT_MODULE: new URL("../src/snapshot/encrypted-snapshot-store.ts", import.meta.url).href },
    windowsHide: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const inputText = JSON.stringify({ ...input, identity });
  child.stdin.end(inputText, "utf8");
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function runStoreInFreshNodeProcess(input: Record<string, unknown>, operation: string) {
  const script = [
    "const { EncryptedSnapshotStore } = await import(process.env.NEXUS_TEST_SNAPSHOT_MODULE)",
    "let inputText = ''",
    "for await (const chunk of process.stdin) inputText += chunk",
    "const input = JSON.parse(inputText)",
    "const store = new EncryptedSnapshotStore({ workspaceRoot: input.workspaceRoot, storageRoot: input.storageRoot, id: () => input.snapshotId })",
    "try {",
    `  ${operation}`,
    "} catch (error) {",
    "  process.stdout.write(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }))",
    "  process.exitCode = 1",
    "}",
  ].join("\n");
  const env = Object.fromEntries(["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "PATH"]
    .flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name] as string]]));
  const child = spawn(process.execPath, ["--import", "tsx/esm", "--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...env, NEXUS_TEST_SNAPSHOT_MODULE: new URL("../src/snapshot/encrypted-snapshot-store.ts", import.meta.url).href },
    windowsHide: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(JSON.stringify({ ...input, identity }), "utf8");
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe.skipIf(process.platform !== "win32")("EncryptedSnapshotStore", () => {
  it("creates encrypted snapshots and restores them after a separate Node process restart", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const contents = Buffer.from("synthetic uncommitted change");
    const first = store({ workspaceRoot, storageRoot });
    const created = await first.create({
      identity,
      files: [{ path: "src/change.txt", contents }],
    });

    const snapshotPath = join(storageRoot, "snapshots", `${snapshotId}.snapshot`);
    const ciphertext = await readFile(snapshotPath);
    expect(ciphertext.includes(contents)).toBe(false);
    expect(ciphertext.toString("utf8")).not.toContain(contents.toString("utf8"));
    const wrappedKey = await readFile(join(storageRoot, "nexus-edge-snapshot-key-v1"), "utf8");
    expect(wrappedKey).not.toContain(contents.toString("utf8"));
    expect(created.snapshot_id).toBe(snapshotId);

    const recoveredRoot = join(workspaceRoot, "recovered");
    const restoredProcess = await restoreInFreshNodeProcess({
      workspaceRoot,
      storageRoot,
      snapshotId: created.snapshot_id,
      destination: recoveredRoot,
    });
    expect(restoredProcess.code, restoredProcess.stderr).toBe(0);
    const restored = JSON.parse(restoredProcess.stdout) as { files: unknown };
    expect(restored.files).toEqual([{ path: "src/change.txt", sha256: expect.any(String), bytes: contents.byteLength }]);
    expect(await readFile(join(recoveredRoot, "src", "change.txt"))).toEqual(contents);
  });

  it("rejects restoring a snapshot under another project, task, or agent identity", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const created = await store({ workspaceRoot, storageRoot }).create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] });
    for (const wrongIdentity of [
      { ...identity, project_id: "other-project" },
      { ...identity, task_id: "other-task" },
      { ...identity, agent_id: "other-agent" },
    ]) {
      await expect(store({ workspaceRoot, storageRoot }).restore({
        snapshot_id: created.snapshot_id,
        identity: wrongIdentity,
        destination: join(workspaceRoot, `wrong-scope-${wrongIdentity.task_id}-${wrongIdentity.agent_id}`),
      })).rejects.toThrow("snapshot_scope_mismatch");
    }
  });

  it("rejects traversal paths and destinations that already exist", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    await expect(instance.create({ identity, files: [{ path: "../outside.txt", contents: Buffer.from("x") }] }))
      .rejects.toThrow("snapshot_path_invalid");
    const created = await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] });
    const existing = join(workspaceRoot, "existing");
    await mkdir(existing);
    await expect(instance.restore({ snapshot_id: created.snapshot_id, identity, destination: existing }))
      .rejects.toThrow("snapshot_destination_exists");
  });

  it("rejects Windows reserved device names and segments ending in dots or spaces", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    for (const path of [
      "CON", "prn.txt", "AUX.log", "NUL", "COM1", "lpt9.data", "COM¹", "folder/CON .txt",
      "trailing-dot.", "trailing-space ", "folder./file.txt", "folder /file.txt",
    ]) {
      await expect(instance.create({ identity, files: [{ path, contents: Buffer.from("x") }] }))
        .rejects.toThrow("snapshot_path_invalid");
    }
  });

  it("detects ciphertext tampering before restoring any file", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    const created = await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] });
    const snapshotPath = join(storageRoot, "snapshots", `${created.snapshot_id}.snapshot`);
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as { ciphertext: string };
    snapshot.ciphertext = `${snapshot.ciphertext.slice(0, -4)}AAAA`;
    await writeFile(snapshotPath, JSON.stringify(snapshot));

    await expect(instance.restore({ snapshot_id: created.snapshot_id, identity, destination: join(workspaceRoot, "tampered") }))
      .rejects.toThrow("snapshot_authentication_failed");
    await expect(readdir(join(workspaceRoot, "tampered"))).rejects.toThrow();
  });

  it("rejects an authenticated-encryption tag shorter than 16 bytes", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    const created = await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] });
    const snapshotPath = join(storageRoot, "snapshots", `${created.snapshot_id}.snapshot`);
    const envelope = JSON.parse(await readFile(snapshotPath, "utf8")) as { auth_tag: string };
    envelope.auth_tag = Buffer.from(envelope.auth_tag, "base64").subarray(0, 15).toString("base64");
    await writeFile(snapshotPath, JSON.stringify(envelope));

    await expect(instance.restore({ snapshot_id: created.snapshot_id, identity, destination: join(workspaceRoot, "truncated-tag") }))
      .rejects.toThrow("snapshot_authentication_failed");
    await expect(readdir(join(workspaceRoot, "truncated-tag"))).rejects.toThrow();
  });

  it("keeps failed deliveries queued and acknowledges only successful encrypted delivery", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    const created = await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("offline payload") }] });
    await expect(instance.flushPending(identity, async () => { throw new Error("offline"); })).rejects.toThrow("snapshot_delivery_failed");
    expect(await instance.pending(identity)).toEqual([created.snapshot_id]);

    let delivered = false;
    expect(await instance.flushPending(identity, async (item) => {
      expect(item.snapshot_id).toBe(created.snapshot_id);
      expect(item.encrypted_snapshot.toString("utf8")).not.toContain("offline payload");
      delivered = true;
    })).toBe(1);
    expect(delivered).toBe(true);
    expect(await instance.pending(identity)).toEqual([]);
  });

  it("never creates its storage directory inside the workspace", async () => {
    const { workspaceRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot: join(workspaceRoot, ".nexus-state") });
    await expect(instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] }))
      .rejects.toThrow("snapshot_storage_must_be_outside_workspace");
  });

  it("does not overwrite a snapshot when its unique id collides", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("first") }] });
    await expect(instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("second") }] }))
      .rejects.toThrow("snapshot_already_exists");
    const snapshot = await readFile(join(storageRoot, "snapshots", `${snapshotId}.snapshot`));
    expect(snapshot.toString("utf8")).not.toContain("first");
    expect(snapshot.toString("utf8")).not.toContain("second");
  });

  it("enforces the queue cap across independent Node processes", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    let sequence = 1;
    const instance = store({
      workspaceRoot,
      storageRoot,
      id: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    });
    for (let index = 0; index < 99; index += 1) {
      await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from(String(index)) }] });
    }
    const operation = "const result = await store.create({ identity: input.identity, files: [{ path: 'file.txt', contents: Buffer.from(input.contents) }] }); process.stdout.write(JSON.stringify(result))";
    const concurrent = await Promise.all([
      runStoreInFreshNodeProcess({ workspaceRoot, storageRoot, snapshotId: "00000000-0000-4000-8000-000000000101", contents: "a" }, operation),
      runStoreInFreshNodeProcess({ workspaceRoot, storageRoot, snapshotId: "00000000-0000-4000-8000-000000000102", contents: "b" }, operation),
    ]);
    expect(concurrent.filter((result) => result.code === 0)).toHaveLength(1);
    expect(concurrent.filter((result) => result.code !== 0 && JSON.parse(result.stdout).error === "snapshot_queue_limit_exceeded")).toHaveLength(1);
    expect(await instance.pending(identity)).toHaveLength(100);
  }, 180_000);

  it("rejects snapshots and delivered storage directories redirected by junctions", async () => {
    for (const child of ["snapshots", "delivered"] as const) {
      const { workspaceRoot, storageRoot, parent } = await roots();
      const outside = join(parent, "outside-" + child);
      await mkdir(outside);
      await mkdir(storageRoot);
      await symlink(outside, join(storageRoot, child), "junction");
      const instance = store({ workspaceRoot, storageRoot });
      await expect(instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("x") }] }))
        .rejects.toThrow("snapshot_storage_symlink_denied");
    }
  });

  it("rejects restore through a workspace junction that resolves outside the workspace", async () => {
    const { workspaceRoot, storageRoot, parent } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    const created = await instance.create({ identity, files: [{ path: "nested/file.txt", contents: Buffer.from("x") }] });
    const outside = join(parent, "outside-restore");
    await mkdir(outside);
    await symlink(outside, join(workspaceRoot, "escape"), "junction");
    await expect(instance.restore({ snapshot_id: created.snapshot_id, identity, destination: join(workspaceRoot, "escape", "restored") }))
      .rejects.toThrow("snapshot_destination_outside_workspace");
    await expect(readdir(outside)).resolves.toEqual([]);
  });

  it("serializes concurrent flushes across independent Node processes", async () => {
    const { workspaceRoot, storageRoot, parent } = await roots();
    const instance = store({ workspaceRoot, storageRoot });
    await instance.create({ identity, files: [{ path: "file.txt", contents: Buffer.from("queued") }] });
    const marker = join(parent, "delivery-count.txt");
    const operation = "const { open } = await import('node:fs/promises'); const delivered = await store.flushPending(input.identity, async ({ snapshot_id }) => { const handle = await open(input.marker, 'a'); await handle.writeFile(snapshot_id + '\\n'); await handle.close(); await new Promise(resolve => setTimeout(resolve, 100)); }); process.stdout.write(JSON.stringify({ delivered }))";
    const results = await Promise.all([
      runStoreInFreshNodeProcess({ workspaceRoot, storageRoot, marker, snapshotId: "00000000-0000-4000-8000-000000000201" }, operation),
      runStoreInFreshNodeProcess({ workspaceRoot, storageRoot, marker, snapshotId: "00000000-0000-4000-8000-000000000202" }, operation),
    ]);
    expect(results.every((result) => result.code === 0), results.map((result) => result.stderr).join("\n")).toBe(true);
    expect(results.map((result) => JSON.parse(result.stdout).delivered).sort()).toEqual([0, 1]);
    expect((await readFile(marker, "utf8")).trim().split(/\r?\n/)).toEqual([snapshotId]);
  });

  it("releases the Windows mutex when a holder process exits during delivery", async () => {
    const { workspaceRoot, storageRoot } = await roots();
    await store({ workspaceRoot, storageRoot }).create({ identity, files: [{ path: "file.txt", contents: Buffer.from("queued") }] });
    const crash = await runStoreInFreshNodeProcess(
      { workspaceRoot, storageRoot, snapshotId },
      "await store.flushPending(input.identity, async () => { process.exit(17) })",
    );
    expect(crash.code).toBe(17);

    const recovery = await runStoreInFreshNodeProcess(
      { workspaceRoot, storageRoot, snapshotId },
      "const delivered = await store.flushPending(input.identity, async () => {}); process.stdout.write(JSON.stringify({ delivered }))",
    );
    expect(recovery.code, recovery.stderr).toBe(0);
    expect(JSON.parse(recovery.stdout)).toEqual({ delivered: 1 });
  }, 30_000);
});
