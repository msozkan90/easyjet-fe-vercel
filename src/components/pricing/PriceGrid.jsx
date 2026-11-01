"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Collapse,
  Input,
  InputNumber,
  Popover,
  Select,
  Space,
  Switch,
} from "antd";
import { FormatPainterOutlined, SearchOutlined } from "@ant-design/icons";
import { EmptyState } from "@/components/ui/StateView";
import { useTranslations } from "@/i18n/use-translations";

export const keyOf = (productId, sizeId, colorId) => `${productId}:${sizeId}:${colorId}`;

export const isPrice = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const productKeys = (product) =>
  product.sizes.flatMap((size) =>
    product.colors.map((color) => keyOf(product.id, size.id, color.id)),
  );

/** `{ "product:size:color": price }` from API items. */
export const pricesFromItems = (items) => {
  const next = {};
  for (const item of items ?? []) {
    next[keyOf(item.product_id, item.size_id, item.color_id)] = Number(item.price);
  }
  return next;
};

/** Small price input + apply button behind an icon; used for row, column and product fills. */
function FillPopover({ title, applyText, onApply, children }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const inputRef = useRef(null);
  const apply = () => {
    if (!isPrice(value)) return;
    onApply(value);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      // autoFocus does not fire for popover content; focus once it is shown.
      afterOpenChange={(visible) => {
        if (visible) inputRef.current?.focus();
      }}
      trigger="click"
      title={title}
      content={
        <Space.Compact>
          <InputNumber
            ref={inputRef}
            min={0}
            step={0.01}
            value={value}
            onChange={setValue}
            onPressEnter={apply}
            style={{ width: 120 }}
          />
          <Button type="primary" onClick={apply} disabled={!isPrice(value)}>
            {applyText}
          </Button>
        </Space.Compact>
      }
    >
      {children}
    </Popover>
  );
}

