export function parseAudit(stdout, status) {
  if (!Number.isInteger(status) || status < 0 || status > 31)
    throw new Error('Audit process failed');
  const advisories = new Map();
  let summary;
  for (const line of stdout.split('\n').filter((line) => line.trim())) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Error('Invalid audit report');
    }
    if (record.type === 'error') throw new Error('Audit registry reported an error');
    if (record.type === 'auditSummary') summary = record.data;
    if (record.type === 'auditAdvisory') {
      const advisory = record.data?.advisory;
      if (
        !advisory?.id ||
        !advisory.module_name ||
        !['info', 'low', 'moderate', 'high', 'critical'].includes(advisory.severity)
      )
        throw new Error('Invalid advisory');
      advisories.set(String(advisory.id), advisory);
    }
  }
  if (
    !summary?.vulnerabilities ||
    ['info', 'low', 'moderate', 'high', 'critical'].some(
      (severity) =>
        !Number.isInteger(summary.vulnerabilities[severity]) ||
        summary.vulnerabilities[severity] < 0,
    )
  )
    throw new Error('Missing audit summary');
  if (
    (summary.vulnerabilities.high > 0 || summary.vulnerabilities.critical > 0) &&
    ![...advisories.values()].some((a) => ['high', 'critical'].includes(a.severity))
  )
    throw new Error('Incomplete audit report');
  return { advisories: [...advisories.values()], summary };
}
export function assessAdvisories(advisories, policy, now = new Date()) {
  if (policy?.version !== 1 || !Array.isArray(policy.exceptions))
    throw new Error('Invalid security policy');
  const allowed = new Map();
  for (const entry of policy.exceptions) {
    for (const field of [
      'id',
      'package',
      'severity',
      'owner',
      'reason',
      'approvedBy',
      'trackingJira',
      'expiresAt',
    ]) {
      if (typeof entry[field] !== 'string' || !entry[field].trim())
        throw new Error('Exception metadata is required: ' + field);
    }
    if (!['high', 'critical'].includes(entry.severity) || !/^EASYJET-\d+$/.test(entry.trackingJira))
      throw new Error('Invalid exception scope');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresAt) ||
      !Number.isFinite(Date.parse(entry.expiresAt)) ||
      Date.parse(entry.expiresAt) <= now.getTime()
    )
      throw new Error('Expired or invalid security exception');
    if (allowed.has(entry.id)) throw new Error('Duplicate security exception');
    allowed.set(entry.id, entry);
  }
  const blocking = [];
  const accepted = [];
  for (const advisory of advisories.filter((a) => ['high', 'critical'].includes(a.severity))) {
    const exception = allowed.get(String(advisory.id));
    (exception?.package === advisory.module_name && exception.severity === advisory.severity
      ? accepted
      : blocking
    ).push(advisory);
  }
  return { blocking, accepted };
}
