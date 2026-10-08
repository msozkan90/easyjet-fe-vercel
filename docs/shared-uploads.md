# Upload attempts — EASYJET-13

Order, PDF/design-flaw and transfer upload queues send an `idempotency_key` on
direct-upload initialization. It is stable for each task/file attempt; a deliberate
retry of a failed/canceled task creates a new task ID/key. Files still go directly
to S3; upload quantities, pricing and design metadata remain unchanged.

Backend supports the field optionally, so deploy/merge **backend before frontend**.
Old backend strict schemas reject the new field. Rollback **frontend before backend**;
drain in-flight uploads and reconcile new backend session states first. No migration
or additional frontend environment variable is required.

Validation: `yarn test:security`, `yarn lint`, `yarn build`. For a local UI smoke,
upload a small design in each queue, check there is one result, cancel an active
upload before saving and retry. The retry must use a different task/key. Production
S3 CORS/lifecycle settings are release checks, not changed by this PR.
