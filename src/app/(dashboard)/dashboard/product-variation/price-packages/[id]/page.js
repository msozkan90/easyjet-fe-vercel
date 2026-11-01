"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  App as AntdApp,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Popover,
  Select,
  Space,
  Switch,
} from "antd";
import { FormatPainterOutlined, SearchOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import { PricePackagesAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const LIST_HREF = "/dashboard/product-variation/price-packages";

const keyOf = (productId, sizeId, colorId) => `${productId}:${sizeId}:${colorId}`;

const isPrice = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

const productKeys = (product) =>
  product.sizes.flatMap((size) =>
    product.colors.map((color) => keyOf(product.id, size.id, color.id)),
  );

/** Small price input + apply button behind an icon; used for row, column and product fills. */
function FillPopover({ title, applyText, onApply, children }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const apply = () => {
    if (!isPrice(value)) return;
    onApply(value);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title={title}
      content={
        <Space.Compact>
          <InputNumber
            autoFocus
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

function ProductGrid({ product, prices, setPrice, fillKeys, t }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium text-text-secondary">
              {t("editor.colorSize")}
            </th>
            {product.sizes.map((size) => (
              <th key={size.id} className="px-1 py-1.5 text-left font-medium text-text">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span>{size.name}</span>
                  <FillPopover
                    title={t("editor.columnFill")}
                    applyText={t("editor.apply")}
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
                      aria-label={t("editor.columnFill")}
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
                    title={t("editor.rowFill")}
                    applyText={t("editor.apply")}
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
                      aria-label={t("editor.rowFill")}
                    />
                  </FillPopover>
                </div>
              </td>
              {product.sizes.map((size) => {
                const key = keyOf(product.id, size.id, color.id);
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

export default function PricePackageEditorPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.pricePackage");
  const router = useRouter();
  const params = useParams();
  const packageId = params?.id === "new" ? null : params?.id;
  const [form] = Form.useForm();

  const [variations, setVariations] = useState(null);
  const [packageName, setPackageName] = useState("");
  const [prices, setPrices] = useState({});
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [bulkPrice, setBulkPrice] = useState(null);
  const [bulkScope, setBulkScope] = useState("empty");

  const load = useCallback(async () => {
    setError(false);
    try {
      const [variationResp, packageResp] = await Promise.all([
        PricePackagesAPI.variations(),
        packageId ? PricePackagesAPI.get(packageId) : Promise.resolve(null),
      ]);
      const pkg = packageResp?.data ?? packageResp;
      if (pkg) {
        const next = {};
        for (const item of pkg.items ?? []) {
          next[keyOf(item.product_id, item.size_id, item.color_id)] = Number(item.price);
        }
        setPrices(next);
        setPackageName(pkg.name);
        form.setFieldsValue({ name: pkg.name, description: pkg.description ?? "" });
      }
      setVariations(variationResp?.data ?? variationResp);
      setDirty(false);
    } catch {
      setError(true);
    }
  }, [form, packageId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const products = useMemo(() => variations?.products ?? [], [variations]);

  const setPrice = useCallback((key, value) => {
    setPrices((prev) => {
      const next = { ...prev };
      if (isPrice(value)) next[key] = value;
      else delete next[key];
      return next;
    });
    setDirty(true);
  }, []);

  const fillKeys = useCallback((keys, value, onlyEmpty = false) => {
    setPrices((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        if (onlyEmpty && isPrice(next[key])) continue;
        if (value === null) delete next[key];
        else next[key] = value;
      }
      return next;
    });
    setDirty(true);
  }, []);

  const coverageOf = useCallback(
    (product) => productKeys(product).filter((key) => isPrice(prices[key])).length,
    [prices],
  );

  const pricedTotal = useMemo(
    () => products.reduce((sum, product) => sum + coverageOf(product), 0),
    [products, coverageOf],
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
      message.warning(t("messages.invalidPrice"));
      return;
    }
    // Bulk fill follows the search/filter so a product group can be priced at once.
    fillKeys(visibleProducts.flatMap(productKeys), bulkPrice, bulkScope === "empty");
  };

  const onSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const items = Object.entries(prices)
      .filter(([, price]) => isPrice(price))
      .map(([key, price]) => {
        const [product_id, size_id, color_id] = key.split(":");
        return { product_id, size_id, color_id, price };
      });
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      items,
    };

    setSaving(true);
    try {
      if (packageId) {
        await PricePackagesAPI.update(packageId, payload);
        message.success(t("messages.updateSuccess"));
      } else {
        await PricePackagesAPI.create(payload);
        message.success(t("messages.createSuccess"));
      }
      setDirty(false);
      router.push(LIST_HREF);
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t("messages.operationFailed"));
    } finally {
      setSaving(false);
    }
  };

  const title = packageId
    ? t("editor.editTitle", { name: packageName })
    : t("editor.createTitle");

  const collapseItems = visibleProducts.map((product) => {
    const total = product.sizes.length * product.colors.length;
    const priced = coverageOf(product);
    const complete = priced === total;
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
            {t("editor.productCoverage", { priced, total })}
          </span>
        </div>
      ),
      extra: (
        // Keep header clicks on these controls from toggling the panel.
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <FillPopover
            title={t("editor.productFill")}
            applyText={t("editor.apply")}
            onApply={(value) => fillKeys(productKeys(product), value)}
          >
            <Button size="small" icon={<FormatPainterOutlined />}>
              {t("editor.productFill")}
            </Button>
          </FillPopover>
          <Button
            size="small"
            type="text"
            disabled={!priced}
            onClick={() => fillKeys(productKeys(product), null)}
          >
            {t("editor.clearProduct")}
          </Button>
        </div>
      ),
      children: (
        <ProductGrid
          product={product}
          prices={prices}
          setPrice={setPrice}
          fillKeys={fillKeys}
          t={t}
        />
      ),
    };
  });

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      <PageHeader
        breadcrumb={[
          { title: t("title"), href: LIST_HREF },
          { title: packageId ? packageName || "…" : t("editor.createTitle") },
        ]}
        title={title}
        meta={
          variations ? (
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary">
              {t("coverage", { priced: pricedTotal, total: variations.total_variations })}
            </span>
          ) : null
        }
        extra={
          <>
            <Button onClick={() => router.push(LIST_HREF)}>{t("editor.cancel")}</Button>
            <Button type="primary" loading={saving} disabled={!variations} onClick={onSave}>
              {packageId ? t("editor.save") : t("editor.create")}
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState description={t("messages.loadError")} onRetry={load} />
        </Card>
      ) : (
        <Space direction="vertical" size={16} className="w-full">
          <Card loading={!variations}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onValuesChange={() => setDirty(true)}
              className="grid grid-cols-1 gap-x-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
            >
              <Form.Item
                name="name"
                label={t("editor.name")}
                rules={[{ required: true, whitespace: true, message: t("editor.nameRequired") }]}
                className="mb-0"
              >
                <Input maxLength={200} placeholder={t("editor.namePlaceholder")} />
              </Form.Item>
              <Form.Item name="description" label={t("editor.descriptionLabel")} className="mb-0">
                <Input maxLength={1000} placeholder={t("editor.descriptionPlaceholder")} />
              </Form.Item>
            </Form>
          </Card>

          {variations && !products.length ? (
            <Card>
              <EmptyState description={t("editor.noVariations")} />
            </Card>
          ) : null}

          {variations && products.length ? (
            <Card>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text">{t("editor.bulkTitle")}</span>
                  <Space.Compact>
                    <InputNumber
                      min={0}
                      step={0.01}
                      value={bulkPrice}
                      onChange={setBulkPrice}
                      onPressEnter={applyBulk}
                      placeholder={t("editor.bulkPrice")}
                      aria-label={t("editor.bulkPrice")}
                      style={{ width: 130 }}
                    />
                    <Select
                      value={bulkScope}
                      onChange={setBulkScope}
                      style={{ width: 190 }}
                      options={[
                        { value: "empty", label: t("editor.scopeEmpty") },
                        { value: "all", label: t("editor.scopeAll") },
                      ]}
                    />
                    <Button type="primary" onClick={applyBulk}>
                      {t("editor.apply")}
                    </Button>
                  </Space.Compact>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                    <Switch size="small" checked={onlyIncomplete} onChange={setOnlyIncomplete} />
                    {t("editor.onlyIncomplete")}
                  </label>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder={t("editor.searchProduct")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    style={{ width: 240 }}
                  />
                </div>
              </div>

              {collapseItems.length ? (
                <Collapse destroyOnHidden items={collapseItems} />
              ) : (
                <EmptyState compact description={t("editor.noMatch")} />
              )}
            </Card>
          ) : null}

          {dirty ? (
            <div className="text-right text-[12px] text-warning">{t("editor.unsaved")}</div>
          ) : null}
        </Space>
      )}
    </RequireRole>
  );
}
