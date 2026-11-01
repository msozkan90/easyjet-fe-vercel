"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { App as AntdApp, Button, Card, Input } from "antd";
import { GoldOutlined, SearchOutlined, UnorderedListOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import PriceGrid, { isPrice, pricesFromItems, productKeys } from "@/components/pricing/PriceGrid";
import AssignPricePackageModal from "@/components/price-package/AssignPricePackageModal";
import { PricePackagesAPI, ProductPricesAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const unwrap = (resp) => resp?.data ?? resp;
const fmt = (value) => Number(value ?? 0).toLocaleString();

function CoveragePill({ priced, total, t }) {
  const tone = !priced
    ? "bg-danger-bg text-danger"
    : priced >= total
      ? "bg-success-bg text-success"
      : "bg-subtle text-text-secondary";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {priced ? t("coverage", { priced: fmt(priced), total: fmt(total) }) : t("noPrices")}
    </span>
  );
}

function TargetList({ targets, selected, onSelect, t }) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase();
  const match = (item) => !needle || item.name.toLocaleLowerCase().includes(needle);
  const total = targets.total_variations;

  const section = (type, title, items) => {
    const visible = items.filter(match);
    if (!visible.length) return null;
    return (
      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 pt-3 text-[12px] font-medium text-text-secondary">
          {title}
        </div>
        {visible.map((item) => {
          const active = selected?.type === type && selected.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect({ type, id: item.id, name: item.name })}
              aria-current={active ? "true" : undefined}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left text-[13px] transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "bg-transparent text-text hover:bg-subtle"
              }`}
            >
              <span className="truncate">{item.name}</span>
              <CoveragePill priced={item.priced} total={total} t={t} />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Card size="small" styles={{ body: { padding: 8 } }}>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder={t("searchTarget")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-[70vh] overflow-y-auto">
        {section("customer", t("customers"), targets.customers)}
        {section("partner", t("partners"), targets.partners)}
        {!targets.customers.length && !targets.partners.length ? (
          <EmptyState compact description={t("noTargets")} />
        ) : null}
      </div>
    </Card>
  );
}

function PriceManager() {
  const { message, modal } = AntdApp.useApp();
  const t = useTranslations("dashboard.priceManager");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [targets, setTargets] = useState(null);
  const [variations, setVariations] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [original, setOriginal] = useState({});
  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);

  const selectedId = searchParams.get("customer") || searchParams.get("partner");
  const selectedType = searchParams.get("customer") ? "customer" : "partner";

  const loadTargets = useCallback(async () => {
    try {
      setTargets(unwrap(await ProductPricesAPI.targets()));
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadTargets();
    PricePackagesAPI.variations()
      .then((resp) => setVariations(unwrap(resp)))
      .catch(() => setLoadError(true));
  }, [loadTargets]);

  const selected = useMemo(() => {
    if (!selectedId || !targets) return null;
    const list = selectedType === "customer" ? targets.customers : targets.partners;
    const item = list.find((entry) => entry.id === selectedId);
    return item ? { type: selectedType, id: item.id, name: item.name } : null;
  }, [selectedId, selectedType, targets]);

  // Keyed on type/id only: refreshing the target list must not reload the grid.
  const selectedKey = selected ? `${selected.type}:${selected.id}` : null;
  const targetParam = useMemo(() => {
    if (!selectedKey) return null;
    const [type, id] = selectedKey.split(":");
    return type === "customer" ? { customer_id: id } : { partner_id: id };
  }, [selectedKey]);

  const loadPrices = useCallback(async () => {
    if (!targetParam) return;
    setLoadingPrices(true);
    try {
      const next = pricesFromItems(unwrap(await ProductPricesAPI.targetPrices(targetParam))?.items);
      setOriginal(next);
      setPrices(next);
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t("messages.loadError"));
    } finally {
      setLoadingPrices(false);
    }
  }, [targetParam, message, t]);

  useEffect(() => {
    setOriginal({});
    setPrices({});
    loadPrices();
  }, [loadPrices]);

  const products = useMemo(() => variations?.products ?? [], [variations]);

  // Cells whose value differs from what the server returned (added, edited or cleared).
  const changedKeys = useMemo(() => {
    const keys = new Set();
    for (const key of Object.keys(prices)) if (prices[key] !== original[key]) keys.add(key);
    for (const key of Object.keys(original)) if (!(key in prices)) keys.add(key);
    return keys;
  }, [prices, original]);
  const dirty = changedKeys.size > 0;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const pricedTotal = useMemo(
    () =>
      products.reduce(
        (sum, product) => sum + productKeys(product).filter((key) => isPrice(prices[key])).length,
        0,
      ),
    [products, prices],
  );

  const confirmDiscard = (onOk) => {
    if (!dirty) {
      onOk();
      return;
    }
    modal.confirm({
      title: t("discardTitle"),
      content: t("discardBody", { name: selected?.name ?? "", count: changedKeys.size }),
      okText: t("discardOk"),
      cancelText: t("keepEditing"),
      okButtonProps: { danger: true },
      onOk,
    });
  };

  const selectTarget = (target) => {
    if (target.type === selected?.type && target.id === selected?.id) return;
    confirmDiscard(() => {
      setOriginal({});
      setPrices({});
      router.replace(`${pathname}?${target.type}=${target.id}`, { scroll: false });
    });
  };

  const onSave = async () => {
    const changes = [...changedKeys].map((key) => {
      const [product_id, size_id, color_id] = key.split(":");
      return { product_id, size_id, color_id, price: isPrice(prices[key]) ? prices[key] : null };
    });
    setSaving(true);
    try {
      const result = unwrap(await ProductPricesAPI.saveTargetPrices({ ...targetParam, changes }));
      message.success(
        t("messages.saveSuccess", {
          name: selected.name,
          created: result?.created ?? 0,
          updated: result?.updated ?? 0,
          removed: result?.removed ?? 0,
        }),
      );
      setOriginal(prices);
      loadTargets();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || t("messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      breadcrumb={[
        { title: t("breadcrumb"), href: "/dashboard/product-variation/products" },
        { title: t("title") },
      ]}
      title={t("title")}
      description={t("description")}
      extra={
        <Link href="/dashboard/product-variation/prices/list">
          <Button icon={<UnorderedListOutlined />}>{t("advancedList")}</Button>
        </Link>
      }
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState description={t("messages.loadError")} onRetry={() => window.location.reload()} />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="md:sticky md:top-4">
          {targets ? (
            <TargetList targets={targets} selected={selected} onSelect={selectTarget} t={t} />
          ) : (
            <Card loading />
          )}
        </div>

        {!selected ? (
          <Card>
            <EmptyState title={t("selectTargetTitle")} description={t("selectTarget")} />
          </Card>
        ) : (
          <Card loading={loadingPrices || !variations} styles={{ body: { paddingBottom: 0 } }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 truncate text-[18px] font-semibold text-text">{selected.name}</h2>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {selected.type === "customer" ? t("customerTag") : t("partnerTag")}
                  </span>
                </div>
                <span className="text-[13px] text-text-secondary">
                  {t("targetCoverage", {
                    priced: fmt(pricedTotal),
                    total: fmt(variations?.total_variations),
                  })}
                  {" · "}
                  {t("removeHint")}
                </span>
              </div>
              <Button icon={<GoldOutlined />} onClick={() => confirmDiscard(() => setPackageOpen(true))}>
                {t("applyPackage")}
              </Button>
            </div>

            {products.length ? (
              <PriceGrid
                products={products}
                prices={prices}
                setPrices={setPrices}
                changedKeys={changedKeys}
              />
            ) : (
              <EmptyState compact description={t("noVariations")} />
            )}

            <div className="sticky bottom-0 z-20 -mx-6 mt-4 flex flex-wrap items-center justify-between gap-3 border-0 border-t border-solid border-line bg-surface px-6 py-3">
              <span className={`text-[13px] ${dirty ? "text-warning" : "text-text-secondary"}`}>
                {dirty ? t("changes", { count: changedKeys.size }) : null}
              </span>
              <div className="flex gap-2">
                <Button disabled={!dirty || saving} onClick={() => setPrices(original)}>
                  {t("discard")}
                </Button>
                <Button type="primary" disabled={!dirty} loading={saving} onClick={onSave}>
                  {t("save")}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <AssignPricePackageModal
        open={packageOpen}
        target={selected}
        onClose={() => setPackageOpen(false)}
        onApplied={() => {
          loadPrices();
          loadTargets();
        }}
      />
    </>
  );
}

export default function ProductPricesPage() {
  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      {/* useSearchParams needs a Suspense boundary in the app router. */}
      <Suspense fallback={null}>
        <PriceManager />
      </Suspense>
    </RequireRole>
  );
}
