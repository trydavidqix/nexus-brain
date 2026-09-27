const branchKinds = new Set(['codex', 'docs', 'feature', 'fix', 'recovery', 'refactor', 'security']);
const vagueAreas = new Set(['chore', 'changes', 'cleanup', 'final', 'fix', 'misc', 'stuff', 'update', 'wip']);
const vagueSubjects = new Set([
  'changes', 'cleanup', 'final', 'final-final', 'fix', 'misc', 'stuff', 'update', 'update files', 'wip'
]);
const imperativeActions = new Set([
  'add', 'adopt', 'allow', 'apply', 'assert', 'audit', 'block', 'bound', 'build', 'capture',
  'check', 'classify', 'close', 'complete', 'configure', 'connect', 'create', 'deny', 'detect',
  'document', 'enforce', 'ensure', 'expose', 'filter', 'group', 'harden', 'ignore', 'improve',
  'include', 'index', 'integrate', 'introduce', 'keep', 'limit', 'load', 'maintain', 'merge',
  'normalize', 'pin', 'preserve', 'prevent', 'record', 'refine', 'register', 'remove', 'require',
  'resolve', 'restore', 'return', 'run', 'scope', 'secure', 'separate', 'set', 'stabilize',
  'support', 'test', 'track', 'update', 'validate', 'verify', 'wire'
]);

function validateSubject(value, label) {
  if (/\r|\n/.test(value)) return `${label} format: expected one line in "<area>: <imperative action>" form`;
  const match = /^([a-z][a-z0-9-]*): ([A-Za-z][A-Za-z0-9'-]*)(?: (.+))?$/.exec(value);
  if (!match) return `${label} format: expected "<area>: <imperative action>"`;

  const [, area, action, target] = match;
  if (!target) return `${label} target: add a concrete target after the imperative action`;
  const actionText = `${action} ${target}`;
  if (vagueAreas.has(area) || vagueSubjects.has(actionText.toLowerCase())) {
    return `${label} vague: choose a concrete area and action`;
  }

  if (!imperativeActions.has(action.toLowerCase())) {
    return `${label} imperative: start the action with an imperative verb`;
  }
  return undefined;
}

function validateBranch(value) {
  const separator = value.indexOf('/');
  if (separator < 1 || separator !== value.lastIndexOf('/')) {
    return 'branch format: expected "<kind>/<task-id>-<short-slug>"';
  }

  const kind = value.slice(0, separator);
  if (!branchKinds.has(kind)) return `branch kind: unsupported kind "${kind}"`;

  const taskAndSlug = value.slice(separator + 1);
  const match = /^([a-z]+-?\d+(?:\.\d+)?)-(.+)$/i.exec(taskAndSlug);
  if (!match) return 'branch task ID: expected an alphabetic task key with digits, followed by a kebab-case slug';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(match[2])) return 'branch slug: use lowercase kebab-case';
  return undefined;
}

function main(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--subject', '--pr-title', '--branch'].includes(flag) || value === undefined || value.startsWith('--')) {
      console.error('git naming: usage error; pass --subject, --pr-title, or --branch with a value');
      process.exitCode = 2;
      return;
    }
    if (values.has(flag)) {
      console.error(`git naming: duplicate option ${flag}`);
      process.exitCode = 2;
      return;
    }
    values.set(flag, value);
  }

  if (values.size === 0) {
    console.error('git naming: usage error; pass --subject, --pr-title, or --branch with a value');
    process.exitCode = 2;
    return;
  }

  const errors = [];
  for (const [flag, label] of [['--subject', 'commit subject'], ['--pr-title', 'pull request title']]) {
    if (values.has(flag)) {
      const error = validateSubject(values.get(flag), label);
      if (error) errors.push(error);
    }
  }
  if (values.has('--branch')) {
    const error = validateBranch(values.get('--branch'));
    if (error) errors.push(error);
  }

  if (errors.length) {
    for (const error of errors) console.error(`git naming: FAIL: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('git naming: PASS');
}

main(process.argv.slice(2));
