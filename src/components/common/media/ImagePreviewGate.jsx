"use client";

import { useEffect, useRef, useState } from "react";
import { ExportOutlined } from "@ant-design/icons";
import { Button, Empty, Image, Typography } from "antd";

export const MAX_PREVIEW_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const remotePreviewPolicyCache = new Map();

const resolveNumericDimension = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildFrameStyle = ({ width, height, style = {}, aspectRatio }) => {
  const resolvedWidth = style?.width ?? width;
  const resolvedHeight = style?.height ?? height;

  return {
    width: resolvedWidth,
    height: resolvedHeight,
    maxWidth: style?.maxWidth,
    maxHeight: style?.maxHeight,
    minWidth: style?.minWidth,
    minHeight: style?.minHeight,
    aspectRatio: style?.aspectRatio ?? aspectRatio,
    borderRadius: style?.borderRadius ?? 8,
    overflow: "hidden",
    background: "#f5f5f5",
    border: style?.border ?? "1px solid #f0f0f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  };
};

export const openUrlInNewTab = (url) => {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
};

export const openFileInNewTab = (file) => {
  if (!file || typeof window === "undefined") return;
  const objectUrl = URL.createObjectURL(file);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

export const isFilePreviewAllowed = (file) => {
  const sizeBytes = Number(file?.size ?? 0);
  return Number.isFinite(sizeBytes) && sizeBytes <= MAX_PREVIEW_IMAGE_SIZE_BYTES;
};

const resolveRemotePreviewPolicy = async (url) => {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) {
    return { canPreview: false, reason: "missing-src", sizeBytes: null };
  }

  if (normalizedUrl.startsWith("data:") || normalizedUrl.startsWith("blob:")) {
    return { canPreview: true, reason: "local-src", sizeBytes: null };
  }

  const cached = remotePreviewPolicyCache.get(normalizedUrl);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const request = (async () => {
    try {
      const response = await fetch(normalizedUrl, {
        method: "HEAD",
        cache: "no-store",
        redirect: "follow",
      });
      if (!response.ok) {
        return { canPreview: false, reason: "head-failed", sizeBytes: null };
      }

      const rawContentLength = response.headers.get("content-length");
      const sizeBytes = Number.parseInt(rawContentLength || "", 10);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
        return { canPreview: false, reason: "missing-content-length", sizeBytes: null };
      }

      return {
        canPreview: sizeBytes <= MAX_PREVIEW_IMAGE_SIZE_BYTES,
        reason:
          sizeBytes <= MAX_PREVIEW_IMAGE_SIZE_BYTES ? "within-limit" : "too-large",
        sizeBytes,
      };
    } catch {
      return { canPreview: false, reason: "head-error", sizeBytes: null };
    }
  })();

  remotePreviewPolicyCache.set(normalizedUrl, request);
  const resolved = await request;
  remotePreviewPolicyCache.set(normalizedUrl, resolved);
  return resolved;
};

export const useRemoteImagePreviewPolicy = (src) => {
  const [state, setState] = useState({
    checked: false,
    canPreview: false,
    reason: "idle",
    sizeBytes: null,
  });

  useEffect(() => {
    let active = true;
    const normalizedSrc = String(src || "").trim();

    if (!normalizedSrc) {
      setState({
        checked: true,
        canPreview: false,
        reason: "missing-src",
        sizeBytes: null,
      });
      return undefined;
    }

    setState((prev) => ({
      checked: false,
      canPreview: prev.canPreview,
      reason: "loading",
      sizeBytes: prev.sizeBytes,
    }));

    resolveRemotePreviewPolicy(normalizedSrc).then((policy) => {
      if (!active) return;
      setState({ checked: true, ...policy });
    });

    return () => {
      active = false;
    };
  }, [src]);

  return state;
};

function PreviewBlockedFallback({
  src,
  openLabel,
  style,
  width,
  height,
  aspectRatio,
  className,
}) {
  const frameStyle = buildFrameStyle({ width, height, style, aspectRatio });
  const compactWidth =
    resolveNumericDimension(width) ??
    resolveNumericDimension(style?.width) ??
    resolveNumericDimension(style?.maxWidth);
  const isCompact = compactWidth !== null && compactWidth < 96;

  return (
    <div className={className} style={frameStyle}>
      <Button
        type="default"
        size={isCompact ? "small" : "middle"}
        icon={<ExportOutlined />}
        onClick={() => openUrlInNewTab(src)}
      >
        {isCompact ? null : openLabel}
      </Button>
    </div>
  );
}

export function GuardedPreviewImage({
  src,
  alt,
  openLabel,
  preparingText,
  emptyText,
  width,
  height,
  style,
  className,
  preview = true,
  aspectRatio,
  ...imageProps
}) {
  const previewPolicy = useRemoteImagePreviewPolicy(src);

  if (!src) {
    return emptyText ? (
      <span style={{ color: "#8c8c8c", fontSize: 12 }}>{emptyText}</span>
    ) : null;
  }

  if (!previewPolicy.checked) {
    return (
      <div className={className} style={buildFrameStyle({ width, height, style, aspectRatio })}>
        <Typography.Text type="secondary">
          {preparingText || "Preparing preview..."}
        </Typography.Text>
      </div>
    );
  }

  if (!previewPolicy.canPreview) {
    return (
      <PreviewBlockedFallback
        src={src}
        openLabel={openLabel}
        style={style}
        width={width}
        height={height}
        aspectRatio={aspectRatio}
        className={className}
      />
    );
  }

  return (
    <Image
      {...imageProps}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      className={className}
      preview={preview}
    />
  );
}

export function LazyGuardedPreviewImage({
  src,
  alt,
  openLabel,
  preparingText,
  emptyText,
  aspectRatio = "1 / 1",
  style,
  className,
  blockedButtonProps,
}) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const previewPolicy = useRemoteImagePreviewPolicy(src);

  useEffect(() => {
    if (!previewPolicy.checked || !previewPolicy.canPreview) return undefined;
    const node = containerRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewPolicy.canPreview, previewPolicy.checked]);

  const frameStyle = buildFrameStyle({
    width: style?.width,
    height: style?.height,
    style,
    aspectRatio,
  });

  return (
    <div ref={containerRef} className={className} style={frameStyle}>
      {!previewPolicy.checked ? (
        <Typography.Text type="secondary">
          {preparingText || "Preparing preview..."}
        </Typography.Text>
      ) : !src ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : failed || !previewPolicy.canPreview ? (
        <Button
          type="default"
          icon={<ExportOutlined />}
          onClick={() => openUrlInNewTab(src)}
          {...blockedButtonProps}
        >
          {openLabel}
        </Button>
      ) : !visible ? (
        <Typography.Text type="secondary">
          {preparingText || "Preparing preview..."}
        </Typography.Text>
      ) : (
        <img
          src={src}
          alt={alt || "design"}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}
