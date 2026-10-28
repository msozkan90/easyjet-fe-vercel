"use client";

// Apparel sizes in wearing order; anything else (e.g. "40x60 cm") is sorted
// naturally so numbers compare as numbers.
const APPAREL_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL"];
const apparelRank = (name) => APPAREL_SIZES.indexOf(String(name || "").trim().toUpperCase());

export const compareSizes = (a, b) => {
  const rankA = apparelRank(a.name);
  const rankB = apparelRank(b.name);
  if (rankA !== -1 || rankB !== -1) {
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  }
  return String(a.name).localeCompare(String(b.name), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const sortSizes = (sizes = []) => [...sizes].sort(compareSizes);

export const variantKey = (sizeId, colorId) => `${sizeId}:${colorId}`;

/** First image of each color, used for card hover previews. */
export const imagesByColor = (variants = []) => {
  const map = new Map();
  variants.forEach((variant) => {
    if (variant.image_url && !map.has(variant.color.id)) {
      map.set(variant.color.id, variant.image_url);
    }
  });
  return map;
};

export const firstImage = (variants = []) =>
  variants.find((variant) => variant.image_url)?.image_url || null;

/**
 * Image for a size/color: the exact variant, else the same color, else the
 * same size, else any image. `exact` tells whether it belongs to the selection.
 */
export const resolveVariantImage = (variants = [], sizeId, colorId) => {
  const withImage = variants.filter((variant) => variant.image_url);
  const exact = withImage.find(
    (variant) => variant.size.id === sizeId && variant.color.id === colorId,
  );
  if (exact) return { url: exact.image_url, exact: true };
  const fallback =
    withImage.find((variant) => variant.color.id === colorId) ||
    withImage.find((variant) => variant.size.id === sizeId) ||
    withImage[0];
  return { url: fallback?.image_url || null, exact: false };
};

const isLightHex = (hex) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
};

/**
 * Round color sample. Colors without a hex code show their initial on a
 * neutral background so they are still distinguishable.
 */
export function ColorDot({ color, size = 28, className = "" }) {
  const hex = color?.hex_code;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase ${
        hex ? "" : "bg-muted text-text-secondary"
      } ${hex && !isLightHex(hex) ? "" : "border border-line-strong"} ${className}`.trim()}
      style={{ width: size, height: size, ...(hex ? { background: hex } : {}) }}
      aria-hidden="true"
    >
      {hex ? null : String(color?.name || "?").trim().charAt(0)}
    </span>
  );
}
