"use client";

import { useCallback, useMemo, useState } from "react";
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
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { downloadOrderLabel } from "@/utils/orderItemDesignDownloads";

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

const OrderItemCard = ({ item, tOrders }) => {
  const options = Array.isArray(item?.options) ? item.options : [];
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
              <Empty description={tOrders("common.none")} />
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
        </div>
      </div>
    </Card>
  );
};

export default function ShippedOrderPrinterSearchPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.detail");
  const tCommonActions = useTranslations("common.actions");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [downloadingLabel, setDownloadingLabel] = useState(false);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState(null);

  const items = useMemo(() => {
    if (!Array.isArray(order?.items)) return [];
    return order.items;
  }, [order]);

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
        const response = await OrdersAPI.shippedItems({
          order_number: nextOrderNumber,
        });

        const responseOrder = response?.data?.order || null;
        const labelUrl = response?.data?.label_download?.label_url;

        setOrder(responseOrder);

        if (labelUrl) {
          setDownloadingLabel(true);
          try {
            const downloadResult = await downloadOrderLabel({
              orderNumber: responseOrder?.order_number || nextOrderNumber,
              labelUrl,
            });
            if (downloadResult?.downloaded) {
              message.success("Label downloaded.");
            }
          } catch (downloadError) {
            message.error(downloadError?.message || "Label could not be downloaded.");
          } finally {
            setDownloadingLabel(false);
          }
        }
      } catch (error) {
        setOrder(null);
        message.error(error?.response?.data?.error?.message || tDetail("messages.loadOrderError"));
      } finally {
        setSearching(false);
      }
    },
    [message, orderNumber, tDetail, tOrders]
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
    <RequireRole anyOfRoles={["companyShipmentWorker"]}>
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

        {downloadingLabel ? (
          <Alert
            type="info"
            showIcon
            message="Shipping label is being prepared for download."
          />
        ) : null}

        {searching && !order ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : null}

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => (
              <OrderItemCard key={item?.id} item={item} tOrders={tOrders} />
            ))}
          </div>
        ) : null}

        {searched && !searching && !items.length ? (
          <Empty description={tDetail("messages.noItems")} />
        ) : null}
      </div>
    </RequireRole>
  );
}