function ProductMatrix({ product, prices, changedKeys, setPrice, fillKeys, t }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium text-text-secondary">
              {t("colorSize")}
            </th>
            {product.sizes.map((size) => (
              <th key={size.id} className="px-1 py-1.5 text-left font-medium text-text">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span>{size.name}</span>
                  <FillPopover
                    title={t("columnFill")}
                    applyText={t("apply")}
                    onApply={(value) =>
                      fillKeys(
                        product.colors.map((color) => keyOf(product.id, size.id, color.id)),
                        value,
                      )
                    }
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<FormatPainterOutlined />}
                      aria-label={t("columnFill")}
                    />
                  </FillPopover>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {product.colors.map((color) => (
            <tr key={color.id}>
              <td className="sticky left-0 z-10 bg-surface px-2 py-1">
                <div className="flex items-center gap-1 whitespace-nowrap text-text">
                  <span>{color.name}</span>
                  <FillPopover
                    title={t("rowFill")}
                    applyText={t("apply")}
                    onApply={(value) =>
                      fillKeys(
                        product.sizes.map((size) => keyOf(product.id, size.id, color.id)),
                        value,
                      )
                    }
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<FormatPainterOutlined />}
                      aria-label={t("rowFill")}
                    />
                  </FillPopover>
                </div>
              </td>
              {product.sizes.map((size) => {
                const key = keyOf(product.id, size.id, color.id);
                const changed = changedKeys?.has(key);
                return (
                  <td key={size.id} className="px-1 py-1">
                    <InputNumber
                      size="small"
                      min={0}
                      step={0.01}
                      controls={false}
                      value={prices[key] ?? null}
                      onChange={(value) => setPrice(key, value)}
                      aria-label={`${product.name} ${color.name} ${size.name}`}
                      status={changed ? "warning" : undefined}
                      className={changed ? "bg-warning-bg!" : undefined}
                      style={{ width: 92 }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Product × size × color price editor: bulk fill, product search, "only
 * missing" filter and one collapsible color/size matrix per product.
 * `prices` is `{ key: number }`; `setPrices` is a state setter; `onEdit` runs
 * after every change; `changedKeys` (Set) highlights unsaved cells.
 */
export default function PriceGrid({ products, prices, setPrices, onEdit, changedKeys }) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.priceGrid");
  const [search, setSearch] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [bulkPrice, setBulkPrice] = useState(null);
  const [bulkScope, setBulkScope] = useState("empty");

  const setPrice = useCallback(
    (key, value) => {
      setPrices((prev) => {
        const next = { ...prev };
        if (isPrice(value)) next[key] = value;
        else delete next[key];
        return next;
      });
      onEdit?.();
    },
    [setPrices, onEdit],
  );

  const fillKeys = useCallback(
    (keys, value, onlyEmpty = false) => {
      setPrices((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          if (onlyEmpty && isPrice(next[key])) continue;
          if (value === null) delete next[key];
          else next[key] = value;
        }
        return next;
      });
      onEdit?.();
    },
    [setPrices, onEdit],
  );

  const coverageOf = useCallback(
    (product) => productKeys(product).filter((key) => isPrice(prices[key])).length,
    [prices],
  );

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      if (needle && !product.name.toLocaleLowerCase().includes(needle)) return false;
      if (onlyIncomplete) {
        return coverageOf(product) < product.sizes.length * product.colors.length;
      }
      return true;
    });
  }, [products, search, onlyIncomplete, coverageOf]);

  const applyBulk = () => {
    if (!isPrice(bulkPrice)) {
      message.warning(t("invalidPrice"));
      return;
    }
    // Bulk fill follows the search/filter so a product group can be priced at once.
    fillKeys(visibleProducts.flatMap(productKeys), bulkPrice, bulkScope === "empty");
  };

  const collapseItems = visibleProducts.map((product) => {
    const keys = productKeys(product);
    const total = keys.length;
    const priced = coverageOf(product);
    const complete = priced === total;
    const changed = changedKeys ? keys.filter((key) => changedKeys.has(key)).length : 0;
    return {
      key: product.id,
      label: (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-text">{product.name}</span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              complete
                ? "bg-success-bg text-success"
                : priced
                  ? "bg-warning-bg text-warning"
                  : "bg-subtle text-text-secondary"
            }`}
          >
            {t("productCoverage", { priced, total })}
          </span>
          {changed ? (
            <span className="shrink-0 text-[11px] text-warning">
              {t("productChanged", { count: changed })}
            </span>
          ) : null}
        </div>
      ),
      extra: (
        // Keep header clicks on these controls from toggling the panel.
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <FillPopover
            title={t("productFill")}
            applyText={t("apply")}
            onApply={(value) => fillKeys(keys, value)}
          >
            <Button size="small" icon={<FormatPainterOutlined />}>
              {t("productFill")}
            </Button>
          </FillPopover>
          <Button
            size="small"
            type="text"
            disabled={!priced}
            onClick={() => fillKeys(keys, null)}
          >
            {t("clearProduct")}
          </Button>
        </div>
      ),
      children: (
        <ProductMatrix
          product={product}
          prices={prices}
          changedKeys={changedKeys}
          setPrice={setPrice}
          fillKeys={fillKeys}
          t={t}
        />
      ),
    };
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text">{t("bulkTitle")}</span>
          <Space.Compact>
            <InputNumber
              min={0}
              step={0.01}
              value={bulkPrice}
              onChange={setBulkPrice}
              onPressEnter={applyBulk}
              placeholder={t("bulkPrice")}
              aria-label={t("bulkPrice")}
              style={{ width: 130 }}
            />
            <Select
              value={bulkScope}
              onChange={setBulkScope}
              style={{ width: 190 }}
              options={[
                { value: "empty", label: t("scopeEmpty") },
                { value: "all", label: t("scopeAll") },
              ]}
            />
            <Button type="primary" onClick={applyBulk}>
              {t("apply")}
            </Button>
          </Space.Compact>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Switch size="small" checked={onlyIncomplete} onChange={setOnlyIncomplete} />
            {t("onlyIncomplete")}
          </label>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t("searchProduct")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 240 }}
          />
        </div>
      </div>

      {collapseItems.length ? (
        <Collapse destroyOnHidden items={collapseItems} />
      ) : (
        <EmptyState compact description={t("noMatch")} />
      )}
    </>
  );
}
