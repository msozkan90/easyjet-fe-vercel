const isEmptyValue = (value) =>
  value === undefined || value === null || value === "";

export const percentToMultiplier = (value) => {
  if (isEmptyValue(value)) {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const multiplier = 1 + numeric / 100;
  return Math.round(multiplier * 10000) / 10000;
};

export const multiplierToPercent = (value) => {
  if (isEmptyValue(value)) {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const percent = (numeric - 1) * 100;
  return Math.round(percent * 100) / 100;
};

export const getPrimaryShipmentMultiplier = (record) => {
  if (!record) return undefined;
  const list = Array.isArray(record?.shipment_multipliers)
    ? record.shipment_multipliers
    : [];
  const validEntry = list.find(
    (item) => !isEmptyValue(item?.multiplier)
  );
  if (validEntry) {
    return validEntry.multiplier;
  }
  const fallback = record?.shipment_multiplier;
  if (isEmptyValue(fallback)) {
    return undefined;
  }
  return fallback;
};

export const getPrimaryProductMultiplier = (record) => {
  if (!record) return undefined;
  const list = Array.isArray(record?.product_multipliers)
    ? record.product_multipliers
    : [];
  const validEntry = list.find((item) => !isEmptyValue(item?.multiplier));
  if (validEntry) {
    return validEntry.multiplier;
  }
  const fallback = record?.product_multiplier;
  if (isEmptyValue(fallback)) {
    return undefined;
  }
  return fallback;
};
