import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/app/api/file-proxy/route.js', import.meta.url), 'utf8');
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('provider errors do not expose signed URLs or raw error messages', async (t) => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('private-provider-response signed-token=test-only'); };
  t.after(() => { globalThis.fetch = previous; });
  const target = 'https://api.shipstation.com/labels/test.pdf?token=test-only';
  const response = await GET(new Request(`http://localhost/api/file-proxy?url=${encodeURIComponent(target)}`));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, message: 'Download request failed.' });
});

test('non-allowed targets remain rejected without making a provider request', async () => {
  const response = await GET(new Request('http://localhost/api/file-proxy?url=https://example.test/file'));
  assert.equal(response.status, 400);
});

test('successful label downloads retain content and download filename', async (t) => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response('test-only-pdf', { headers: { 'content-type': 'application/pdf' } });
  t.after(() => { globalThis.fetch = previous; });
  const target = 'https://api.shipstation.com/labels/test.pdf';
  const response = await GET(new Request(`http://localhost/api/file-proxy?download=1&url=${encodeURIComponent(target)}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /test.pdf/);
  assert.equal(await response.text(), 'test-only-pdf');
});
