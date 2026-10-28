"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Pagination, Skeleton } from "antd";
import { PictureOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import MoneyText from "@/components/ui/MoneyText";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import { ProductCatalogAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { ColorDot, firstImage, imagesByColor } from "./catalogHelpers";

const PAGE_SIZE = 24;
const MAX_CARD_COLORS = 6;

export const CATALOG_PATH = "/dashboard/product-catalog";
const LAST_QUERY_KEY = "ej-product-catalog-query";

/** Catalog URL with the filters the viewer last used in this tab. */
export const catalogHref = () => {
  try {
    const query = window.sessionStorage.getItem(LAST_QUERY_KEY);
    return query ? `${CATALOG_PATH}?${query}` : CATALOG_PATH;
  } catch {
    return CATALOG_PATH;
  }
};

function ProductCard({ product, t }) {
  const [hoverColorId, setHoverColorId] = useState(null);
  const colorImages = useMemo(() => imagesByColor(product.variants), [product.variants]);
  const cover = (hoverColorId && colorImages.get(hoverColorId)) || firstImage(product.variants);
  const range = product.price_range;
  const hasRange = range && Number(range.min) !== Number(range.max);
  const shownColors = product.colors.slice(0, MAX_CARD_COLORS);
  const hiddenColors = product.colors.length - shownColors.length;
  const href = `${CATALOG_PATH}/${product.id}${hoverColorId ? `?color=${hoverColorId}` : ""}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-text! no-underline transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_8px_24px_rgba(15,36,51,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      onMouseLeave={() => setHoverColorId(null)}
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b border-line bg-subtle">
        {cover ? (
          <img
            src={cover}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-300">
            <PictureOutlined className="text-3xl" aria-hidden="true" />
            <span className="text-xs text-text-secondary">{t("noImage")}</span>
          </div>
        )}
        {product.category?.name ? (
          <span className="absolute left-3 top-3 rounded-full border border-line bg-surface/90 px-2.5 py-0.5 text-[11px] font-medium text-text-secondary backdrop-blur">
            {product.category.name}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 line-clamp-2 text-[15px] font-semibold leading-5 text-text">
            {product.name}
          </h3>
          <p className="m-0 text-xs text-text-secondary">
            {t("sizeCount", { count: product.sizes.length })} · {t("colorCount", { count: product.colors.length })}
          </p>
        </div>
        {shownColors.length ? (
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {shownColors.map((color) => (
              <span
                key={color.id}
                title={color.name}
                onMouseEnter={() => setHoverColorId(color.id)}
                className={`flex h-5 w-5 items-center justify-center rounded-full leading-none ring-1 transition ${
                  hoverColorId === color.id ? "ring-ink-400" : "ring-transparent"
                }`}
              >
                <ColorDot color={color} size={16} />
              </span>
            ))}
            {hiddenColors > 0 ? (
              <span className="text-xs text-text-secondary">+{hiddenColors}</span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              {t("unitPrice")}
            </span>
            {range ? (
              <span className="flex items-baseline gap-1 text-text">
                <MoneyText value={range.min} currency={product.currency} strong className="text-base" />
                {hasRange ? <span className="text-xs text-text-secondary">{t("from")}</span> : null}
              </span>
            ) : (
              <span className="text-text-secondary">-</span>
            )}
          </div>
          <span className="text-xs text-text-secondary">
            {t("variantCount", { count: product.variants?.length ?? 0 })}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="aspect-square bg-subtle" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton active title={{ width: "70%" }} paragraph={{ rows: 2, width: ["40%", "55%"] }} />
      </div>
    </div>
  );
}

export default function CustomerProductCatalogPage() {
  const t = useTranslations("dashboard.customerCatalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") || "";
  const categoryId = searchParams.get("category") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState({ loading: true, error: false, items: [], total: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  // Filters live in the URL so returning from a product keeps them.
  const updateQuery = useCallback(
    (changes) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
        else params.delete(key);
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Follow URL changes (back/forward, clear) without trimming what is being typed.
  useEffect(() => setSearchInput((prev) => (prev.trim() === search ? prev : search)), [search]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LAST_QUERY_KEY, searchParams.toString());
    } catch {
      // Storage may be unavailable (private mode); the back link then resets filters.
    }
  }, [searchParams]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return undefined;
    const timer = setTimeout(() => updateQuery({ q: next, page: null }), 350);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateQuery]);

  useEffect(() => {
    let alive = true;
    ProductCatalogAPI.customerCategories()
      .then((response) => { if (alive) setCategories(response?.data || []); })
      .catch(() => { if (alive) setCategories([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: false }));
    ProductCatalogAPI.customerProducts({
      search: search || undefined,
      category_id: categoryId || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((response) => {
        if (!alive) return;
        setState({
          loading: false,
          error: false,
          items: response?.data || [],
          total: response?.pagination?.total ?? 0,
        });
      })
      .catch(() => {
        if (alive) setState({ loading: false, error: true, items: [], total: 0 });
      });
    return () => { alive = false; };
  }, [search, categoryId, page, reloadKey]);

  const totalProducts = categories.reduce((sum, category) => sum + category.product_count, 0);
  const filtered = Boolean(search || categoryId);
  const chips = [
    { id: "", name: t("allCategories"), count: totalProducts },
    ...categories.map((category) => ({ id: category.id, name: category.name, count: category.product_count })),
  ];

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <PageHeader
        title={t("title")}
        description={t("description")}
        meta={
          !state.loading && !state.error ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {t("productCount", { count: state.total })}
            </span>
          ) : null
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {categories.length > 1 ? (
          <div
            role="group"
            aria-label={t("categoryFilter")}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0"
          >
            {chips.map((chip) => {
              const active = chip.id === categoryId;
              return (
                <button
                  key={chip.id || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateQuery({ category: chip.id, page: null })}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-line bg-surface text-text-secondary hover:border-line-strong hover:text-text"
                  }`}
                >
                  {chip.name}
                  <span className={`text-xs ${active ? "text-brand-700" : "text-ink-300"}`}>{chip.count}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}
        <Input
          allowClear
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          prefix={<SearchOutlined className="text-ink-300" aria-hidden="true" />}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="w-full lg:max-w-xs"
          size="large"
        />
      </div>

      {state.error ? (
        <div className="rounded-xl border border-line bg-surface">
          <ErrorState title={t("loadError")} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      ) : state.loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} />)}
        </div>
      ) : state.items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<ShopOutlined />}
            title={t("emptyTitle")}
            description={filtered ? t("emptyFiltered") : t("emptyCatalog")}
            action={
              filtered ? (
                <Button onClick={() => { setSearchInput(""); updateQuery({ q: null, category: null, page: null }); }}>
                  {t("clearFilters")}
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {state.items.map((product) => <ProductCard key={product.id} product={product} t={t} />)}
          </div>
          {state.total > PAGE_SIZE ? (
            <div className="mt-6 flex justify-center">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={state.total}
                showSizeChanger={false}
                onChange={(next) => {
                  updateQuery({ page: next > 1 ? next : null });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </RequireRole>
  );
}
