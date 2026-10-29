"use client";

import { useState } from "react";
import { DownOutlined, PictureOutlined } from "@ant-design/icons";
import { normalizeDesignArea } from "@/utils/designArea";

const percent = (value) => `${Math.round(value * 1000) / 10}%`;

// Frame colors tried against the product color; the one that stands out most wins.
const FRAME_COLORS = ["#C4560B", "#0F2433", "#FFFFFF"];
const DEFAULT_FRAME = FRAME_COLORS[0];

const toRgb = (hex) => {
  const value = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
};

const luminance = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Print area frame for a product color. Brand orange is kept while it is
 * readable (WCAG 3:1 for graphics); otherwise ink or white, whichever
 * contrasts more, so the frame never blends into a same/similar color.
 */
export const POSITIONS_TRANSITION_MS = 300;

export const printAreaColors = (productHex) => {
  const background = toRgb(productHex);
  let frame = DEFAULT_FRAME;
  if (background) {
    const [brand, ...fallbacks] = FRAME_COLORS;
    frame =
      contrast(toRgb(brand), background) >= 3
        ? brand
        : fallbacks.reduce((best, color) =>
            contrast(toRgb(color), background) > contrast(toRgb(best), background) ? color : best,
          );
  }
  const rgb = toRgb(frame);
  return {
    frame,
    fill: `rgba(${rgb.join(", ")}, 0.12)`,
    label: luminance(rgb) > 0.5 ? "#0F2433" : "#FFFFFF",
  };
};

/**
 * Position mockup with its printable area. `design_area` is stored as
 * fractions of the image, so the overlay sits in a box that has exactly the
 * image's rendered size. Mockups are transparent and tinted with the selected
 * color, like on the order design screen.
 */
function PositionCard({ position, colorHex, colors, t }) {
  const [imageIndex, setImageIndex] = useState(0);
  const area = normalizeDesignArea(position.design_area);
  const images = position.image_urls || [];
  const imageUrl = images[Math.min(imageIndex, images.length - 1)];

  return (
    <article
      id={`position-${position.id}`}
      className="flex scroll-mt-4 flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="m-0 truncate text-sm font-semibold text-text">{position.name}</h3>
        {images.length > 1 ? (
          <div role="group" aria-label={t("positionViews")} className="flex shrink-0 gap-1">
            {images.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-pressed={index === imageIndex}
                aria-label={t("positionView", { index: index + 1 })}
                onClick={() => setImageIndex(index)}
                className={`h-6 min-w-6 cursor-pointer rounded-md border px-1.5 text-xs font-medium transition-colors ${
                  index === imageIndex
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-line bg-surface text-text-secondary hover:border-line-strong"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center bg-subtle p-4">
        {imageUrl ? (
          <div className="relative w-full max-w-[320px]">
            <img
              key={imageUrl}
              src={imageUrl}
              alt={position.name}
              loading="lazy"
              className="block h-auto w-full rounded-lg"
              style={colorHex ? { backgroundColor: colorHex } : undefined}
            />
            {area ? (
              <div
                className="pointer-events-none absolute rounded-[3px] border-2 border-dashed"
                style={{
                  left: percent(area.x),
                  top: percent(area.y),
                  width: percent(area.width),
                  height: percent(area.height),
                  borderColor: colors.frame,
                  backgroundColor: colors.fill,
                }}
                aria-hidden="true"
              >
                <span
                  className="absolute -top-px left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-t px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: colors.frame, color: colors.label }}
                >
                  {t("printArea")}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex aspect-[4/5] w-full max-w-[240px] flex-col items-center justify-center gap-2 text-ink-300">
            <PictureOutlined className="text-3xl" aria-hidden="true" />
            <span className="text-xs text-text-secondary">{t("noImage")}</span>
          </div>
        )}
      </div>

      {area ? null : (
        <p className="m-0 border-t border-line px-4 py-2.5 text-xs text-text-secondary">{t("noPrintArea")}</p>
      )}
    </article>
  );
}

/** Collapsible list of print positions; closed by default. */
export default function PrintPositions({ positions, colorHex, open, onOpenChange, t }) {
  if (!positions?.length) return null;
  const colors = printAreaColors(colorHex);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="print-positions-panel"
        onClick={() => onOpenChange(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border-0 bg-transparent px-5 py-4 text-left transition-colors hover:bg-subtle"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-text">{t("positions")}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
              {positions.length}
            </span>
          </span>
          <span className="text-xs text-text-secondary">{t("positionsHint")}</span>
        </span>
        <DownOutlined
          className={`shrink-0 text-xs text-text-secondary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {/* Height animates via grid rows (0fr ↔ 1fr), which works for content of any height. */}
      <div
        id="print-positions-panel"
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-[300ms] ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 xl:grid-cols-3">
            {positions.map((position) => (
              <PositionCard key={position.id} position={position} colorHex={colorHex} colors={colors} t={t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
