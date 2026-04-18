"use client";

import { useCallback, useMemo, useState } from "react";
import {
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
import TransferShippingRatesModal from "@/components/modals/TransferShippingRatesModal";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const STATUS_COLORS = {
  newOrder: "geekblue",
  processing: "purple",
  downloaded: "blue",
  printed: "green",
  shipped: "gold",
  waitingForDesign: "orange",
  cancel: "red",
  refund: "volcano",
  remake: "magenta",
};

const formatAmount = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return value;
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const normalizeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((entry) => ({
        name: entry?.name,
        value: entry?.value,
      }))
      .filter((entry) => entry.name || entry.value);
  }
  if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions).map(([name, value]) => ({
      name,
      value: value == null ? "" : String(value),
    }));
  }
  return [];
};

const TransferOrderItemCard = ({ item, tOrders }) => {
  const options = normalizeOptions(item?.options);
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm" bodyStyle={{ padding: 20 }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {item?.name || tOrders("columns.item")}
          </Typography.Title>
          <Tag color="gold">
            {tOrders("columns.quantity")}: {item?.quantity ?? tOrders("common.none")}
          </Tag>
          <Tag color="green">{tOrders("columns.price")}: {formatAmount(item?.price)}</Tag>
          <Tag color={STATUS_COLORS[statusKey] || "default"}>
            {tOrders("columns.status")}: {statusLabel}
          </Tag>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Typography.Text type="secondary">{tOrders("columns.product")}</Typography.Text>
            <div className="font-medium">{item?.product?.name || tOrders("common.none")}</div>
          </div>
          <div>
            <Typography.Text type="secondary">{tOrders("columns.notes")}</Typography.Text>
            <div className="font-medium">{item?.notes || tOrders("common.none")}</div>
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
      </div>
    </Card>
  );
};

export default function TransferShippedPrinterSearchPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tCommonActions = useTranslations("common.actions");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingModalRecord, setShippingModalRecord] = useState(null);

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
        const response = await TransferOrdersAPI.shipWorkerItems({
          order_number: nextOrderNumber,
        });
        const payload = response?.data || {};
        const transferOrder = payload?.transfer_order || null;
        const scopedItems = Array.isArray(payload?.items) ? payload.items : [];
        const requiresLabelCreation = payload?.requires_label_creation === true;

        setItems(scopedItems);
        setOrderSummary(
          transferOrder
            ? {
                id: transferOrder?.id || null,
                order_number: transferOrder?.order_number || null,
                bill_to_name: transferOrder?.bill_to_name || null,
                status: transferOrder?.order_status || null,
                barcode_url: transferOrder?.barcode_url || null,
                order_date: transferOrder?.order_date || null,
                fullfillment_location: transferOrder?.fullfillment_location || null,
                local_pickup: Boolean(transferOrder?.local_pickup),
                shipping_address: transferOrder?.shipping_address || null,
              }
            : null,
        );

        if (requiresLabelCreation && transferOrder?.id) {
          const orderTotal =
            scopedItems.reduce((sum, item) => {
              const unitPrice = Number(item?.price);
              const quantity = Number(item?.quantity ?? 1);
              if (!Number.isFinite(unitPrice)) return sum;
              return sum + unitPrice * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
            }, 0) || 0;

          setShippingModalRecord({
            ...transferOrder,
            order_total: orderTotal,
            items: scopedItems,
          });
          setShippingModalOpen(true);
          message.warning("Label bulunmuyor. Kargo etiketi oluşturmanız gerekiyor.");
        } else {
          setShippingModalRecord(null);
          setShippingModalOpen(false);
        }
      } catch (error) {
        setItems([]);
        setOrderSummary(null);
        setShippingModalRecord(null);
        setShippingModalOpen(false);
        message.error(error?.response?.data?.error?.message || tOrders("messages.loadListError"));
      } finally {
        setSearching(false);
      }
    },
    [message, orderNumber, tOrders],
  );

  const handleCreateLabelSuccess = useCallback(() => {
    const latestOrderNumber =
      orderSummary?.order_number || shippingModalRecord?.order_number || orderNumber;
    setShippingModalOpen(false);
    setShippingModalRecord(null);
    if (latestOrderNumber) {
      void handleSearch(latestOrderNumber);
    }
  }, [
    handleSearch,
    orderNumber,
    orderSummary?.order_number,
    shippingModalRecord?.order_number,
  ]);

  const statusTag = useMemo(() => {
    if (!orderSummary?.status) return null;
    const key = orderSummary.status;
    const label = tOrders(`status.values.${key}`) || key;
    return <Tag color={STATUS_COLORS[key] || "default"}>{label}</Tag>;
  }, [orderSummary?.status, tOrders]);

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
            onPaste={(event) => {
              const pastedValue = event?.clipboardData?.getData("text") || "";
              const normalizedOrderNumber = String(pastedValue).trim();
              if (!normalizedOrderNumber) return;
              event.preventDefault();
              setOrderNumber(normalizedOrderNumber);
              void handleSearch(normalizedOrderNumber);
            }}
          />
        </Card>

        {searching ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : null}

        {orderSummary ? (
          <Card className="rounded-2xl border border-slate-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <Typography.Title level={5} style={{ margin: 0 }}>
                  {orderSummary?.order_number || tOrders("common.none")}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {tOrders("columns.customerName")}: {orderSummary?.bill_to_name || tOrders("common.none")}
                </Typography.Text>
                <div>{statusTag}</div>
              </div>
              {orderSummary?.barcode_url ? (
                <Image
                  src={orderSummary.barcode_url}
                  alt={`${orderSummary?.order_number || "transfer-order"}-barcode`}
                  width={120}
                  preview
                />
              ) : null}
            </div>
          </Card>
        ) : null}

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => (
              <TransferOrderItemCard key={item?.id} item={item} tOrders={tOrders} />
            ))}
          </div>
        ) : null}

        {searched && !searching && !items.length ? (
          <Empty description={tOrders("messages.noItems")} />
        ) : null}
      </div>
      <TransferShippingRatesModal
        open={shippingModalOpen}
        transferOrder={shippingModalRecord}
        orderTotal={Number(shippingModalRecord?.order_total || 0)}
        onClose={() => setShippingModalOpen(false)}
        onLabelCreated={handleCreateLabelSuccess}
      />
    </RequireRole>
  );
}
