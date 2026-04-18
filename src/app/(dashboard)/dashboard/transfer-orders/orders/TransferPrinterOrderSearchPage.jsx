"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Descriptions,
  Image,
  Input,
  Spin,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const STATUS_COLORS = {
  newOrder: "geekblue",
  processing: "purple",
  downloaded: "blue",
  printed: "cyan",
  shipped: "gold",
  waitingForDesign: "orange",
  cancel: "red",
  refund: "volcano",
  remake: "magenta",
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

export default function TransferPrinterOrderSearchPage({ categoryId, subCategoryId }) {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tCommonActions = useTranslations("common.actions");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [designGroups, setDesignGroups] = useState([]);

  const handlePastePrint = useCallback(
    async (rawOrderNumber) => {
      const nextOrderNumber = String(rawOrderNumber || orderNumber).trim();
      if (!nextOrderNumber) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }
      if (!categoryId || !subCategoryId) return;

      setSearching(true);
      setPrinting(true);
      try {
        const response = await TransferOrdersAPI.markWorkerItemsPrinted({
          order_number: nextOrderNumber,
          category_id: categoryId,
          sub_category_id: subCategoryId,
        });
        const payload = response?.data || null;

        if (payload?.transfer_order) {
          setOrderSummary({
            order_number: payload?.transfer_order?.order_number || null,
            bill_to_name: payload?.transfer_order?.bill_to_name || null,
            status: payload?.transfer_order?.order_status || null,
            barcode_url: payload?.transfer_order?.barcode_url || null,
            order_date: payload?.transfer_order?.order_date || null,
            delivery_method: payload?.transfer_order?.delivery_method || null,
            local_pickup: Boolean(payload?.transfer_order?.local_pickup),
          });
        }

        const nextItems = Array.isArray(payload?.items) ? payload.items : [];
        setItems(nextItems);
        setDesignGroups(Array.isArray(payload?.design_groups) ? payload.design_groups : []);
        setSearched(true);
        message.success(tOrders("messages.transferItemsPrintedSuccess"));
      } catch (error) {
        setItems([]);
        setOrderSummary(null);
        setDesignGroups([]);
        setSearched(true);
        message.error(
          error?.response?.data?.error?.message || tOrders("messages.transferItemsPrintedError"),
        );
      } finally {
        setSearching(false);
        setPrinting(false);
      }
    },
    [categoryId, message, orderNumber, subCategoryId, tOrders],
  );

  const statusTag = useMemo(() => {
    if (!orderSummary?.status) return null;
    const key = orderSummary.status;
    const label = tOrders(`status.values.${key}`) || key;
    return <Tag color={STATUS_COLORS[key] || "default"}>{label}</Tag>;
  }, [orderSummary?.status, tOrders]);

  return (
    <RequireRole anyOfRoles={["companyAdmin", "companyCompletedWorker"]}>
      <div className="space-y-4 p-4">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {tOrders("workerPrinter.title")}
        </Typography.Title>

        <Card className="rounded-2xl">
          <Input.Search
            allowClear
            enterButton={
              <Button type="primary" loading={searching || printing}>
                {tCommonActions("search")}
              </Button>
            }
            placeholder={tOrders("filters.searchOrderNumber")}
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
            onPaste={(event) => {
              const pasted = event?.clipboardData?.getData("text");
              const nextOrderNumber = String(pasted || "").trim();
              if (!nextOrderNumber) return;
              event.preventDefault();
              setOrderNumber(nextOrderNumber);
              void handlePastePrint(nextOrderNumber);
            }}
            onSearch={(value) => {
              void handlePastePrint(value);
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
            {orderSummary?.delivery_method ? (
              <Alert
                className="mt-3"
                type="info"
                showIcon
                message={`${tOrders("columns.deliveryMethod")}: ${orderSummary.delivery_method}`}
              />
            ) : null}
          </Card>
        ) : null}

        {designGroups.length ? (
          <Card className="rounded-2xl border border-slate-100">
            <Descriptions
              size="small"
              bordered
              column={1}
              items={[
                {
                  key: "design_groups",
                  label: tOrders("detail.designs.title"),
                  children: (
                    <div className="space-y-4">
                      {designGroups.map((group) => {
                        const groupDesigns = Array.isArray(group?.designs) ? group.designs : [];
                        return (
                          <div key={String(group?.sub_category_id || "sub-category")} className="space-y-2">
                            <Typography.Text strong>
                              {group?.sub_category_name || tOrders("common.none")}
                            </Typography.Text>
                            {groupDesigns.length ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {groupDesigns.map((design) => (
                                  <Image
                                    key={String(design?.id || design?.design_url)}
                                    src={design?.design_url}
                                    alt="transfer-design"
                                    style={{
                                      width: "100%",
                                      maxHeight: 220,
                                      objectFit: "cover",
                                      borderRadius: 8,
                                      border: "1px solid #f1f5f9",
                                    }}
                                    preview
                                  />
                                ))}
                              </div>
                            ) : (
                              <Typography.Text type="secondary">
                                {tOrders("detail.designs.empty")}
                              </Typography.Text>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ),
                },
              ]}
            />
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
    </RequireRole>
  );
}
