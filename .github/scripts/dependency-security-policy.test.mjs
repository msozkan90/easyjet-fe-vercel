import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAudit, assessAdvisories } from './dependency-security-policy.mjs';
const policy = { version: 1, exceptions: [] };
const high = { id: 42, module_name: 'example-package', severity: 'high' };
const exception = {
  id: '42',
  package: 'example-package',
  severity: 'high',
  owner: 'Security owner',
  reason: 'Temporary mitigation',
  approvedBy: 'Reviewer',
  trackingJira: 'EASYJET-11',
  expiresAt: '2026-11-01',
};
const now = new Date('2026-10-07T00:00:00Z');

test('all high/critical advisories block with an empty policy', () => {
  assert.equal(
    assessAdvisories([high, { ...high, id: 43, severity: 'critical' }], policy).blocking.length,
    2,
  );
  assert.equal(assessAdvisories([{ ...high, severity: 'moderate' }], policy).blocking.length, 0);
});
test('exceptions require exact package/severity and approval metadata', () => {
  assert.equal(
    assessAdvisories([high], { version: 1, exceptions: [exception] }, now).accepted.length,
    1,
  );
  assert.equal(
    assessAdvisories([high], { version: 1, exceptions: [{ ...exception, package: 'other' }] }, now)
      .blocking.length,
    1,
  );
  for (const field of ['owner', 'reason', 'approvedBy', 'trackingJira'])
    assert.throws(() =>
      assessAdvisories([], { version: 1, exceptions: [{ ...exception, [field]: '' }] }, now),
    );
});
test('expired, duplicate and invalid exceptions fail closed', () => {
  assert.throws(() =>
    assessAdvisories(
      [],
      { version: 1, exceptions: [{ ...exception, expiresAt: '2026-10-01' }] },
      now,
    ),
  );
  assert.throws(() =>
    assessAdvisories([], { version: 1, exceptions: [exception, exception] }, now),
  );
  assert.throws(() =>
    assessAdvisories([], { version: 1, exceptions: [{ ...exception, expiresAt: 'invalid' }] }, now),
  );
});
test('audit cannot pass on outage, malformed output or incomplete report', () => {
  for (const output of [
    '',
    'bad-json',
    JSON.stringify({ type: 'error', data: 'Registry unavailable' }),
    JSON.stringify({ type: 'auditSummary', data: { vulnerabilities: { high: 1 } } }),
  ])
    assert.throws(() => parseAudit(output, 1));
  assert.throws(() => parseAudit('', null));
  const summary = {
    type: 'auditSummary',
    data: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
  };
  const report = [
    JSON.stringify({ type: 'auditAdvisory', data: { advisory: high } }),
    JSON.stringify(summary),
  ].join('\n');
  assert.equal(parseAudit(report, 8).advisories.length, 1);
});
