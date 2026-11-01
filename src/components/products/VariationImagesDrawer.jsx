"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Drawer, Select, Space, Typography, Upload } from "antd";
import { CheckOutlined, UploadOutlined } from "@ant-design/icons";
import { EmptyState } from "@/components/ui/StateView";
import { ProductCatalogAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const cellKey = (sizeId, colorId) => `${sizeId}:${colorId}`;

/**
 * Color × size grid of one product's catalog images. The user selects cells
 * (one cell, a whole color row, a whole size column or any mix) and uploads a
 * single image for all of them in one request.
 */
export default function VariationImagesDrawer({ open, productId, products, onClose, onSaved }) {
  const t = useTranslations("dashboard.productCatalog.bulk");
  const tCatalog = useTranslations("dashboard.productCatalog");
  const { message, modal } = App.useApp();

  const [currentProductId, setCurrentProductId] = useState(productId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setCurrentProductId(productId);
  }, [open, productId]);

  const load = useCallback(async () => {
    if (!currentProductId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const resp = await ProductCatalogAPI.productImages(currentProductId);
      setData(resp?.data ?? resp);
    } catch {
      setData(null);
      message.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [currentProductId, message, t]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setFile(null);
    load();
  }, [open, load]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const imageMap = useMemo(
    () => new Map((data?.images ?? []).map((img) => [cellKey(img.size_id, img.color_id), img.image_url])),
    [data],
  );
  const sizes = data?.sizes ?? [];
  const colors = data?.colors ?? [];
  const allKeys = useMemo(
    () => colors.flatMap((color) => sizes.map((size) => cellKey(size.id, color.id))),
    [sizes, colors],
  );

  // Selects the group, or clears it when every cell in it is already selected.
  const toggleGroup = (keys) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = keys.every((key) => next.has(key));
      keys.forEach((key) => (allSelected ? next.delete(key) : next.add(key)));
      return next;
    });

  const save = async () => {
    if (!file) {
      message.error(tCatalog("selectImage"));
      return;
    }
    const variations = [...selected].map((key) => {
      const [size_id, color_id] = key.split(":");
      return { size_id, color_id };
    });
    const form = new FormData();
    form.append("product_id", currentProductId);
    form.append("variations", JSON.stringify(variations));
    form.append("image", file);
    setSaving(true);
    try {
      await ProductCatalogAPI.saveImages(form);
      message.success(t("saved", { count: variations.length }));
      setSelected(new Set());
      setFile(null);
      await load();
      onSaved?.();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || tCatalog("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const missingKeys = allKeys.filter((key) => !imageMap.has(key));

  // Escape or a mask click must not silently drop a selection or a chosen image.
  const handleClose = () => {
    if (saving) return;
    if (!file && !selected.size) {
      onClose?.();
      return;
    }
    modal.confirm({
      title: t("discardTitle"),
      okText: t("discardOk"),
      cancelText: t("keepEditing"),
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  };

  return (
    <Drawer
      title={t("title")}
      open={open}
      onClose={handleClose}
      width={Math.min(960, typeof window === "undefined" ? 960 : window.innerWidth)}
      destroyOnHidden
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {preview ? (
              <img
                src={preview}
                alt=""
                className="h-12 w-12 rounded-md border border-solid border-line object-contain"
              />
            ) : null}
            <Upload
              accept={ACCEPTED_TYPES.join(",")}
              maxCount={1}
              disabled={saving}
              showUploadList={false}
              beforeUpload={(next) => {
                if (!ACCEPTED_TYPES.includes(next.type) || next.size > 5 * 1024 * 1024) {
                  message.error(tCatalog("invalidImage"));
                  return Upload.LIST_IGNORE;
                }
                setFile(next);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>{file ? file.name : tCatalog("upload")}</Button>
            </Upload>
          </div>
          <Button
            type="primary"
            loading={saving}
            disabled={!file || !selected.size}
            onClick={save}
          >
            {t("apply", { count: selected.size })}
          </Button>
        </div>
      }
    >
      <Space direction="vertical" size={16} className="w-full">
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tCatalog("selectProduct")}
          options={products}
          value={currentProductId}
          onChange={(value) => {
            setCurrentProductId(value);
            setSelected(new Set());
          }}
          className="w-full"
          aria-label={tCatalog("selectProduct")}
        />

        {!currentProductId ? (
          <EmptyState compact title={t("pickProductTitle")} description={t("pickProduct")} />
        ) : loading && !data ? (
          <Typography.Text type="secondary">…</Typography.Text>
        ) : !sizes.length || !colors.length ? (
          <EmptyState compact title={t("noVariationsTitle")} description={t("noVariations")} />
        ) : (
          <>
            <Typography.Text type="secondary" className="text-[13px]">
              {t("hint")}
            </Typography.Text>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="small" onClick={() => setSelected(new Set(allKeys))}>
                {t("selectAll")}
              </Button>
              <Button
                size="small"
                disabled={!missingKeys.length}
                onClick={() => setSelected(new Set(missingKeys))}
              >
                {t("selectMissing", { count: missingKeys.length })}
              </Button>
              <Button size="small" type="text" disabled={!selected.size} onClick={() => setSelected(new Set())}>
                {t("clearSelection")}
              </Button>
              <span className="ml-auto text-[12px] text-text-secondary">
                {t("summary", {
                  withImage: allKeys.length - missingKeys.length,
                  total: allKeys.length,
                })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-1 text-[13px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface px-2 text-left font-medium text-text-secondary">
                      {t("colorSize")}
                    </th>
                    {sizes.map((size) => (
                      <th key={size.id} className="p-0">
                        <button
                          type="button"
                          title={t("selectSize")}
                          onClick={() => toggleGroup(colors.map((color) => cellKey(size.id, color.id)))}
                          className="w-full cursor-pointer whitespace-nowrap rounded-md border-0 bg-subtle px-2 py-1 text-[12px] font-medium text-text hover:bg-brand-50 hover:text-brand-700"
                        >
                          {size.name}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colors.map((color) => (
                    <tr key={color.id}>
                      <td className="sticky left-0 z-10 bg-surface p-0">
                        <button
                          type="button"
                          title={t("selectColor")}
                          onClick={() => toggleGroup(sizes.map((size) => cellKey(size.id, color.id)))}
                          className="w-full cursor-pointer whitespace-nowrap rounded-md border-0 bg-subtle px-2 py-1 text-left text-[12px] font-medium text-text hover:bg-brand-50 hover:text-brand-700"
                        >
                          {color.name}
                        </button>
                      </td>
                      {sizes.map((size) => {
                        const key = cellKey(size.id, color.id);
                        const url = imageMap.get(key);
                        const isSelected = selected.has(key);
                        return (
                          <td key={size.id} className="p-0">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`${color.name} / ${size.name}`}
                              onClick={() => toggleGroup([key])}
                              className={`relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-solid bg-surface p-0.5 ${
                                isSelected ? "border-brand-500" : "border-line hover:border-line-strong"
                              }`}
                            >
                              {url ? (
                                <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-[11px] text-text-secondary">{tCatalog("noImage")}</span>
                              )}
                              {isSelected ? (
                                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] text-white">
                                  <CheckOutlined />
                                </span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Space>
    </Drawer>
  );
}
