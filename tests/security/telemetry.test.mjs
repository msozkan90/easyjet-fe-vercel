import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReport, createRequestContext, reportError, setTelemetryTransport, installErrorMonitoring } from '../../src/utils/telemetry.mjs';

test('browser reports discard errors, stacks, URLs, credentials and personal data', () => {
  const context = createRequestContext();
  const report = safeReport('http', { ...context, status: 503, message: 'secret', stack: 'secret', url: '/orders/private-id?email=person@example.test', body: { password: 'secret' } });
  assert.deepEqual(Object.keys(report).sort(), ['category', 'requestId', 'status', 'traceparent']);
  assert.equal(safeReport('arbitrary-label'), null);
  assert.deepEqual(safeReport('runtime', { requestId: 'person@example.test', traceparent: 'invalid', status: 999 }), { category: 'runtime' });
});
test('monitoring bounds error storms and tolerates transport failure without throwing', async () => {
  const oldWindow = globalThis.window;
  const oldFlag = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED;
  globalThis.window = {};
  process.env.NEXT_PUBLIC_TELEMETRY_ENABLED = 'true';
  let calls = 0;
  setTelemetryTransport(() => { calls++; throw new Error('unavailable'); });
  try {
    for (let i = 0; i < 100; i++) reportError('runtime', { message: 'secret' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls, 20);
  } finally {
    globalThis.window = oldWindow;
    if (oldFlag === undefined) delete process.env.NEXT_PUBLIC_TELEMETRY_ENABLED;
    else process.env.NEXT_PUBLIC_TELEMETRY_ENABLED = oldFlag;
  }
});
test('runtime listeners clean up and Axios rejections are not reported twice', () => {
  const oldWindow = globalThis.window;
  const listeners = new Map();
  globalThis.window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); },
  };
  try {
    const cleanup = installErrorMonitoring();
    assert.equal(listeners.size, 2);
    listeners.get('unhandledrejection')({ reason: { isAxiosError: true } });
    cleanup();
    assert.equal(listeners.size, 0);
  } finally { globalThis.window = oldWindow; }
});
