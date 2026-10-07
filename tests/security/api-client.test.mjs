import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const axiosModule = pathToFileURL(require.resolve('axios')).href;
let sequence = 0;
async function loadClient(t) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = { dispatchEvent() {}, location: { pathname: '/dashboard', replace() {} } };
  globalThis.document = { cookie: 'csrf_token=test-only-csrf' };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  const source = (await readFile(new URL('../../src/utils/http.js', import.meta.url), 'utf8'))
    .replace('from "axios"', `from ${JSON.stringify(axiosModule)}`);
  // Load the existing Next ES module without changing package.json's module type.
  return (await import(`data:text/javascript;base64,${Buffer.from(source + '\n// instance ' + sequence++).toString('base64')}`)).default;
}
const ok = (config) => ({ data: { success: true }, status: 200, statusText: 'OK', headers: {}, config });

test('updated Axios preserves credentials, CSRF and repeated array query parameters', async (t) => {
  const http = await loadClient(t);
  let request;
  http.defaults.adapter = async (config) => { request = config; return ok(config); };
  await http.post('/orders', { id: 'test-order' });
  assert.equal(request.withCredentials, true);
  assert.equal(request.headers.get('x-csrf-token'), 'test-only-csrf');
  assert.equal(http.getUri({ url: '/orders', params: { ids: ['a', 'b'], empty: null } }), `${http.defaults.baseURL}/orders?ids=a&ids=b`);
});

test('401 refreshes once and retries while 403 does not refresh', async (t) => {
  const http = await loadClient(t);
  let refreshes = 0;
  let calls = 0;
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') { refreshes++; return ok(config); }
    calls++;
    if (!config._retry) throw { config, response: { status: 401 } };
    return ok(config);
  };
  await http.get('/orders');
  assert.equal(refreshes, 1);
  assert.equal(calls, 2);
  http.defaults.adapter = async (config) => { throw { config, response: { status: 403 } }; };
  await assert.rejects(http.get('/orders'));
  assert.equal(refreshes, 1);
});

test('login 401 does not create an infinite refresh loop', async (t) => {
  const http = await loadClient(t);
  let calls = 0;
  http.defaults.adapter = async (config) => { calls++; throw { config, response: { status: 401 } }; };
  await assert.rejects(http.post('/auth/login', {}));
  assert.equal(calls, 1);
});
