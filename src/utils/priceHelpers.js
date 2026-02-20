"use strict";

const BASE_PRICE_KEYS = [
  "incoming_price",
  "incomingPrice",
  "base_price",
  "basePrice",
  "company_price",
  "companyPrice",
  "partner_price",
  "partnerPrice",
  "parent_price",
  "parentPrice",
  "price_for_partner",
  "priceForPartner",
  "wholesale_price",
  "wholesalePrice",
];

const NESTED_KEYS = [
  "partner_price",
  "partnerPrice",
  "partner",
  "company",
  "meta",
  "source",
  "data",
  "base_price_source",
  "incoming_price_source",
];

export const toNumeric = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.replace(/\s+/g, "");
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const pickBasePriceInternal = (source, visited, depth) => {
  if (source == null) {
    return undefined;
  }

  const numericDirect = toNumeric(source);
  if (numericDirect !== undefined) {
    return numericDirect;
  }

  if (typeof source !== "object") {
    return undefined;
  }

  if (visited.has(source) || depth > 4) {
    return undefined;
  }

  visited.add(source);

  for (const key of BASE_PRICE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const candidate = source[key];
      const numeric = toNumeric(candidate);
      if (numeric !== undefined) {
        return numeric;
      }
      if (candidate && typeof candidate === "object") {
        const nested = pickBasePriceInternal(candidate, visited, depth + 1);
        if (nested !== undefined) {
          return nested;
        }
      }
    }
  }

  for (const key of NESTED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const nestedSource = source[key];
      if (nestedSource && typeof nestedSource === "object") {
        const nested = pickBasePriceInternal(
          nestedSource,
          visited,
          depth + 1
        );
        if (nested !== undefined) {
          return nested;
        }
      }
    }
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const nested = pickBasePriceInternal(item, visited, depth + 1);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
};

export const pickBasePrice = (source) =>
  pickBasePriceInternal(source, new WeakSet(), 0);

export const formatPrice = (
  value,
  { locale, minimumFractionDigits = 2, maximumFractionDigits = 2 } = {}
) => {
  const numeric = toNumeric(value);
  if (numeric === undefined) {
    return "-";
  }
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numeric);
  } catch {
    return numeric.toFixed(
      Math.max(0, Math.min(6, maximumFractionDigits || 0))
    );
  }
};

