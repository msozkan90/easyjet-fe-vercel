const clamp01 = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const normalizeNumber = (value) => {
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return typeof value === "number" ? value : undefined;
};

export const DEFAULT_DESIGN_AREA = Object.freeze({
  x: 0.2,
  y: 0.2,
  width: 0.6,
  height: 0.6,
});

export const normalizeDesignArea = (input) => {
  if (!input) return undefined;
  if (typeof input === "string") {
    try {
      return normalizeDesignArea(JSON.parse(input));
    } catch {
      return undefined;
    }
  }
  const rawX = normalizeNumber(input.x);
  const rawY = normalizeNumber(input.y);
  const rawWidth = normalizeNumber(input.width);
  const rawHeight = normalizeNumber(input.height);

  if (
    rawX === undefined ||
    rawY === undefined ||
    rawWidth === undefined ||
    rawHeight === undefined
  ) {
    return undefined;
  }

  const normalized = {
    x: clamp01(rawX),
    y: clamp01(rawY),
    width: clamp01(rawWidth),
    height: clamp01(rawHeight),
  };

  if (normalized.width <= 0 || normalized.height <= 0) {
    return undefined;
  }

  return normalized;
};

export const serializeDesignArea = (value) => {
  const normalized = normalizeDesignArea(value);
  if (!normalized) return undefined;
  return JSON.stringify(normalized);
};

export const extractDesignAreaFromRecord = (record) => {
  if (!record) return undefined;
  const candidates = [
    record?.design_area,
    record?.designArea,
    record?.config?.design_area,
    record?.config?.designArea,
    record?.settings?.design_area,
    record?.settings?.designArea,
  ];
  if (Array.isArray(record?.images)) {
    record.images.forEach((image) => {
      candidates.push(image?.design_area);
      candidates.push(image?.designArea);
      candidates.push(image?.pivot?.design_area);
    });
  }
  for (const candidate of candidates) {
    const normalized = normalizeDesignArea(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
};
