import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const base = 'infra/local/hindsight';
const read = (name) => readFileSync(`${base}/${name}`, 'utf8');

test('local runtime is pinned, local-only, and has no automatic paid fallback', () => {
  const lock = read('requirements.lock.txt');
  const start = read('start.ps1');

  assert.match(lock, /hindsight-api==0\.10\.1/);
  assert.match(lock, /pg0-embedded==0\.15\.2/);
  assert.match(start, /HINDSIGHT_API_DATABASE_URL = 'pg0:\/\/nexus-dev'/);
  assert.match(start, /HINDSIGHT_API_LLM_PROVIDER = 'gemini'/);
  assert.match(start, /HINDSIGHT_API_LLM_MODEL = 'gemini-3\.5-flash'/);
  assert.match(start, /HINDSIGHT_API_LLM_MAX_RETRIES = '1'/);
  assert.match(start, /HINDSIGHT_API_LLM_INITIAL_BACKOFF = '2'/);
  assert.match(start, /HINDSIGHT_API_LLM_MAX_BACKOFF = '5'/);
  assert.match(start, /HINDSIGHT_API_REFLECT_LLM_TIMEOUT = '120'/);
  assert.match(start, /PYTHONPATH = .*PSScriptRoot/);
  assert.match(read('sitecustomize.py'), /gemini_quota_guard/);
  assert.match(start, /HINDSIGHT_API_LLM_DEBUG_DUMP_4XX = 'false'/);
  assert.match(start, /HINDSIGHT_API_EMBEDDINGS_PROVIDER = 'local'/);
  assert.match(start, /HINDSIGHT_API_RERANKER_PROVIDER = 'local'/);
  assert.match(start, /HINDSIGHT_API_HOST = '127\.0\.0\.1'/);
  assert.match(start, /AllowNonSensitiveGeminiData/);
  assert.doesNotMatch(start, /HINDSIGHT_API_LLM_STRATEGY|HINDSIGHT_API_LLM_1_PROVIDER|vertexai|cloud run|cloud sql/i);
  assert.doesNotMatch(start, /sk-[A-Za-z0-9]{12,}|AIza[A-Za-z0-9_-]{30,}/);
});

test('daily Gemini Free Tier quota guard is persistent, fail-closed, and distinguishes daily from transient errors', () => {
  const guard = read('gemini_quota_guard.py');
  const guardTests = read('tests/test_gemini_quota_guard.py');

  assert.match(guard, /GenerateRequestsPerDay/i);
  assert.match(guard, /gemini-rpd-circuit\.json/);
  assert.match(guard, /America\/Los_Angeles/);
  assert.match(guard, /no provider request sent/);
  assert.match(guardTests, /test_daily_quota_trips_persistent_breaker/);
  assert.match(guardTests, /test_service_unavailable_does_not_trip_daily_breaker/);
});

test('local setup uses hash-locked dependencies and keeps its virtual environment untracked', () => {
  const install = read('install.ps1');
  const ignore = readFileSync('.gitignore', 'utf8');

  assert.match(install, /uv pip install --python \$VenvPython --require-hashes/);
  assert.match(ignore, /\*\*\/\.venv\//);
});

test('Gemini key prompt is secure and removes the key from the parent environment after exit', () => {
  const run = read('run.ps1');

  assert.match(run, /Read-Host .* -AsSecureString/);
  assert.match(run, /SecureStringToBSTR/);
  assert.match(run, /Remove-Item Env:GEMINI_API_KEY/);
  assert.match(run, /ZeroFreeBSTR/);
  assert.doesNotMatch(run, /Write-Host.*GEMINI_API_KEY|Set-Content.*GEMINI_API_KEY/);
});

test('backups are create-only logical dumps with checksums and isolated restore verification', () => {
  const backup = read('backup.ps1');
  const restore = read('restore-test.ps1');

  assert.match(backup, /--format=custom/);
  assert.match(backup, /Get-FileHash .*SHA256/);
  assert.match(backup, /Refusing to make an unverified filesystem copy/);
  assert.match(backup, /already exists; refusing to overwrite/);
  assert.match(restore, /SHA-256 sidecar is missing/);
  assert.match(restore, /pg_restore\.exe/);
  assert.match(restore, /nexus-restore-/);
  assert.match(restore, /Public tables restored/);
});

test('local docs state free-tier privacy and cost boundaries', () => {
  const docs = read('README.md');

  assert.match(docs, /has no cloud provisioning, paid database, hosted worker, cloud billing link, or paid provider fallback/i);
  assert.match(docs, /has no billing account linked/i);
  assert.match(docs, /Google AI Pro does not pay Gemini Developer API charges/i);
  assert.match(docs, /may be used to improve its products/i);
  assert.match(docs, /Free Tier.*RPM.*TPM.*RPD/s);
});
