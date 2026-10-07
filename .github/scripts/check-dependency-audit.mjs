import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const baselinePath = new URL('../dependency-audit-baseline.json', import.meta.url);
const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const allowed = new Set(baseline.allowedHighAndCriticalAdvisoryIds.map(String));

const audit = spawnSync('yarn', ['audit', '--groups', 'dependencies', '--json'], {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});

if (audit.error) {
  console.error(`Dependency audit could not start: ${audit.error.message}`);
  process.exit(1);
}

const records = audit.stdout
  .split('\n')
  .filter(Boolean)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

const advisories = new Map();
for (const record of records) {
  if (record.type !== 'auditAdvisory') continue;
  const advisory = record.data?.advisory;
  if (advisory?.id) advisories.set(String(advisory.id), advisory);
}

if (advisories.size === 0 && audit.status !== 0) {
  console.error(audit.stderr || 'Dependency audit failed without a readable advisory report.');
  process.exit(1);
}

const blocking = [...advisories.values()].filter(
  (advisory) =>
    ['high', 'critical'].includes(advisory.severity) && !allowed.has(String(advisory.id)),
);
const known = [...advisories.values()].filter(
  (advisory) =>
    ['high', 'critical'].includes(advisory.severity) && allowed.has(String(advisory.id)),
);

const summary = [
  '## Dependency audit',
  '',
  `- Known high/critical advisories in the reviewed baseline: ${known.length}`,
  `- New high/critical advisories: ${blocking.length}`,
  `- Baseline reviewed at: ${baseline.reviewedAt}`,
  '',
  'Existing advisories remain visible technical debt; this gate prevents adding newly reported high/critical advisories.',
].join('\n');

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

for (const advisory of blocking) {
  console.error(
    `::error title=New ${advisory.severity} dependency advisory::${advisory.module_name} - advisory ${advisory.id}`,
  );
}

process.exit(blocking.length > 0 ? 1 : 0);
