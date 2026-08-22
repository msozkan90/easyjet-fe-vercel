"use client";

import { useState } from "react";
import { DownloadOutlined } from "@ant-design/icons";
import { Button, Image, Space, Tooltip, Typography } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { openUrlInNewTab } from "@/components/common/media/ImagePreviewGate";
import { downloadOriginalDesign } from "@/utils/orderItemDesignDownloads";

const fallbackFrameStyle = ({ width, height, style = {}, aspectRatio }) => ({
  width: style.width ?? width ?? "100%",
  height: style.height ?? height,
  minHeight: style.minHeight ?? (height ? undefined : 96),
  maxWidth: style.maxWidth,
  maxHeight: style.maxHeight,
  aspectRatio: style.aspectRatio ?? aspectRatio,
  borderRadius: style.borderRadius ?? 8,
  border: style.border ?? "1px solid #f0f0f0",
  background: "#f5f5f5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
  overflow: "hidden",
});

export const resolveDesignThumbnailStatus = (design) =>
  design?.thumbnail_url
    ? "ready"
    : design?.thumbnail_status ||
      (design?.design_url ? "pending" : "not_applicable");

export function OriginalDesignButton({
  url,
  size = "small",
  compact = false,
  block = false,
  className,
  style,
}) {
  const t = useTranslations("common.designThumbnail");
  const [downloading, setDownloading] = useState(false);
  if (!url) return null;

  const button = (
    <Button
      size={size}
      block={block}
      className={className}
      style={style}
      icon={<DownloadOutlined />}
      loading={downloading}
      aria-label={t("openOriginal")}
      onClick={async (event) => {
        event.stopPropagation();
        setDownloading(true);
        try {
          await downloadOriginalDesign({ url });
        } catch {
          openUrlInNewTab(url);
        } finally {
          setDownloading(false);
        }
      }}
    >
      {compact ? null : t("openOriginal")}
    </Button>
  );

  return compact ? <Tooltip title={t("openOriginal")}>{button}</Tooltip> : button;
}

export default function DesignThumbnailImage({
  design,
  width,
  height,
  style,
  className,
  aspectRatio = "1 / 1",
  alt,
  preview = true,
  ...imageProps
}) {
  const t = useTranslations("common.designThumbnail");
  const thumbnailUrl = design?.thumbnail_url;
  const status = resolveDesignThumbnailStatus(design);
  const numericWidth = typeof width === "number" ? width : Number.parseFloat(width);
  const compactOriginalAction = Number.isFinite(numericWidth) && numericWidth <= 80;

  if (status === "ready" && thumbnailUrl) {
    const thumbnail = (
      <Image
        {...imageProps}
        loading="lazy"
        src={thumbnailUrl}
        alt={alt || "design thumbnail"}
        width={width}
        height={height}
        style={style}
        className={className}
        preview={
          preview === false
            ? false
            : typeof preview === "object"
              ? { ...preview, src: thumbnailUrl }
              : { src: thumbnailUrl }
        }
      />
    );

    if (compactOriginalAction) {
      return (
        <div style={{ position: "relative", width, height }}>
          {thumbnail}
          <OriginalDesignButton
            url={design?.design_url}
            compact
            style={{ position: "absolute", right: 2, bottom: 2, zIndex: 2 }}
          />
        </div>
      );
    }

    return (
      <Space direction="vertical" size={6} style={{ width: style?.width ?? width ?? "100%" }}>
        {thumbnail}
        <OriginalDesignButton url={design?.design_url} block />
      </Space>
    );
  }

  const canOpenOriginal = Boolean(design?.design_url);
  const message =
    status === "pending" || status === "processing"
      ? t("preparing")
      : status === "failed"
        ? t("failed")
        : t("notApplicable");

  return (
    <div
      className={className}
      style={fallbackFrameStyle({ width, height, style, aspectRatio })}
    >
      <Space direction="vertical" size={6} align="center">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {message}
        </Typography.Text>
        {canOpenOriginal ? (
          <OriginalDesignButton
            url={design.design_url}
            compact={compactOriginalAction}
          />
        ) : null}
      </Space>
    </div>
  );
}
