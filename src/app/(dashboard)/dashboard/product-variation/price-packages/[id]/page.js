"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { App as AntdApp, Button, Card, Form, Input, Space } from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import PriceGrid, {
  isPrice,
  pricesFromItems,
  productKeys,
} from "@/components/pricing/PriceGrid";
import { PricePackagesAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const LIST_HREF = "/dashboard/product-variation/price-packages";

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

  const load = useCallback(async () => {
    setError(false);
    try {
      const [variationResp, packageResp] = await Promise.all([
        PricePackagesAPI.variations(),
        packageId ? PricePackagesAPI.get(packageId) : Promise.resolve(null),
      ]);
      const pkg = packageResp?.data ?? packageResp;
      if (pkg) {
        setPrices(pricesFromItems(pkg.items));
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

  const markDirty = useCallback(() => setDirty(true), []);

  const pricedTotal = useMemo(
    () =>
      products.reduce(
        (sum, product) => sum + productKeys(product).filter((key) => isPrice(prices[key])).length,
        0,
      ),
    [products, prices],
  );

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
          {/* The form stays mounted while loading so setFieldsValue reaches it. */}
          <Card>
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
              <PriceGrid
                products={products}
                prices={prices}
                setPrices={setPrices}
                onEdit={markDirty}
              />
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
