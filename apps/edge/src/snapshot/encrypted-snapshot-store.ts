import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep, win32 } from "node:path";

export interface SnapshotIdentity {
  project_id: string;
  task_id: string;
  agent_id: string;
}

export interface SnapshotFileInput {
  path: string;
  contents: Uint8Array;
}

export interface EncryptedSnapshotStoreOptions {
  workspaceRoot: string;
  storageRoot: string;
  id?: () => string;
  now?: () => Date;
}

export interface SnapshotCreated {
  snapshot_id: string;
  created_at: string;
  file_count: number;
  byte_count: number;
}

export interface SnapshotRestored {
  snapshot_id: string;
  files: Array<{ path: string; sha256: string; bytes: number }>;
  destination: string;
}

interface SnapshotFileRecord {
  path: string;
  sha256: string;
  contents_base64: string;
}

interface SnapshotPayload {
  version: 1;
  snapshot_id: string;
  created_at: string;
  identity: SnapshotIdentity;
  files: SnapshotFileRecord[];
}

interface EncryptedSnapshotEnvelope {
  format: "nexus-edge-snapshot-v1";
  snapshot_id: string;
  nonce: string;
  auth_tag: string;
  ciphertext: string;
}

const FORMAT = "nexus-edge-snapshot-v1" as const;
const KEY_FORMAT = "nexus-edge-snapshot-key-v1";
const KEY_ENTROPY = "Nexus.Edge.LocalSnapshotKey.v1";
const MAX_FILES = 1_000;
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
const MAX_PENDING_SNAPSHOTS = 100;
const MAX_DPAPI_OUTPUT = 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WINDOWS_RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/i;
const operationLocks = new Map<string, Promise<void>>();

async function withOperationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = operationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolveLock) => { release = resolveLock; });
  operationLocks.set(key, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (operationLocks.get(key) === current) operationLocks.delete(key);
  }
}

function lockKey(storage: string, identity: SnapshotIdentity, operation: "create" | "flush"): string {
  return `${operation}\0${process.platform === "win32" ? storage.toLowerCase() : storage}\0${identity.project_id}\0${identity.task_id}\0${identity.agent_id}`;
}

function windowsMutexScript(name: string): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    `$mutex = [System.Threading.Mutex]::new($false, '${name}')`,
    "$acquired = $false",
    "try {",
    "  try { $acquired = $mutex.WaitOne([TimeSpan]::FromMinutes(10)) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }",
    "  if (-not $acquired) { throw 'timeout' }",
    "  [Console]::Out.WriteLine('LOCKED')",
    "  [Console]::Out.Flush()",
    "  [Console]::In.ReadLine() | Out-Null",
    "} catch {",
    "  [Console]::Error.Write('snapshot_lock_failed')",
    "  exit 1",
    "} finally {",
    "  if ($acquired) { $mutex.ReleaseMutex() }",
    "  $mutex.Dispose()",
    "}",
  ].join("\n");
}

async function acquireWindowsMutex(key: string): Promise<() => Promise<void>> {
  if (process.platform !== "win32") throw new Error("snapshot_lock_windows_only");
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const executable = resolve(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const name = `Local\\NexusSnapshot-${createHash("sha256").update(key).digest("hex")}`;
  const encodedScript = Buffer.from(windowsMutexScript(name), "utf16le").toString("base64");
  const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
    cwd: process.env.TEMP ?? systemRoot,
    env: Object.fromEntries(["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]
      .flatMap((variable) => process.env[variable] === undefined ? [] : [[variable, process.env[variable] as string]])),
    windowsHide: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return new Promise((resolveLock, rejectLock) => {
    let stdout = "";
    let settled = false;
    let released = false;
    const timer = setTimeout(() => {
      child.kill();
      fail("snapshot_lock_timeout");
    }, 10 * 60 * 1000);
    timer.unref();
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectLock(new Error(message));
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("ascii");
      if (!settled && stdout.includes("LOCKED\r\n")) {
        settled = true;
        clearTimeout(timer);
        resolveLock(async () => {
          if (released) return;
          released = true;
          child.stdin.end();
          await new Promise<void>((resolveExit, rejectExit) => {
            child.once("error", () => rejectExit(new Error("snapshot_lock_release_failed")));
            child.once("close", (code) => code === 0 ? resolveExit() : rejectExit(new Error("snapshot_lock_release_failed")));
          });
        });
      }
    });
    child.stderr.on("data", () => undefined);
    child.once("error", () => fail("snapshot_lock_process_failed"));
    child.once("close", (code) => {
      if (!settled) fail(code === 0 ? "snapshot_lock_not_acquired" : "snapshot_lock_failed");
    });
  });
}

