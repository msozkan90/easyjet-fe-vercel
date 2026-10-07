import { readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseAudit, assessAdvisories } from './dependency-security-policy.mjs';

try {
  const policy = JSON.parse(
    readFileSync(new URL('../dependency-security-policy.json', import.meta.url), 'utf8'),
  );
  const audit = spawnSync('yarn', ['audit', '--groups', 'dependencies', '--json'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120000,
  });
  if (audit.error || audit.signal) throw new Error('Dependency audit could not complete');
  const { advisories, summary } = parseAudit(audit.stdout, audit.status);
  const { blocking, accepted } = assessAdvisories(advisories, policy);
  const report = [
    '## Production dependency security',
    '- High/critical blocking advisories: ' + blocking.length,
    '- Explicit, unexpired exceptions: ' + accepted.length,
    '- Moderate advisories: ' + summary.vulnerabilities.moderate,
  ].join('\n');
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  for (const advisory of blocking)
    console.error(
      'Blocked dependency: ' +
        advisory.module_name +
        ' / advisory ' +
        advisory.id +
        ' / ' +
        advisory.severity,
    );
  process.exitCode = blocking.length ? 1 : 0;
} catch (error) {
  // Registry stderr/response bodies may contain credentials.
  console.error('Dependency security gate failed: ' + error.message);
  process.exitCode = 1;
}
