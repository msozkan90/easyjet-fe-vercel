# Frontend CI/CD Runbook

## Branch flow

Work directly on `dev`. Release by opening a `dev -> main` pull request; Vercel deploys `main` after the merge. Dependabot proposals still target `dev`.

## Pull request quality gates

`Frontend CI` runs on pull requests into `main` and `dev` (no push trigger) as one required `quality` job, so a single hosted runner executes every gate:

- Frozen dependency install, lint, and a production Next.js build.
- Production dependency audit that blocks all high/critical advisories unless an explicit, reviewed, unexpired exception exists.
- Full Git history secret scan with Gitleaks. Only reviewed idempotency-key documentation examples are fingerprint-ignored.

The old blanket baseline has been removed. See [security maintenance](security-runbook.md) for exception review, dev-targeted dependency updates and secret/log handling.

The workflow pins `ubuntu-24.04` instead of following the moving `ubuntu-latest` alias. All gates are sequential steps in the same job; they do not allocate separate runners.

`main` is protected: changes arrive only through a pull request, the `quality` check must pass, and conversations must be resolved, for administrators too. `dev` is unprotected so work can be pushed directly. Any failed sub-step fails that single check.

## Vercel environments

Keep Vercel's Git integration as the deployment mechanism; no long-lived Vercel token is added to GitHub Actions.

- Vercel Production Branch: `main`
- `dev` and feature branches: Preview deployments only
- Production environment variables: configured only in Vercel Production
- Preview environment variables: configured independently in Vercel Preview

A `dev -> main` merge is a release operation. If Vercel's production build fails, the previous production deployment keeps serving traffic. Vercel records the Git commit for every deployment, so the release remains traceable to its SHA.

Vercel's own deployment status remains the source for deployment build and availability failures. GitHub does not start a second workflow for every preview deployment, which keeps the Actions history and runner usage minimal.

## Rollback

In Vercel, open the project's Deployments page, select the last known-good Production deployment, and use the rollback/promote action to reassign the production domain. Record the restored deployment URL and Git SHA in the release Jira issue.

Do not solve a frontend rollback by force-pushing or committing directly to `main`.
