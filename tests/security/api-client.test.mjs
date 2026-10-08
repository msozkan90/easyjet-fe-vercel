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

test('concurrent first writes seed once and support API-domain-only cookies', async (t) => {
  const http = await loadClient(t);
  globalThis.document.cookie = '';
  let seeds = 0;
  const writes = [];
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/csrf') {
      seeds++;
      return { ...ok(config), data: { csrfToken: 'signed-test-token' } };
    }
    writes.push(config);
    return ok(config);
  };
  await Promise.all([http.post('/orders', {}), http.post('/auth/login', {})]);
  assert.equal(seeds, 1);
  assert.equal(writes.length, 2);
  assert.ok(writes.every((request) => request.headers.get('x-csrf-token') === 'signed-test-token'));
});

test('a rejected seed prevents the original write from being sent', async (t) => {
  const http = await loadClient(t);
  globalThis.document.cookie = '';
  let writes = 0;
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/csrf') throw { config, response: { status: 503 } };
    writes++;
    return ok(config);
  };
  await assert.rejects(http.post('/orders', {}));
  assert.equal(writes, 0);
});

test('only a missing legacy seed route permits frontend-first backward compatibility', async (t) => {
  const http = await loadClient(t);
  globalThis.document.cookie = '';
  let writes = 0;
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/csrf') throw { config, response: { status: 404 } };
    writes++;
    return ok(config);
  };
  await http.post('/auth/login', {});
  assert.equal(writes, 1);
});

test('rotated authentication tokens are used on refresh retry without persistent storage', async (t) => {
  const http = await loadClient(t);
  let finalRequest;
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') return { ...ok(config), headers: { 'x-csrf-token': 'rotated-test-token' } };
    if (!config._retry) throw { config, response: { status: 401 } };
    finalRequest = config;
    return ok(config);
  };
  await http.post('/orders', {});
  assert.equal(finalRequest.headers.get('x-csrf-token'), 'rotated-test-token');
});

test('only the pre-business CSRF_INVALID code can reseed and retry a write once', async (t) => {
  const http = await loadClient(t);
  let seeds = 0;
  let writes = 0;
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/csrf') {
      seeds++;
      return { ...ok(config), data: { csrfToken: 'upgraded-test-token' } };
    }
    writes++;
    if (!config._csrfRetry) throw { config, response: { status: 403, data: { error: { code: 'CSRF_INVALID' } } } };
    assert.equal(config.headers.get('x-csrf-token'), 'upgraded-test-token');
    return ok(config);
  };
  await http.post('/orders', {});
  assert.equal(seeds, 1);
  assert.equal(writes, 2);
  http.defaults.adapter = async (config) => { throw { config, response: { status: 403, data: { error: { code: 'CSRF_INVALID' } } } }; };
  await assert.rejects(http.post('/orders', {}));
});
