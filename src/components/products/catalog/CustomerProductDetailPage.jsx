"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Image, Skeleton, Tooltip, Typography } from "antd";
import { ArrowLeftOutlined, InfoCircleOutlined, PictureOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import MoneyText from "@/components/ui/MoneyText";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import { ProductCatalogAPI } from "@/utils/api";
import { formatMoney } from "@/utils/formatMoney";
import { useTranslations } from "@/i18n/use-translations";
import { CATALOG_PATH, catalogHref } from "./CustomerProductCatalogPage";
import { ColorDot, resolveVariantImage, sortSizes, variantKey } from "./catalogHelpers";
import PrintPositions, { POSITIONS_TRANSITION_MS } from "./PrintPositions";

function Section({ title, extra, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`.trim()}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="m-0 text-[15px] font-semibold text-text">{title}</h2>
          {extra}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function OptionLabel({ label, value }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-1.5 text-[13px]">
      <span className="font-medium text-text-secondary">{label}:</span>
      <span className="font-semibold text-text">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="aspect-square rounded-xl border border-line bg-subtle" />
      <div className="rounded-xl border border-line bg-surface p-6">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    </div>
  );
}

export default function CustomerProductDetailPage() {
  const t = useTranslations("dashboard.customerCatalog");
  const { productId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState({ loading: true, error: null, product: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [selection, setSelection] = useState({ sizeId: null, colorId: null });
  const [backHref, setBackHref] = useState(CATALOG_PATH);
  const [positionsOpen, setPositionsOpen] = useState(false);

  useEffect(() => setBackHref(catalogHref()), []);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, product: null });
    ProductCatalogAPI.customerProduct(productId)
      .then((response) => { if (alive) setState({ loading: false, error: null, product: response?.data || null }); })
      .catch((error) => {
        if (!alive) return;
        const status = error?.response?.status;
        setState({ loading: false, error: status === 404 || status === 400 ? "notFound" : "failed", product: null });
      });
    return () => { alive = false; };
  }, [productId, reloadKey]);

  const product = state.product;
  const variants = useMemo(() => product?.variants || [], [product]);
  const sizes = useMemo(() => sortSizes(product?.sizes), [product]);
  const colors = useMemo(() => product?.colors || [], [product]);
  const variantMap = useMemo(
    () => new Map(variants.map((variant) => [variantKey(variant.size.id, variant.color.id), variant])),
    [variants],
  );
  const has = useCallback((sizeId, colorId) => variantMap.has(variantKey(sizeId, colorId)), [variantMap]);

  // Initial selection: ?size / ?color from the URL when valid, else the first available pair.
  useEffect(() => {
    if (!product) return;
    const urlSize = searchParams.get("size");
    const urlColor = searchParams.get("color");
    const sizeIds = sizes.map((size) => size.id);
    const colorIds = colors.map((color) => color.id);
    let colorId = colorIds.includes(urlColor) ? urlColor : null;
    let sizeId = sizeIds.includes(urlSize) ? urlSize : null;
    if (!sizeId || (colorId && !has(sizeId, colorId))) {
      sizeId = sizeIds.find((id) => (colorId ? has(id, colorId) : colorIds.some((c) => has(id, c)))) || sizeIds[0] || null;
    }
    if (!colorId || !has(sizeId, colorId)) {
      colorId = colorIds.find((id) => has(sizeId, id)) || colorIds[0] || null;
    }
    setSelection({ sizeId, colorId });
    // Only on product load; later changes come from the pickers.
  }, [product]);

  const select = useCallback(
    (next) => {
      setSelection(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next.sizeId) params.set("size", next.sizeId);
      if (next.colorId) params.set("color", next.colorId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selectSize = (sizeId) => {
    const colorId = has(sizeId, selection.colorId)
      ? selection.colorId
      : colors.find((color) => has(sizeId, color.id))?.id || selection.colorId;
    select({ sizeId, colorId });
  };
  const selectColor = (colorId) => {
    const sizeId = has(selection.sizeId, colorId)
      ? selection.sizeId
      : sizes.find((size) => has(size.id, colorId))?.id || selection.sizeId;
    select({ sizeId, colorId });
  };

  // Position chips open the collapsed positions list, then scroll to the card
  // once the opening animation has finished and its position is final.
  const showPosition = (positionId) => {
    const scroll = () =>
      document.getElementById(`position-${positionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (positionsOpen) {
      scroll();
      return;
    }
    setPositionsOpen(true);
    window.setTimeout(scroll, POSITIONS_TRANSITION_MS);
  };

  const selectedSize = sizes.find((size) => size.id === selection.sizeId);
  const selectedColor = colors.find((color) => color.id === selection.colorId);
  const selectedVariant = variantMap.get(variantKey(selection.sizeId, selection.colorId));
  const image = resolveVariantImage(variants, selection.sizeId, selection.colorId);

  // One thumbnail per distinct image, linked to the variant that owns it.
  const thumbnails = useMemo(() => {
    const seen = new Map();
    variants.forEach((variant) => {
      if (variant.image_url && !seen.has(variant.image_url)) seen.set(variant.image_url, variant);
    });
    return [...seen.values()];
  }, [variants]);

  const range = product?.price_range;
  const hasRange = range && Number(range.min) !== Number(range.max);
  const additional = Number(product?.additional_position_price || 0);
  const breadcrumb = [{ title: t("title"), href: backHref }, { title: product?.name || "…" }];

  const backButton = (
    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push(backHref)}>
      {t("back")}
    </Button>
  );

  let content;
  if (state.loading) {
    content = <DetailSkeleton />;
  } else if (state.error === "notFound" || (!state.error && !product)) {
    content = (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState title={t("notFoundTitle")} description={t("notFoundDescription")} action={backButton} />
      </div>
    );
  } else if (state.error) {
    content = (
      <div className="rounded-xl border border-line bg-surface">
        <ErrorState title={t("loadError")} onRetry={() => setReloadKey((key) => key + 1)} />
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-6">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Gallery */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-4">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-line bg-subtle">
              {image.url ? (
                <Image
                  key={image.url}
                  src={image.url}
                  alt={[product.name, selectedSize?.name, selectedColor?.name].filter(Boolean).join(" – ")}
                  rootClassName="flex! h-full w-full items-center justify-center"
                  className="max-h-full! max-w-full! object-contain p-8"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-ink-300">
                  <PictureOutlined className="text-5xl" aria-hidden="true" />
                  <span className="text-sm text-text-secondary">{t("noImage")}</span>
                </div>
              )}
            </div>
            {image.url && !image.exact ? (
              <p className="m-0 flex items-start gap-1.5 text-xs text-text-secondary">
                <InfoCircleOutlined className="mt-0.5" aria-hidden="true" />
                {t("imageFallback")}
              </p>
            ) : null}
            {thumbnails.length > 1 ? (
              <div role="group" aria-label={t("gallery")} className="flex gap-2 overflow-x-auto pb-1">
                {thumbnails.map((variant) => {
                  const active = variant.image_url === image.url;
                  return (
                    <button
                      key={variant.image_url}
                      type="button"
                      aria-pressed={active}
                      aria-label={t("showImage", { size: variant.size.name, color: variant.color.name })}
                      title={`${variant.size.name} / ${variant.color.name}`}
                      onClick={() => select({ sizeId: variant.size.id, colorId: variant.color.id })}
                      className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 bg-subtle p-1 transition-colors ${
                        active ? "border-brand-600" : "border-line hover:border-line-strong"
                      }`}
                    >
                      <img src={variant.image_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Buy box */}
          <Section>
            <div className="flex flex-col gap-6 p-5 sm:p-6">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                  {t("unitPrice")}
                </span>
                <div className="text-[32px] font-semibold leading-10 text-text">
                  {selectedVariant ? (
                    <MoneyText value={selectedVariant.unit_price} currency={product.currency} />
                  ) : (
                    "-"
                  )}
                </div>
                {hasRange ? (
                  <p className="m-0 text-[13px] text-text-secondary">
                    {t("priceRange", {
                      min: formatMoney(range.min, { currency: product.currency }),
                      max: formatMoney(range.max, { currency: product.currency }),
                    })}
                  </p>
                ) : null}
              </div>

              <div>
                <OptionLabel label={t("color")} value={selectedColor?.name || "-"} />
                <div role="radiogroup" aria-label={t("color")} className="flex flex-wrap gap-2.5">
                  {colors.map((color) => {
                    const active = color.id === selection.colorId;
                    const available = has(selection.sizeId, color.id);
                    return (
                      <Tooltip
                        key={color.id}
                        title={available ? color.name : t("unavailable", { size: selectedSize?.name, color: color.name })}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={color.name}
                          onClick={() => selectColor(color.id)}
                          className={`relative flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 leading-none ring-2 transition ${
                            active ? "ring-brand-600" : "ring-transparent hover:ring-line-strong"
                          } ${available ? "" : "opacity-45"}`}
                        >
                          <ColorDot color={color} size={32} />
                          {available ? null : (
                            <span
                              className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-[34px] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-ink-500"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              <div>
                <OptionLabel label={t("size")} value={selectedSize?.name || "-"} />
                <div role="radiogroup" aria-label={t("size")} className="flex flex-wrap gap-2">
                  {sizes.map((size) => {
                    const active = size.id === selection.sizeId;
                    const available = has(size.id, selection.colorId);
                    return (
                      <button
                        key={size.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={available ? undefined : t("unavailable", { size: size.name, color: selectedColor?.name })}
                        onClick={() => selectSize(size.id)}
                        className={`h-10 min-w-12 cursor-pointer rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                          active
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : available
                              ? "border-line-strong bg-surface text-text hover:border-ink-400"
                              : "border-dashed border-line bg-subtle text-ink-300 line-through"
                        }`}
                      >
                        {size.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-text-secondary">{t("selectedVariant")}</dt>
                  <dd className="m-0 mt-1 text-sm font-medium text-text">
                    {[selectedSize?.name, selectedColor?.name].filter(Boolean).join(" / ") || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t("sku")}</dt>
                  <dd className="m-0 mt-1 text-sm">
                    {selectedVariant?.sku ? (
                      <Typography.Text copyable className="ej-mono">{selectedVariant.sku}</Typography.Text>
                    ) : (
                      <span className="text-text-secondary">{t("noSku")}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t("category")}</dt>
                  <dd className="m-0 mt-1 text-sm font-medium text-text">{product.category?.name || "-"}</dd>
                </div>
                {additional > 0 ? (
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-text-secondary">
                      {t("additionalPosition")}
                      <Tooltip title={t("additionalPositionHint")}>
                        <InfoCircleOutlined aria-label={t("additionalPositionHint")} />
                      </Tooltip>
                    </dt>
                    <dd className="m-0 mt-1 text-sm font-medium text-text">
                      +<MoneyText value={product.additional_position_price} currency={product.currency} />
                    </dd>
                  </div>
                ) : null}
                {product.positions?.length ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-text-secondary">{t("positions")}</dt>
                    <dd className="m-0 mt-1.5 flex flex-wrap gap-1.5">
                      {product.positions.map((position) => (
                        <button
                          key={position.id}
                          type="button"
                          onClick={() => showPosition(position.id)}
                          className="cursor-pointer rounded-md border border-line bg-subtle px-2 py-0.5 text-xs font-medium text-text transition-colors hover:border-brand-600 hover:text-brand-700"
                        >
                          {position.name}
                        </button>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Section>
        </div>

        <PrintPositions
          positions={product.positions}
          colorHex={selectedColor?.hex_code}
          open={positionsOpen}
          onOpenChange={setPositionsOpen}
          t={t}
        />

        {/* Price matrix */}
        {sizes.length && colors.length && variants.length > 1 ? (
          <Section
            title={t("priceTable")}
            extra={<span className="text-xs text-text-secondary">{t("priceTableHint")}</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-line bg-subtle px-4 py-2.5 text-left text-xs font-medium text-text-secondary">
                      {t("size")} / {t("color")}
                    </th>
                    {colors.map((color) => (
                      <th
                        key={color.id}
                        scope="col"
                        className="whitespace-nowrap border-b border-line bg-subtle px-4 py-2.5 text-left text-xs font-medium text-text-secondary"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ColorDot color={color} size={12} />
                          {color.name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size.id} className="border-b border-line last:border-b-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-1.5 text-left text-[13px] font-medium text-text"
                      >
                        {size.name}
                      </th>
                      {colors.map((color) => {
                        const variant = variantMap.get(variantKey(size.id, color.id));
                        const active = size.id === selection.sizeId && color.id === selection.colorId;
                        return (
                          <td key={color.id} className="px-2 py-1.5">
                            {variant ? (
                              <button
                                type="button"
                                aria-pressed={active}
                                aria-label={`${size.name} / ${color.name}`}
                                onClick={() => select({ sizeId: size.id, colorId: color.id })}
                                className={`w-full cursor-pointer whitespace-nowrap rounded-md border px-2 py-1.5 text-left transition-colors ${
                                  active
                                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                                    : "border-transparent bg-transparent text-text hover:bg-subtle"
                                }`}
                              >
                                <MoneyText value={variant.unit_price} currency={product.currency} />
                              </button>
                            ) : (
                              <span className="block px-2 text-ink-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}
      </div>
    );
  }

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <PageHeader
        title={product?.name || (state.loading ? <Skeleton.Input active size="small" /> : t("notFoundTitle"))}
        breadcrumb={breadcrumb}
        meta={
          product?.category?.name ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {product.category.name}
            </span>
          ) : null
        }
        extra={backButton}
      />
      {content}
    </RequireRole>
  );
}
