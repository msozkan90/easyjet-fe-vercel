const REQUEST_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const TRACEPARENT = /^00-(?!0{32})[a-f0-9]{32}-(?!0{16})[a-f0-9]{16}-(00|01)$/;
const categories = new Set(['http', 'runtime', 'unhandledrejection', 'react']);

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function createRequestContext(previous) {
  const requestId = previous?.requestId || (crypto.randomUUID?.() ?? randomHex(16));
  const traceId = previous?.traceId || randomHex(16);
  const spanId = randomHex(8);
  const ratio = Number(process.env.NEXT_PUBLIC_TRACE_SAMPLE_RATIO ?? 0.1);
  const flags = previous?.flags || (Math.random() < Math.max(0, Math.min(1, ratio)) ? '01' : '00');
  return { requestId, traceId, flags, traceparent: `00-${traceId}-${spanId}-${flags}` };
}
export function safeReport(category, input = {}) {
  if (!categories.has(category)) return null;
  return {
    category,
    ...(REQUEST_ID.test(input.requestId || '') && { requestId: input.requestId }),
    ...(TRACEPARENT.test(input.traceparent || '') && { traceparent: input.traceparent }),
    ...(Number.isInteger(input.status) && input.status >= 0 && input.status <= 599 && { status: input.status }),
  };
}
let transport;
let sent = 0;
let windowStart = 0;
export function setTelemetryTransport(send) { transport = send; }
export function reportError(category, input) {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'true' || !transport) return;
  const report = safeReport(category, input);
  if (!report) return;
  if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); sent = 0; }
  if (sent >= 20) return;
  sent++;
  // Monitoring never blocks a business request and never retries a failed report.
  void Promise.resolve().then(() => transport(report)).catch(() => {});
}
export function installErrorMonitoring() {
  const runtime = () => reportError('runtime');
  const rejection = (event) => {
    // HTTP failures are already reported with their own request context.
    if (event.reason?.isAxiosError) return;
    reportError('unhandledrejection');
  };
  window.addEventListener('error', runtime);
  window.addEventListener('unhandledrejection', rejection);
  return () => {
    window.removeEventListener('error', runtime);
    window.removeEventListener('unhandledrejection', rejection);
  };
}
