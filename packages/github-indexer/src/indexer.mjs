import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_WEBHOOK_BYTES = 1_048_576;
const COMMIT_SHA = /^[a-f0-9]{40,64}$/i;
const BRANCH_REF = /^refs\/heads\/([A-Za-z0-9._/-]{1,255})$/;

function safeRepositoryName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(value) ? value.toLowerCase() : null;
}

function normalizeRepositories(repositories) {
  if (!Array.isArray(repositories) || repositories.length === 0) throw new Error('repositories_required');
  const result = new Map();
  for (const value of repositories) {
    const name = safeRepositoryName(`${value?.owner}/${value?.name}`);
    if (!name || typeof value.projectId !== 'string' || !value.projectId.trim() || value.projectId !== value.projectId.trim()) throw new Error('repository_binding_invalid');
    if (result.has(name)) throw new Error('repository_binding_duplicate');
    if (typeof value.defaultBranch !== 'string' || !value.defaultBranch.trim()) throw new Error('repository_default_branch_invalid');
    result.set(name, { projectId: value.projectId, name, defaultBranch: value.defaultBranch });
  }
  return result;
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > MAX_WEBHOOK_BYTES) return false;
  if (typeof secret !== 'string' || !secret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function parsePush(payload, binding) {
  const ref = BRANCH_REF.exec(payload?.ref || '');
  const repository = safeRepositoryName(payload?.repository?.full_name);
  if (!ref || repository !== binding.name) throw new Error('push_payload_invalid');
  const branch = ref[1];
  if (branch.split('/').some(part => !part || part === '.' || part === '..') || branch.endsWith('.lock')) throw new Error('push_payload_invalid');
  const beforeSha = COMMIT_SHA.test(payload.before || '') && !/^0+$/.test(payload.before) ? payload.before.toLowerCase() : null;
  const deleted = payload.deleted === true || (COMMIT_SHA.test(payload.after || '') && /^0+$/.test(payload.after));
  if (deleted) {
    if (!beforeSha || !/^0+$/.test(payload.after || '') || (Array.isArray(payload.commits) && payload.commits.length > 0)) throw new Error('push_payload_invalid');
    return { branch, beforeSha, headSha: null, commits: [], deleted: true };
  }
  if (!COMMIT_SHA.test(payload.after || '') || /^0+$/.test(payload.after)) throw new Error('push_payload_invalid');
  const rawCommits = Array.isArray(payload.commits) ? payload.commits : [];
  if (payload.head_commit && payload.head_commit.id !== payload.after) throw new Error('push_payload_commits_invalid');
  const boundedCommits = rawCommits.length > 300 ? rawCommits.slice(-299) : rawCommits;
  if (payload.head_commit && !boundedCommits.some(commit => commit?.id === payload.after)) boundedCommits.push({ ...payload.head_commit, id: payload.after });
  const commits = boundedCommits.map(commit => {
    if (!COMMIT_SHA.test(commit?.id || '') || typeof commit.message !== 'string' || typeof commit.timestamp !== 'string') throw new Error('push_payload_commits_invalid');
    const committedAt = new Date(commit.timestamp);
    if (!Number.isFinite(committedAt.getTime())) throw new Error('push_payload_commits_invalid');
    const url = typeof commit.url === 'string' && /^https:\/\/github\.com\//i.test(commit.url) ? commit.url : null;
    return { sha: commit.id.toLowerCase(), message: commit.message.slice(0, 1000), author: typeof commit.author?.username === 'string' ? commit.author.username.slice(0, 200) : 'unknown', committedAt: committedAt.toISOString(), url };
  });
  const uniqueCommits = [...new Map(commits.map(commit => [commit.sha, commit])).values()];
  const head = uniqueCommits.find(commit => commit.sha === payload.after.toLowerCase());
  if (!head) throw new Error('push_payload_commits_invalid');
  return { branch, beforeSha, headSha: payload.after.toLowerCase(), commits: uniqueCommits, deleted: false };
}

export function createGitHubIndexer({ store, repositories, webhookSecret, github, now = () => new Date().toISOString() }) {
  if (!store || typeof store.beginDelivery !== 'function' || typeof store.completeDelivery !== 'function' || typeof store.releaseDelivery !== 'function' || typeof store.recordBranchSnapshot !== 'function' || typeof store.recordBranchDeletion !== 'function' || typeof store.markMissingBranches !== 'function' || typeof store.getBranchHead !== 'function') throw new Error('github_index_store_invalid');
  const bindings = normalizeRepositories(repositories);

  return {
    async handleWebhook({ deliveryId, eventName, signature, rawBody }) {
      if (typeof deliveryId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(deliveryId)) throw new Error('webhook_delivery_id_invalid');
      if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) throw new Error('webhook_payload_invalid');
      if (rawBody.length > MAX_WEBHOOK_BYTES) throw new Error('webhook_payload_too_large');
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) throw new Error('webhook_signature_invalid');
      const payloadHash = createHash('sha256').update(rawBody).digest('hex');
      const acquired = await store.beginDelivery({ deliveryId, eventName, payloadHash, startedAt: now() });
      if (!acquired) return { status: 'duplicate' };
      try {
        if (eventName !== 'push') {
          await store.completeDelivery(deliveryId, now());
          return { status: 'ignored' };
        }
        let payload;
        try { payload = JSON.parse(rawBody.toString('utf8')); } catch { throw new Error('webhook_payload_invalid'); }
        const repositoryName = safeRepositoryName(payload?.repository?.full_name);
        const binding = bindings.get(repositoryName);
        if (!binding) throw new Error('repository_not_registered');
        const push = parsePush(payload, binding);
        if (push.deleted) {
          await store.recordBranchDeletion({ projectId: binding.projectId, repository: binding.name, branch: push.branch, beforeSha: push.beforeSha, deletedAt: now(), deliveryId });
          await store.completeDelivery(deliveryId, now());
          return { status: 'processed', repository: binding.name, branch: push.branch, deleted: true };
        }
        await store.recordBranchSnapshot({ projectId: binding.projectId, repository: binding.name, branch: push.branch, beforeSha: push.beforeSha, headSha: push.headSha, observedAt: now(), source: 'webhook', deliveryId, commits: push.commits });
        await store.completeDelivery(deliveryId, now());
        return { status: 'processed', repository: binding.name, branch: push.branch, headSha: push.headSha, commits: push.commits.length };
      } catch (error) {
        await store.releaseDelivery(deliveryId).catch(() => {});
        throw error;
      }
    },

    async reconcile() {
      if (!github || typeof github.listBranches !== 'function' || typeof github.listCommits !== 'function') throw new Error('github_reconciliation_client_unavailable');
      let branchCount = 0; let commitCount = 0;
      for (const binding of bindings.values()) {
        const reconciliationStartedAt = now();
        const branches = await github.listBranches(binding.name);
        if (!Array.isArray(branches) || !branches.some(branch => branch?.name === binding.defaultBranch)) throw new Error('github_default_branch_missing');
        const branchNames = new Set();
        for (const branch of branches) {
          if (typeof branch.name !== 'string' || !branch.name || !COMMIT_SHA.test(branch.commitSha || '')) throw new Error('github_branch_response_invalid');
          if (branchNames.has(branch.name)) throw new Error('github_branch_response_invalid');
          branchNames.add(branch.name);
          const prior = await store.getBranchHead(binding.projectId, binding.name, branch.name);
          const commits = await github.listCommits(binding.name, branch.name, prior?.sha ? { untilSha: prior.sha } : { stopAtHead: true });
          if (!Array.isArray(commits) || !commits.length || commits[0]?.sha?.toLowerCase() !== branch.commitSha.toLowerCase()) throw new Error('github_commit_head_mismatch');
          await store.recordBranchSnapshot({ projectId: binding.projectId, repository: binding.name, branch: branch.name, beforeSha: null, headSha: branch.commitSha.toLowerCase(), observedAt: reconciliationStartedAt, source: 'reconciliation', deliveryId: null, commits });
          branchCount += 1;
          commitCount += commits.length;
        }
        await store.markMissingBranches({ projectId: binding.projectId, repository: binding.name, presentBranches: [...branchNames], observedAt: reconciliationStartedAt });
      }
      return { repositories: bindings.size, branches: branchCount, commits: commitCount };
    },
  };
}
