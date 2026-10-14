"use client";

import { getStatusTone } from "@/theme/status";

/**
 * Pill with a colored dot. The tone comes from the shared status map, so the
 * same status reads the same everywhere. Pass the translated label as children.
 */
export default function StatusTag({
  status,
  tone,
  children,
  size = "default",
  className = "",
  ...rest
}) {
  const resolvedTone = tone || getStatusTone(status);
  const sizeClass = size === "small" ? " ej-status--sm" : "";
  return (
    <span
      className={`ej-status ej-status--${resolvedTone}${sizeClass} ${className}`.trim()}
      {...rest}
    >
      <span className="ej-status__dot" aria-hidden="true" />
      {children ?? status ?? "-"}
    </span>
  );
}
