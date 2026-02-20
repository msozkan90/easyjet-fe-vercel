"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Spin,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { downloadOrderItemDesigns } from "@/utils/orderItemDesignDownloads";
import { extractDesignAreaFromRecord } from "@/utils/designArea";

const STATUS_COLORS = {
  newOrder: "geekblue",
  processing: "purple",
  pdf: "blue",
  completed: "green",
  shipped: "gold",
  waitingForDesign: "orange",
  cancel: "red",
};

const formatAmount = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const extractPositionList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.list)) return response.list;
  if (Array.isArray(response?.items)) return response.items;
  const nested = response?.data;
  if (Array.isArray(nested?.data)) return nested.data;
  if (Array.isArray(nested)) return nested;
  return [];
};

const ItemDesignPreview = ({ item, designs, positionMap, tDetail, fallbackText }) => {
  if (!designs.length) {
    return <Empty description={tDetail("designs.empty")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {designs.map((design) => {
        const positionId = String(design?.product_position_id || "");
        const position = positionMap.get(positionId);
        const designArea = position ? extractDesignAreaFromRecord(position) : null;
        const positionImageUrl = position?.images?.[0]?.image_url;
        const previewImageUrl = positionImageUrl || item?.image_url;
        const designPreviewUrl = design?.design_url;
        const positionName =
          position?.name || design?.product_position?.name || tDetail("designs.unknownPosition");

        return (
          <Card
            key={design?.id || positionId}
            title={positionName}
            className="rounded-2xl border border-slate-100 shadow-sm"
            bodyStyle={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: 1,
              padding: 16,
            }}
          >
            <div className="relative flex w-full flex-1 items-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100">
              {previewImageUrl ? (
                <div className="relative w-full">
                  <img
                    src={previewImageUrl}
                    alt={positionName}
                    className="block w-full rounded-2xl object-contain"
                  />
                  <div className="absolute inset-0">
                    {designArea ? (
                      <div
                        className="absolute rounded-xl border-2 border-blue-500/70 bg-blue-500/10 shadow-inner"
                        style={{
                          left: `${designArea.x * 100}%`,
                          top: `${designArea.y * 100}%`,
                          width: `${designArea.width * 100}%`,
                          height: `${designArea.height * 100}%`,
                        }}
                      >
                        {designPreviewUrl ? (
                          <img
                            src={designPreviewUrl}
                            alt="design preview"
                            className="h-full w-full rounded-lg object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                            {fallbackText}
                          </div>
                        )}
                      </div>
                    ) : designPreviewUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src={designPreviewUrl}
                          alt="design preview"
                          className="h-24 w-24 rounded-lg object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : designPreviewUrl ? (
                <div className="flex aspect-[4/5] items-center justify-center p-6">
                  <img
                    src={designPreviewUrl}
                    alt="design preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center p-6">
                  <Empty description={tDetail("designs.noPreview")} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {tDetail("designs.positionLabel")}
              </Typography.Text>
              <Typography.Text>{positionName}</Typography.Text>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const OrderItemCard = ({ item, positionMap, tOrders, tDetail, fallbackText }) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  const designs = Array.isArray(item?.designs) ? item.designs : [];
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm" bodyStyle={{ padding: 20 }}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full max-w-[240px] rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            {item?.image_url ? (
              <Image
                src={item.image_url}
                alt={item?.name || "order item"}
                preview
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Empty description={tDetail("designs.noImage")} />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {item?.name || tOrders("columns.item")}
            </Typography.Title>
            <Tag color="geekblue">SKU: {item?.sku || tOrders("common.none")}</Tag>
            <Tag color="gold">
              {tOrders("columns.quantity")}: {item?.quantity ?? tOrders("common.none")}
            </Tag>
            <Tag color="green">
              {tOrders("columns.price")}: {formatAmount(item?.price || item?.unit_price)}
            </Tag>
            <Tag color={STATUS_COLORS[statusKey] || "default"}>
              {tOrders("columns.status")}: {statusLabel}
            </Tag>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Typography.Text type="secondary">{tOrders("columns.product")}</Typography.Text>
              <div className="font-medium">{item?.product?.name || tOrders("common.none")}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{tOrders("columns.size")}</Typography.Text>
              <div className="font-medium">{item?.size?.name || tOrders("common.none")}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{tOrders("columns.color")}</Typography.Text>
              <div className="font-medium">{item?.color?.name || tOrders("common.none")}</div>
            </div>
          </div>

          <div>
            <Typography.Text type="secondary">{tOrders("columns.options")}</Typography.Text>
            {options.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((option, index) => (
                  <span
                    key={`${option?.name || "option"}-${index}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {option?.name || tOrders("common.none")}: {option?.value || tOrders("common.none")}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm">{tOrders("values.noOptions")}</div>
            )}
          </div>

          <div>
            <Typography.Text type="secondary">{tOrders("columns.notes")}</Typography.Text>
            <div className="mt-1 text-sm">{item?.notes || tOrders("common.none")}</div>
          </div>

          <div>
            <Typography.Text type="secondary">{tDetail("designs.title")}</Typography.Text>
            <div className="mt-2">
              <ItemDesignPreview
                item={item}
                designs={designs}
                positionMap={positionMap}
                tDetail={tDetail}
                fallbackText={fallbackText}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function PrinterOrderSearchPage({ categoryId, subCategoryId }) {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.detail");
  const tCommonActions = useTranslations("common.actions");
  const fallbackText = tDetail("designs.designAreaPlaceholder");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [downloadingDesign, setDownloadingDesign] = useState(false);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState(null);
  const [positionsByProductId, setPositionsByProductId] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);

  const items = useMemo(() => {
    if (!Array.isArray(order?.items)) return [];
    return order.items;
  }, [order]);

  useEffect(() => {
    if (!items.length) {
      setPositionsByProductId({});
      return;
    }

    const uniqueProductIds = Array.from(
      new Set(
        items
          .map((item) => item?.product_id || item?.product?.id)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );

    if (!uniqueProductIds.length) {
      setPositionsByProductId({});
      return;
    }

    let active = true;
    setPositionsLoading(true);

    const loadPositions = async () => {
      try {
        const results = await Promise.all(
          uniqueProductIds.map(async (productId) => {
            const response = await ProductPositionsAPI.list({
              pagination: { page: 1, pageSize: 100 },
              filters: { product_id: productId, status: "active" },
            });
            return [productId, extractPositionList(response)];
          })
        );

        if (!active) return;

        const nextMap = results.reduce((acc, [productId, list]) => {
          acc[productId] = Array.isArray(list) ? list : [];
          return acc;
        }, {});

        setPositionsByProductId(nextMap);
      } catch (error) {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message || tDetail("messages.loadPositionsError")
        );
      } finally {
        if (active) {
          setPositionsLoading(false);
        }
      }
    };

    loadPositions();
    return () => {
      active = false;
    };
  }, [items, message, tDetail]);

  const handleSearch = useCallback(
    async (rawOrderNumber) => {
      const nextOrderNumber = String(rawOrderNumber || orderNumber).trim();
      if (!nextOrderNumber) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }

      setSearching(true);
      setSearched(true);

      try {
        const payload = {
          category_id: categoryId,
          order_number: nextOrderNumber,
          ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
        };

        const response = await OrdersAPI.completedItems(payload);
        const responseOrder = response?.data?.order || null;
        const designDownload = response?.data?.design_download;
        setOrder(responseOrder);

        if (designDownload?.should_download && Array.isArray(designDownload?.designs)) {
          setDownloadingDesign(true);
          try {
            const downloadResult = await downloadOrderItemDesigns({
              orderNumber: responseOrder?.order_number || nextOrderNumber,
              designs: designDownload.designs,
            });
            if (downloadResult?.downloaded) {
              message.success("Design files downloaded.");
            }
          } catch (downloadError) {
            message.error(downloadError?.message || "Design files could not be downloaded.");
          } finally {
            setDownloadingDesign(false);
          }
        }
      } catch (error) {
        setOrder(null);
        message.error(error?.response?.data?.error?.message || tDetail("messages.loadOrderError"));
      } finally {
        setSearching(false);
      }
    },
    [categoryId, message, orderNumber, subCategoryId, tDetail, tOrders]
  );

  const handlePaste = useCallback(
    (event) => {
      const pastedValue = event?.clipboardData?.getData("text") || "";
      const normalizedOrderNumber = String(pastedValue).trim();
      if (!normalizedOrderNumber) return;
      event.preventDefault();
      setOrderNumber(normalizedOrderNumber);
      handleSearch(normalizedOrderNumber);
    },
    [handleSearch]
  );

  return (
    <RequireRole anyOfRoles={["companyCompletedWorker"]}>
      <div className="space-y-4 p-4">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Printer
        </Typography.Title>

        <Card className="rounded-2xl">
          <Input.Search
            allowClear
            enterButton={
              <Button type="primary" loading={searching}>
                {tCommonActions("search")}
              </Button>
            }
            placeholder={tOrders("filters.searchOrderNumber")}
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            onSearch={handleSearch}
            onPaste={handlePaste}
          />
        </Card>

        {downloadingDesign ? (
          <Alert
            type="info"
            showIcon
            message="Design files are being prepared for download."
          />
        ) : null}

        {searching && !order ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : null}

        {positionsLoading ? (
          <Typography.Text type="secondary">Loading product positions...</Typography.Text>
        ) : null}

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => {
              const productId = String(item?.product_id || item?.product?.id || "");
              const positions = positionsByProductId[productId] || [];
              const positionMap = new Map(
                positions.map((position) => [String(position?.id), position])
              );

              return (
                <OrderItemCard
                  key={item?.id}
                  item={item}
                  positionMap={positionMap}
                  tOrders={tOrders}
                  tDetail={tDetail}
                  fallbackText={fallbackText}
                />
              );
            })}
          </div>
        ) : null}

        {searched && !searching && !items.length ? (
          <Empty description={tDetail("messages.noItems")} />
        ) : null}
      </div>
    </RequireRole>
  );
}
