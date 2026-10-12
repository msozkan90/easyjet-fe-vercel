// Single status → tone map shared by orders, transfer orders, payments,
// labels and entities. Tones map to CSS classes in globals.css
// (.ej-status--<tone>), so the same meaning always gets the same color.

export const STATUS_TONES = Object.freeze({
  INFO: "info",
  WAITING: "waiting",
  PRODUCTION: "production",
  PRINTED: "printed",
  SUCCESS: "success",
  SHIPPED: "shipped",
  DANGER: "danger",
  REFUND: "refund",
  NEUTRAL: "neutral",
});

const T = STATUS_TONES;

const TONE_BY_STATUS = {
  // order / transfer order lifecycle
  neworder: T.INFO,
  new: T.INFO,
  created: T.INFO,
  open: T.INFO,
  waitingfordesign: T.WAITING,
  pending: T.WAITING,
  waiting: T.WAITING,
  awaitingpayment: T.WAITING,
  awaitingshipment: T.WAITING,
  readyforproduction: T.PRODUCTION,
  processing: T.PRODUCTION,
  inproduction: T.PRODUCTION,
  production: T.PRODUCTION,
  pdf: T.PRODUCTION,
  downloaded: T.PRINTED,
  printed: T.PRINTED,
  completed: T.SUCCESS,
  shipped: T.SHIPPED,
  delivered: T.SHIPPED,
  intransit: T.SHIPPED,
  designflaw: T.DANGER,
  refund: T.REFUND,
  remake: T.REFUND,
  refunded: T.REFUND,
  reordered: T.REFUND,
  cancel: T.NEUTRAL,
  canceled: T.NEUTRAL,
  cancelled: T.NEUTRAL,

  // finance, labels, entities
  approved: T.SUCCESS,
  active: T.SUCCESS,
  success: T.SUCCESS,
  succeeded: T.SUCCESS,
  paid: T.SUCCESS,
  purchased: T.SUCCESS,
  credit: T.SUCCESS,
  rejected: T.DANGER,
  failed: T.DANGER,
  error: T.DANGER,
  errorvoid: T.DANGER,
  blocked: T.DANGER,
  debit: T.DANGER,
  voided: T.NEUTRAL,
  autovoid: T.NEUTRAL,
  inactive: T.NEUTRAL,
};

export const normalizeStatusKey = (status) =>
  String(status ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function getStatusTone(status, fallback = T.NEUTRAL) {
  return TONE_BY_STATUS[normalizeStatusKey(status)] || fallback;
}
