const API_ROOT = 'https://api.github.com';
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function retryDelay(response, attempt, random) {
  const retryAfter = response?.headers?.get('retry-after');
  if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter)) return Math.min(10_000, Number(retryAfter) * 1000);
  const reset = response?.headers?.get('x-ratelimit-reset');
  const remaining = response?.headers?.get('x-ratelimit-remaining');
  if (response?.status === 403 && remaining === '0' && /^\d+$/.test(reset || '')) return Math.min(10_000, Math.max(0, Number(reset) * 1000 - Date.now()));
  const ceiling = Math.min(5000, 250 * (2 ** attempt));
  return Math.floor(ceiling * (0.5 + Math.min(1, Math.max(0, random()))));
}

export function createGitHubRestClient({ token, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random, maxRetries = 2, maxPages = 10, perPage = 100 } = {}) {
  if (typeof fetchImpl !== 'function' || typeof sleep !== 'function' || typeof random !== 'function') throw new Error('github_client_dependencies_invalid');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20 || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) throw new Error('github_client_limits_invalid');
  if (token !== undefined && (typeof token !== 'string' || !token.trim() || token !== token.trim())) throw new Error('github_token_invalid');

  async function get(url) {
    let lastStatus = 0;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
        if (token) headers.Authorization = `Bearer ${token}`;
        response = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal, redirect: 'error' });
      } catch {
        clearTimeout(timeout);
        if (attempt === maxRetries) throw new Error('github_request_failed');
        await sleep(retryDelay(null, attempt, random));
        continue;
      }
      clearTimeout(timeout);
      lastStatus = response.status;
      const rateLimit = response.status === 403 && response.headers?.get('x-ratelimit-remaining') === '0';
      if ((RETRYABLE_STATUS.has(response.status) || rateLimit) && attempt < maxRetries) {
        const delay = retryDelay(response, attempt, random);
        await response.body?.cancel().catch(() => {});
        await sleep(delay);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error(`github_http_${response.status}`);
      }
      try { return await response.json(); } catch { throw new Error('github_response_invalid'); }
    }
    throw new Error(`github_http_${lastStatus || 0}`);
  }

  async function listPages(path, { mapItem, onPage, pageSize = perPage } = {}) {
    const output = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(path, API_ROOT);
      url.searchParams.set('per_page', String(pageSize));
      url.searchParams.set('page', String(page));
      const rows = await get(url);
      if (!Array.isArray(rows)) throw new Error('github_response_invalid');
      for (const row of rows) {
        const item = mapItem(row);
        if (!item) throw new Error('github_response_invalid');
        output.push(item);
      }
      if (onPage && onPage(rows, output)) return output;
      if (rows.length < pageSize) return output;
    }
    throw new Error('github_pagination_limit_reached');
  }

  function repoPath(repository) {
    if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) throw new Error('github_repository_invalid');
    return `/repos/${repository.split('/').map(encodeURIComponent).join('/')}`;
  }

  return {
    async listBranches(repository) {
      return listPages(`${repoPath(repository)}/branches`, { mapItem: row => typeof row?.name === 'string' && /^[A-Za-z0-9._/-]{1,255}$/.test(row.name) && /^[a-f0-9]{40,64}$/i.test(row.commit?.sha || '') ? { name: row.name, commitSha: row.commit.sha.toLowerCase() } : null });
    },
    async listCommits(repository, branch, { untilSha, stopAtHead = false } = {}) {
      if (typeof branch !== 'string' || !branch || branch.length > 255) throw new Error('github_branch_invalid');
      if (untilSha !== undefined && !/^[a-f0-9]{40,64}$/i.test(untilSha)) throw new Error('github_commit_sha_invalid');
      const path = `${repoPath(repository)}/commits?sha=${encodeURIComponent(branch)}`;
      return listPages(path, { mapItem: row => {
        const sha = row?.sha;
        const message = row?.commit?.message;
        const date = row?.commit?.author?.date;
        if (!/^[a-f0-9]{40,64}$/i.test(sha || '') || typeof message !== 'string' || typeof date !== 'string' || !Number.isFinite(new Date(date).getTime())) return null;
        return { sha: sha.toLowerCase(), message: message.slice(0, 1000), author: typeof row.author?.login === 'string' ? row.author.login.slice(0, 200) : 'unknown', committedAt: new Date(date).toISOString(), url: typeof row.html_url === 'string' && row.html_url.startsWith('https://github.com/') ? row.html_url : null };
      }, pageSize: stopAtHead ? 1 : perPage, onPage: (_rows, output) => stopAtHead || (untilSha ? output.some(commit => commit.sha === untilSha.toLowerCase()) : false) });
    },
  };
}
