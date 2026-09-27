export function parseOpenPullRequestBranches(output, repositoryOwner) {
  try {
    const rows = JSON.parse(output);
    if (!Array.isArray(rows) || rows.length >= 1000 || typeof repositoryOwner !== 'string' || repositoryOwner.length === 0) return undefined;
    const branches = new Set();
    for (const row of rows) {
      if (!row || typeof row.headRefName !== 'string' || row.headRefName.length === 0
        || typeof row.headRepositoryOwner?.login !== 'string') return undefined;
      if (row.headRepositoryOwner.login.toLowerCase() === repositoryOwner.toLowerCase()) branches.add(row.headRefName);
    }
    return branches;
  } catch {
    return undefined;
  }
}
