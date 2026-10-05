# Frontend CI/CD Runbook

## Pull request quality gates

All frontend pull requests target `dev`. `Frontend CI` runs:

- `quality`: frozen dependency install, lint, and a production Next.js build.
- `dependency-audit`: reports the reviewed vulnerability baseline and fails on a newly reported high or critical production advisory.
- `secret-scan`: scans full Git history with Gitleaks. Only reviewed idempotency-key documentation examples are fingerprint-ignored.

The dependency baseline keeps existing security debt visible; it does not mark those findings as fixed or risk-free.

Require these exact checks on the protected `dev` branch before merging:

- `quality`
- `dependency-audit`
- `secret-scan`

## Vercel environments

Keep Vercel's Git integration as the deployment mechanism; no long-lived Vercel token is added to GitHub Actions.

- Vercel Production Branch: `main`
- `dev` and feature branches: Preview deployments only
- Production environment variables: configured only in Vercel Production
- Preview environment variables: configured independently in Vercel Preview

A `dev -> main` merge is a release operation and still requires explicit approval under the repository development rules. Vercel records the Git commit for every deployment, so the release remains traceable to its SHA.

`Verify Vercel Production` listens for a successful Vercel Production deployment and performs an HTTPS smoke request against the deployment URL. Vercel's own deployment check remains the source for build failures.

## Rollback

In Vercel, open the project's Deployments page, select the last known-good Production deployment, and use the rollback/promote action to reassign the production domain. Record the restored deployment URL and Git SHA in the release Jira issue.

Do not solve a frontend rollback by force-pushing or committing directly to `main`.
