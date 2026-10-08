import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../../src/utils/uploadIdempotency.js', import.meta.url), 'utf8');
const { uploadIdempotencyKey } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('upload identities are stable per attempt and distinct per file or retry', () => {
  assert.equal(uploadIdempotencyKey('task-attempt-1', 0), uploadIdempotencyKey('task-attempt-1', 0));
  assert.notEqual(uploadIdempotencyKey('task-attempt-1', 0), uploadIdempotencyKey('task-attempt-1', 1));
  assert.notEqual(uploadIdempotencyKey('task-attempt-1', 0), uploadIdempotencyKey('task-attempt-2', 0));
  assert.ok(uploadIdempotencyKey('x'.repeat(100), 10000).length <= 128);
});
test('invalid upload identity is rejected before an API call', () => {
  for (const [id, index] of [['', 0], ['short', 0], ['x'.repeat(101), 0], ['valid-task-id', -1], ['valid-task-id', 0.5]]) {
    assert.throws(() => uploadIdempotencyKey(id, index), /Invalid upload identity/);
  }
});