async function withWindowsMutex<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const release = await acquireWindowsMutex(key);
  try {
    return await operation();
  } finally {
    await release();
  }
}

function hash(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

function validateIdentity(identity: SnapshotIdentity): void {
  for (const [field, value] of Object.entries(identity)) {
    if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 256) {
      throw new Error(`snapshot_identity_invalid:${field}`);
    }
  }
}

function sameIdentity(left: SnapshotIdentity, right: SnapshotIdentity): boolean {
  return left.project_id === right.project_id
    && left.task_id === right.task_id
    && left.agent_id === right.agent_id;
}

function normalizeRelativeFilePath(filePath: string): string {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\\") || filePath.includes("\0")) {
    throw new Error("snapshot_path_invalid");
  }
  if (filePath.startsWith("/") || /^[a-z]:/i.test(filePath) || isAbsolute(filePath) || win32.isAbsolute(filePath)) {
    throw new Error("snapshot_path_invalid");
  }
  const segments = filePath.split("/");
  if (segments.some((segment) => {
    const deviceStem = segment.split(".", 1)[0].replace(/[ .]+$/g, "");
    return segment.length === 0
      || segment === "."
      || segment === ".."
      || segment.includes(":")
      || /[. ]$/.test(segment)
      || WINDOWS_RESERVED_DEVICE_NAME.test(deviceStem);
  })) {
    throw new Error("snapshot_path_invalid");
  }
  return segments.join("/");
}

