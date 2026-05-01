"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AimOutlined, RedoOutlined } from "@ant-design/icons";
import { Button, Empty, Space, Typography } from "antd";
import { Rnd } from "react-rnd";
import { useTranslations } from "@/i18n/use-translations";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { DEFAULT_DESIGN_AREA, normalizeDesignArea } from "@/utils/designArea";

const MIN_PERCENT = 0.08;

const getBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function DesignAreaSelector({
  fileList,
  initialImageUrl,
  value,
  onChange,
  disabled = false,
}) {
  const tForm = useTranslations("forms.productPosition");
  const overlayRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(initialImageUrl || "");
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [rect, setRect] = useState(null);

  const normalizedValue = useMemo(
    () => normalizeDesignArea(value),
    [value]
  );

  const hasImage = Boolean(previewSrc);

  useEffect(() => {
    let active = true;
    const validFileList = extractUploadFileList(fileList);
    const fileItem = validFileList[0];
    if (fileItem?.originFileObj) {
      getBase64(fileItem.originFileObj)
        .then((result) => {
          if (active) setPreviewSrc(result);
        })
        .catch(() => {
          if (active) setPreviewSrc("");
        });
    } else if (fileItem?.thumbUrl) {
      setPreviewSrc(fileItem.thumbUrl);
    } else if (fileItem?.url) {
      setPreviewSrc(fileItem.url);
    } else if (initialImageUrl) {
      setPreviewSrc(initialImageUrl);
    } else {
      setPreviewSrc("");
    }

    return () => {
      active = false;
    };
  }, [fileList, initialImageUrl]);

  const measureOverlay = useCallback(() => {
    if (!overlayRef.current) return;
    const { width, height } = overlayRef.current.getBoundingClientRect();
    setOverlaySize((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  }, []);

  useEffect(() => {
    measureOverlay();
    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      measureOverlay();
    });
    if (overlayRef.current) {
      observer.observe(overlayRef.current);
    }
    return () => observer.disconnect();
  }, [measureOverlay]);

  useEffect(() => {
    if (!normalizedValue || !overlaySize.width || !overlaySize.height) {
      setRect(null);
      return;
    }
    setRect({
      x: normalizedValue.x * overlaySize.width,
      y: normalizedValue.y * overlaySize.height,
      width: normalizedValue.width * overlaySize.width,
      height: normalizedValue.height * overlaySize.height,
    });
  }, [normalizedValue, overlaySize.height, overlaySize.width]);

  const emitArea = useCallback(
    (nextRect) => {
      if (!overlaySize.width || !overlaySize.height) return;
      const normalized = {
        x: clamp(nextRect.x / overlaySize.width, 0, 1),
        y: clamp(nextRect.y / overlaySize.height, 0, 1),
        width: clamp(nextRect.width / overlaySize.width, MIN_PERCENT, 1),
        height: clamp(nextRect.height / overlaySize.height, MIN_PERCENT, 1),
      };
      onChange?.({
        x: Number(normalized.x.toFixed(4)),
        y: Number(normalized.y.toFixed(4)),
        width: Number(normalized.width.toFixed(4)),
        height: Number(normalized.height.toFixed(4)),
      });
    },
    [overlaySize.height, overlaySize.width, onChange]
  );

  const handleCreateSelection = useCallback(() => {
    onChange?.(DEFAULT_DESIGN_AREA);
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange?.(undefined);
  }, [onChange]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Text strong>
            {tForm("designArea.title")}
          </Typography.Text>
          <Typography.Paragraph
            style={{ marginBottom: 0 }}
            type="secondary"
          >
            {tForm(
              hasImage
                ? "designArea.instructions"
                : "designArea.noImageMessage"
            )}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<AimOutlined />}
            disabled={!hasImage || disabled}
            onClick={handleCreateSelection}
          >
            {normalizedValue
              ? tForm("designArea.actions.recenter")
              : tForm("designArea.actions.create")}
          </Button>
          <Button
            icon={<RedoOutlined />}
            disabled={!normalizedValue || disabled}
            onClick={handleReset}
          >
            {tForm("designArea.actions.reset")}
          </Button>
        </Space>
      </div>
      <div className="mt-4 min-h-[240px] rounded-xl border border-dashed border-gray-300 bg-white/70 p-3">
        {hasImage ? (
          <div className="relative rounded-lg">
            <img
              src={previewSrc}
              alt="position preview"
              className="block w-full rounded-lg bg-gray-200"
              onLoad={measureOverlay}
            />
            <div ref={overlayRef} className="absolute inset-0">
              {normalizedValue && rect && !disabled ? (
                <Rnd
                  bounds="parent"
                  size={{ width: rect.width, height: rect.height }}
                  position={{ x: rect.x, y: rect.y }}
                  minWidth={overlaySize.width * MIN_PERCENT || 20}
                  minHeight={overlaySize.height * MIN_PERCENT || 20}
                  onDragStop={(event, data) => {
                    const nextRect = { ...rect, x: data.x, y: data.y };
                    setRect(nextRect);
                    emitArea(nextRect);
                  }}
                  onResizeStop={(event, dir, ref, delta, position) => {
                    const nextRect = {
                      x: position.x,
                      y: position.y,
                      width: parseFloat(ref.style.width),
                      height: parseFloat(ref.style.height),
                    };
                    setRect(nextRect);
                    emitArea(nextRect);
                  }}
                  dragGrid={[1, 1]}
                  resizeGrid={[1, 1]}
                >
                  <div className="h-full w-full rounded-lg border-2 border-blue-500 bg-blue-500/15 backdrop-blur-sm">
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }).map((_, index) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key
                            key={`grid-${index}`}
                            className="border border-blue-500/20"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-blue-500/80 px-2 py-1 text-center text-[11px] font-semibold text-white">
                      {tForm("designArea.sizeLabel", {
                        width: Math.round(normalizedValue.width * 100),
                        height: Math.round(normalizedValue.height * 100),
                      })}
                    </div>
                  </div>
                </Rnd>
              ) : normalizedValue && rect ? (
                <div
                  className="absolute rounded-lg border-2 border-blue-500/70 bg-blue-500/10"
                  style={{
                    left: `${normalizedValue.x * 100}%`,
                    top: `${normalizedValue.y * 100}%`,
                    width: `${normalizedValue.width * 100}%`,
                    height: `${normalizedValue.height * 100}%`,
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg text-sm text-gray-500">
                  {tForm("designArea.noSelection")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Empty
            description={tForm("designArea.emptyState")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </div>
  );
}
