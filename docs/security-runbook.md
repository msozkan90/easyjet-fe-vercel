# Frontend security maintenance — EASYJET-11

Next.js remains on the patched 15.5 maintenance line; Axios and Moment are patched without changing API/business flows. PostCSS is overridden within v8 because Next pins an older vulnerable release. Nanoid stays on v3. Keep `yarn.lock` and verify image/stylesheet rendering after updates.

```sh
yarn install --frozen-lockfile
node --test .github/scripts/*.test.mjs
node .github/scripts/check-dependency-audit.mjs
yarn test:security
yarn lint
yarn build
```

CI has one `quality` job. Production high/critical advisories block unless an explicit, reviewed, unexpired exception exists in `.github/dependency-security-policy.json` (initially empty). Each exception requires exact advisory/package/severity, named owner, reason/mitigation, approving reviewer, Jira key and future expiration date. The repository maintainer reviews dependency reports weekly. Audit outage/malformed output fails closed; full-history Gitleaks runs with redaction. No paid scanners or additional runners are required, but GitHub Free private-repository minutes are finite.

Dependabot version-update proposals target **dev**, grouped minor/patch weekly (one npm PR maximum), with monthly action updates. No auto-merge; assign a new Jira task/key and retitle the bot PR before merge. GitHub loads this config from the default branch: when main is default, dev-only configuration is not yet active. Activation requires a separately approved release PR, not a direct main push. Automatic security-update PRs target the default branch regardless of `target-branch`; do not enable main-targeting automatic PRs as a shortcut. Repository settings are not changed by this task.

`.env.example` contains public configuration only. Start development with the existing private `.env.local`, `yarn dev` (port 3001), and backend on port 3000. Existing local values are untouched. **Every `NEXT_PUBLIC_*` value is public and embedded at build time**: never use JWT/provider/server secrets here. The optional Google Maps browser key is intentionally public; restrict website referrers, permitted APIs and quotas in Google Cloud. That key's rotation requires a frontend rebuild/redeployment, then old-key revocation after verification; it cannot be hot-reloaded from a server secret manager.

Raw provider/error objects are no longer printed to the browser console. The file-proxy error response is generic instead of exposing signed URLs or provider error messages. Success responses, downloads and authentication remain unchanged. Operational masking does not change business audit records. Do not log request headers, cookies, API payloads, user contact data or arbitrary errors. Historical leaks require separate log-access/retention review and approved secret rotation; this task does not delete existing logs or rotate live credentials.

Manual smoke: login/logout, company/partner/customer dashboards, product sizes/prices/stock, order detail, label download, address lookup (with a restricted test browser key), then browser console inspection for absence of raw payloads/tokens. Use a non-production test account; do not purchase real shipping labels as a smoke test.

BE/FE merge order is independent; no API/schema migration. Production deployment needs separate approval. A rollback to a prior Vercel deployment can reintroduce the vulnerabilities patched here; record it as temporary and remediate promptly. Full backend secret-rotation instructions: [backend runbook](https://github.com/sanyo-byte/easyjet-be/blob/dev/docs/security-runbook.md).
