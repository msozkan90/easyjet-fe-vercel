"use client";

import { ExportOutlined } from "@ant-design/icons";
import { Button, Image, Space, Typography } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { openUrlInNewTab } from "@/components/common/media/ImagePreviewGate";

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

  if (status === "ready" && thumbnailUrl) {
    return (
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
        {status !== "pending" &&
        status !== "processing" &&
        canOpenOriginal ? (
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => openUrlInNewTab(design.design_url)}
          >
            {t("openOriginal")}
          </Button>
        ) : null}
      </Space>
    </div>
  );
}