function contained(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function isWithin(root: string, candidate: string): boolean {
  // Windows path comparisons are case-insensitive. The runner is Windows-only for DPAPI.
  const rootPath = process.platform === "win32" ? root.toLowerCase() : root;
  const candidatePath = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  return contained(rootPath, candidatePath);
}

async function canonicalProspectivePath(path: string): Promise<string> {
  const missing: string[] = [];
  let current = resolve(path);
  while (true) {
    try {
      const existing = await realpath(current);
      return resolve(existing, ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      missing.push(basename(current));
      current = parent;
    }
  }
}

function dpapiScript(operation: "Protect" | "Unprotect"): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    "  Add-Type -AssemblyName System.Security",
    "  $encoded = [Console]::In.ReadLine()",
    "  if ([string]::IsNullOrWhiteSpace($encoded)) { throw 'input' }",
    "  $inputBytes = [Convert]::FromBase64String($encoded)",
    `  $entropy = [Text.Encoding]::UTF8.GetBytes('${KEY_ENTROPY}')`,
    `  $result = [System.Security.Cryptography.ProtectedData]::${operation}($inputBytes, $entropy, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
    "  [Console]::Out.Write([Convert]::ToBase64String($result))",
    "  exit 0",
    "} catch {",
    "  [Console]::Error.Write('snapshot_dpapi_failed')",
    "  exit 1",
    "}",
  ].join("\n");
}

function protectKeyWithCurrentUserDpapi(key: Uint8Array, operation: "Protect" | "Unprotect"): Promise<Buffer> {
  if (process.platform !== "win32") return Promise.reject(new Error("snapshot_dpapi_windows_only"));
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const executable = resolve(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const encodedScript = Buffer.from(dpapiScript(operation), "utf16le").toString("base64");
  const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodedScript], {
    cwd: process.env.TEMP ?? systemRoot,
    env: Object.fromEntries(["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]
      .flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name] as string]])),
    windowsHide: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return new Promise((resolveResult, reject) => {
    let stdout = "";
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      fail("snapshot_dpapi_timeout");
    }, 10_000);
    timer.unref();

    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(code));
    };

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_DPAPI_OUTPUT) {
        child.kill();
        fail("snapshot_dpapi_output_too_large");
        return;
      }
      stdout += chunk.toString("ascii");
    });
    // Drain stderr without retaining it. PowerShell diagnostics can include sensitive values.
    child.stderr.on("data", () => undefined);
    child.once("error", () => fail("snapshot_dpapi_process_failed"));
    child.once("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (code !== 0) {
        fail("snapshot_dpapi_failed");
        return;
      }
      const encoded = stdout.trim();
      if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        fail("snapshot_dpapi_output_invalid");
        return;
      }
      settled = true;
      resolveResult(Buffer.from(encoded, "base64"));
    });
    child.stdin.once("error", () => fail("snapshot_dpapi_input_failed"));
    child.stdin.end(Buffer.from(key).toString("base64"), "ascii");
  });
}

async function writeCreateOnly(path: string, contents: Uint8Array): Promise<void> {
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("snapshot_already_exists");
    throw error;
  }
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export class EncryptedSnapshotStore {
  private readonly id: () => string;
  private readonly now: () => Date;
  private key?: Buffer;
  private roots?: { workspace: string; storage: string };

  constructor(private readonly options: EncryptedSnapshotStoreOptions) {
    this.id = options.id ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async create(input: { identity: SnapshotIdentity; files: readonly SnapshotFileInput[] }): Promise<SnapshotCreated> {
    validateIdentity(input.identity);
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > MAX_FILES) {
      throw new Error("snapshot_file_count_invalid");
    }
    const seen = new Set<string>();
    let byteCount = 0;
    const files: SnapshotFileRecord[] = input.files.map((file) => {
      const path = normalizeRelativeFilePath(file.path);
      const key = process.platform === "win32" ? path.toLowerCase() : path;
      if (seen.has(key)) throw new Error("snapshot_duplicate_path");
      seen.add(key);
      if (!(file.contents instanceof Uint8Array)) throw new Error("snapshot_contents_invalid");
      byteCount += file.contents.byteLength;
      if (byteCount > MAX_SNAPSHOT_BYTES) throw new Error("snapshot_size_limit_exceeded");
      return { path, sha256: hash(file.contents), contents_base64: Buffer.from(file.contents).toString("base64") };
    });

    const id = this.id();
    if (!UUID.test(id)) throw new Error("snapshot_id_invalid");
    const createdAt = this.now().toISOString();
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error("snapshot_timestamp_invalid");
    const payload: SnapshotPayload = { version: 1, snapshot_id: id, created_at: createdAt, identity: { ...input.identity }, files };
    const encrypted = await this.encrypt(payload);
    const paths = await this.getPaths();
    const createLockKey = lockKey(paths.storage, input.identity, "create");
    await withOperationLock(createLockKey, () => withWindowsMutex(createLockKey, async () => {
      if ((await this.pendingCount(input.identity)) >= MAX_PENDING_SNAPSHOTS) throw new Error("snapshot_queue_limit_exceeded");
      await this.assertStorageDirectories(paths.storage);
      await writeCreateOnly(resolve(paths.storage, "snapshots", `${id}.snapshot`), Buffer.from(JSON.stringify(encrypted), "utf8"));
    }));
    return { snapshot_id: id, created_at: createdAt, file_count: files.length, byte_count: byteCount };
  }

  async pending(identity: SnapshotIdentity): Promise<string[]> {
    validateIdentity(identity);
    const paths = await this.getPaths();
    await this.assertStorageDirectories(paths.storage);
    const entries = (await readdir(resolve(paths.storage, "snapshots")))
      .filter((name) => name.endsWith(".snapshot"))
      .sort();
    const result: Array<{ id: string; createdAt: string }> = [];
    for (const name of entries) {
      const id = name.slice(0, -".snapshot".length);
      if (!UUID.test(id) || await this.isDelivered(paths.storage, id)) continue;
      const payload = await this.readPayload(paths.storage, id);
      if (sameIdentity(payload.identity, identity)) result.push({ id, createdAt: payload.created_at });
      if (result.length > MAX_PENDING_SNAPSHOTS) throw new Error("snapshot_queue_limit_exceeded");
    }
    return result.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map(({ id }) => id);
  }

  async flushPending(identity: SnapshotIdentity, send: (item: { snapshot_id: string; encrypted_snapshot: Buffer }) => Promise<void>): Promise<number> {
    validateIdentity(identity);
    const paths = await this.getPaths();
    const flushLockKey = lockKey(paths.storage, identity, "flush");
    return withOperationLock(flushLockKey, () => withWindowsMutex(flushLockKey, async () => {
      let delivered = 0;
      for (const id of await this.pending(identity)) {
        await this.assertStorageDirectories(paths.storage);
        const encrypted = await this.readStorageFile(paths.storage, "snapshots", `${id}.snapshot`);
        try {
          await send({ snapshot_id: id, encrypted_snapshot: encrypted });
        } catch {
          throw new Error("snapshot_delivery_failed");
        }
        await this.assertStorageDirectories(paths.storage);
        await writeCreateOnly(resolve(paths.storage, "delivered", `${id}.ack`), Buffer.from(`${id}\n`, "ascii"));
        delivered += 1;
      }
      return delivered;
    }));
  }

  async restore(input: { snapshot_id: string; identity: SnapshotIdentity; destination: string }): Promise<SnapshotRestored> {
    validateIdentity(input.identity);
    if (!UUID.test(input.snapshot_id)) throw new Error("snapshot_id_invalid");
    const paths = await this.getPaths();
    await this.assertStorageDirectories(paths.storage);
    const payload = await this.readPayload(paths.storage, input.snapshot_id);
    if (!sameIdentity(payload.identity, input.identity)) throw new Error("snapshot_scope_mismatch");

    const destinationParent = await realpath(dirname(resolve(input.destination)));
    const destination = resolve(destinationParent, basename(resolve(input.destination)));
    if (!isWithin(paths.workspace, destination) || destination === paths.workspace) {
      throw new Error("snapshot_destination_outside_workspace");
    }
    await this.assertNoSymlinkParents(paths.workspace, destination);
    if (isWithin(paths.storage, destination) || isWithin(destination, paths.storage)) {
      throw new Error("snapshot_destination_overlaps_storage");
    }
    try {
      await mkdir(destination, { recursive: false, mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("snapshot_destination_exists");
      throw error;
    }
    await this.assertDirectoryWithin(paths.workspace, destination, "snapshot_restore_symlink_denied");

    const prepared = payload.files.map((file) => ({ ...file, contents: Buffer.from(file.contents_base64, "base64") }));
    const restored: SnapshotRestored["files"] = [];
    for (const file of prepared) {
      const path = file.path;
      const contents = file.contents;
      const target = resolve(destination, ...path.split("/"));
      if (!isWithin(destination, target) || target === destination) throw new Error("snapshot_path_invalid");
      await this.createSafeParents(destination, dirname(target));
      await this.assertNoSymlinkParents(destination, target);
      await this.assertDirectoryWithin(destination, dirname(target), "snapshot_restore_symlink_denied");
      const handle = await open(target, "wx", 0o600);
      try {
        await handle.writeFile(contents);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.assertRegularFileWithin(destination, target, "snapshot_restore_symlink_denied");
      const written = await readFile(target);
      if (hash(written) !== file.sha256) throw new Error("snapshot_restore_verification_failed");
      restored.push({ path, sha256: file.sha256, bytes: written.byteLength });
    }
    return { snapshot_id: input.snapshot_id, files: restored, destination };
  }

  private async encrypt(payload: SnapshotPayload): Promise<EncryptedSnapshotEnvelope> {
    const key = await this.loadOrCreateKey();
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(`${FORMAT}\0${payload.snapshot_id}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return {
      format: FORMAT,
      snapshot_id: payload.snapshot_id,
      nonce: nonce.toString("base64"),
      auth_tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  private async decrypt(envelope: EncryptedSnapshotEnvelope, expectedId: string): Promise<SnapshotPayload> {
    if (envelope.format !== FORMAT || envelope.snapshot_id !== expectedId) throw new Error("snapshot_envelope_invalid");
    try {
      const decipher = createDecipheriv("aes-256-gcm", await this.loadOrCreateKey(), Buffer.from(envelope.nonce, "base64"), { authTagLength: 16 });
      decipher.setAAD(Buffer.from(`${FORMAT}\0${expectedId}`, "utf8"));
      decipher.setAuthTag(Buffer.from(envelope.auth_tag, "base64"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
      const payload = JSON.parse(plaintext.toString("utf8")) as SnapshotPayload;
      if (payload.version !== 1 || payload.snapshot_id !== expectedId || !Number.isFinite(Date.parse(payload.created_at)) || !Array.isArray(payload.files)) {
        throw new Error("snapshot_payload_invalid");
      }
      validateIdentity(payload.identity);
      if (payload.files.length === 0 || payload.files.length > MAX_FILES) throw new Error("snapshot_payload_invalid");
      const paths = new Set<string>();
      let byteCount = 0;
      for (const file of payload.files) {
        const path = normalizeRelativeFilePath(file.path);
        const pathKey = process.platform === "win32" ? path.toLowerCase() : path;
        if (paths.has(pathKey) || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.contents_base64 !== "string") {
          throw new Error("snapshot_payload_invalid");
        }
        paths.add(pathKey);
        const contents = Buffer.from(file.contents_base64, "base64");
        if (contents.toString("base64") !== file.contents_base64 || hash(contents) !== file.sha256) {
          throw new Error("snapshot_payload_invalid");
        }
        byteCount += contents.byteLength;
        if (byteCount > MAX_SNAPSHOT_BYTES) throw new Error("snapshot_payload_invalid");
      }
      return payload;
    } catch (error) {
      if ((error as Error).message === "snapshot_payload_invalid" || (error as Error).message.startsWith("snapshot_identity_invalid:")) throw error;
      throw new Error("snapshot_authentication_failed");
    }
  }

  private async readPayload(storageRoot: string, id: string): Promise<SnapshotPayload> {
    const raw = (await this.readStorageFile(storageRoot, "snapshots", `${id}.snapshot`)).toString("utf8");
    let envelope: EncryptedSnapshotEnvelope;
    try {
      envelope = JSON.parse(raw) as EncryptedSnapshotEnvelope;
    } catch {
      throw new Error("snapshot_envelope_invalid");
    }
    return this.decrypt(envelope, id);
  }

  private async loadOrCreateKey(): Promise<Buffer> {
    if (this.key) return this.key;
    const paths = await this.getPaths();
    const keyPath = resolve(paths.storage, KEY_FORMAT);
    try {
      const wrapped = Buffer.from((await readFile(keyPath, "utf8")).trim(), "base64");
      const key = await protectKeyWithCurrentUserDpapi(wrapped, "Unprotect");
      if (key.byteLength !== 32) throw new Error("snapshot_key_invalid");
      this.key = key;
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const key = randomBytes(32);
    const wrapped = await protectKeyWithCurrentUserDpapi(key, "Protect");
    try {
      await writeCreateOnly(keyPath, Buffer.from(`${wrapped.toString("base64")}\n`, "ascii"));
      this.key = key;
      return key;
    } catch (error) {
      if ((error as Error).message !== "snapshot_already_exists") throw error;
      const existing = Buffer.from((await readFile(keyPath, "utf8")).trim(), "base64");
      const existingKey = await protectKeyWithCurrentUserDpapi(existing, "Unprotect");
      if (existingKey.byteLength !== 32) throw new Error("snapshot_key_invalid");
      this.key = existingKey;
      return existingKey;
    }
  }

  private async pendingCount(identity: SnapshotIdentity): Promise<number> {
    return (await this.pending(identity)).length;
  }

  private async isDelivered(storageRoot: string, id: string): Promise<boolean> {
    try {
      await this.readStorageFile(storageRoot, "delivered", `${id}.ack`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private async assertNoSymlinkParents(root: string, target: string): Promise<void> {
    const canonicalRoot = await realpath(root);
    const canonicalTargetParent = await realpath(dirname(target));
    if (!isWithin(canonicalRoot, canonicalTargetParent)) throw new Error("snapshot_restore_symlink_denied");
    const rel = relative(canonicalRoot, canonicalTargetParent);
    let current = root;
    for (const segment of rel.split(sep).filter(Boolean)) {
      current = resolve(current, segment);
      const item = await lstat(current);
      if (item.isSymbolicLink() || !item.isDirectory()) throw new Error("snapshot_restore_symlink_denied");
      const canonical = await realpath(current);
      if (!isWithin(canonicalRoot, canonical)) throw new Error("snapshot_restore_symlink_denied");
    }
  }

  private async createSafeParents(root: string, parent: string): Promise<void> {
    const rel = relative(root, parent);
    if (!isWithin(root, parent)) throw new Error("snapshot_path_invalid");
    let current = root;
    for (const segment of rel.split(sep).filter(Boolean)) {
      current = resolve(current, segment);
      try {
        await mkdir(current, { recursive: false, mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      await this.assertDirectoryWithin(root, current, "snapshot_restore_symlink_denied");
    }
  }

  private async assertDirectoryWithin(root: string, path: string, errorCode: string): Promise<void> {
    const item = await lstat(path);
    if (item.isSymbolicLink() || !item.isDirectory()) throw new Error(errorCode);
    const canonicalRoot = await realpath(root);
    const canonicalPath = await realpath(path);
    if (!isWithin(canonicalRoot, canonicalPath)) throw new Error(errorCode);
  }

  private async assertRegularFileWithin(root: string, path: string, errorCode: string): Promise<void> {
    const item = await lstat(path);
    if (item.isSymbolicLink() || !item.isFile()) throw new Error(errorCode);
    const canonicalRoot = await realpath(root);
    const canonicalPath = await realpath(path);
    if (!isWithin(canonicalRoot, canonicalPath)) throw new Error(errorCode);
  }

  private async readStorageFile(storageRoot: string, directory: "snapshots" | "delivered", name: string): Promise<Buffer> {
    await this.assertStorageDirectories(storageRoot);
    const path = resolve(storageRoot, directory, name);
    await this.assertRegularFileWithin(resolve(storageRoot, directory), path, "snapshot_storage_symlink_denied");
    return readFile(path);
  }

  private async assertStorageDirectories(storageRoot: string): Promise<void> {
    for (const name of ["snapshots", "delivered"] as const) {
      const path = resolve(storageRoot, name);
      await this.assertDirectoryWithin(storageRoot, path, "snapshot_storage_symlink_denied");
    }
  }

  private async getPaths(): Promise<{ workspace: string; storage: string }> {
    if (this.roots) {
      const currentStorage = await realpath(resolve(this.options.storageRoot));
      if (currentStorage !== this.roots.storage) throw new Error("snapshot_storage_root_changed");
      await this.assertStorageDirectories(this.roots.storage);
      return this.roots;
    }
    const workspace = await realpath(this.options.workspaceRoot);
    const configuredStorage = resolve(this.options.storageRoot);
    const prospectiveStorage = await canonicalProspectivePath(configuredStorage);
    if (isWithin(workspace, prospectiveStorage) || isWithin(prospectiveStorage, workspace)) {
      throw new Error("snapshot_storage_must_be_outside_workspace");
    }
    await mkdir(configuredStorage, { recursive: true, mode: 0o700 });
    const storage = await realpath(configuredStorage);
    if (isWithin(workspace, storage) || isWithin(storage, workspace)) {
      throw new Error("snapshot_storage_must_be_outside_workspace");
    }
    await mkdir(resolve(storage, "snapshots"), { recursive: true, mode: 0o700 });
    await mkdir(resolve(storage, "delivered"), { recursive: true, mode: 0o700 });
    await this.assertStorageDirectories(storage);
    this.roots = { workspace, storage };
    return this.roots;
  }
}
