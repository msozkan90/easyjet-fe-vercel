"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  Input,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { ExportOutlined } from "@ant-design/icons";
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

const formatCurrency = (value, currency = "USD") => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    return formatAmount(numericValue);
  }
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

function LazyPreviewImage({ src, alt, preparingText, emptyText }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 8,
          overflow: "hidden",
          background: "#f5f5f5",
          border: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography.Text type="secondary">{emptyText}</Typography.Text>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: 8,
        overflow: "hidden",
        background: "#f5f5f5",
        border: "1px solid #f0f0f0",
      }}
    >
      <img
        src={src}
        alt={alt || preparingText}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

const TransferOrderItemCard = ({ item, tOrders }) => {
  const options = normalizeOptions(item?.options);
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card
      className="rounded-2xl border border-slate-100 shadow-sm"
      bodyStyle={{ padding: 20 }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {item?.name || tOrders("columns.item")}
          </Typography.Title>
          <Tag color="gold">
            {tOrders("columns.quantity")}:{" "}
            {item?.quantity ?? tOrders("common.none")}
          </Tag>
          <Tag color="green">
            {tOrders("columns.price")}: {formatAmount(item?.price)}
          </Tag>
          <Tag color={STATUS_COLORS[statusKey] || "default"}>
            {tOrders("columns.status")}: {statusLabel}
          </Tag>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Typography.Text type="secondary">
              {tOrders("columns.product")}
            </Typography.Text>
            <div className="font-medium">
              {item?.product?.name || tOrders("common.none")}
            </div>
          </div>
          <div>
            <Typography.Text type="secondary">
              {tOrders("columns.notes")}
            </Typography.Text>
            <div className="font-medium">
              {item?.notes || tOrders("common.none")}
            </div>
          </div>
        </div>

        <div>
          <Typography.Text type="secondary">
            {tOrders("columns.options")}
          </Typography.Text>
          {options.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((option, index) => (
                <span
                  key={`${option?.name || "option"}-${index}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                >
                  {option?.name || tOrders("common.none")}:{" "}
                  {option?.value || tOrders("common.none")}
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
  const tDetail = useTranslations("dashboard.orders.transferDetail");
  const tCommonActions = useTranslations("common.actions");
  const autoDownloadedLabelRef = useRef("");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [transferLabel, setTransferLabel] = useState(null);
  const [designGroups, setDesignGroups] = useState([]);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingModalRecord, setShippingModalRecord] = useState(null);
  const [voidingLabelId, setVoidingLabelId] = useState(null);

  const triggerLabelDownload = useCallback((labelUrl, selectedOrderNumber) => {
    if (!labelUrl) return;
    if (typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = labelUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = `${selectedOrderNumber || "transfer-order"}-label.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

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
        const latestLabel = payload?.transfer_label || null;

        setItems(scopedItems);
        setTransferLabel(latestLabel);
        setDesignGroups(
          Array.isArray(transferOrder?.design_groups)
            ? transferOrder.design_groups
            : [],
        );
        setOrderSummary(
          transferOrder
            ? {
                id: transferOrder?.id || null,
                order_number: transferOrder?.order_number || null,
                bill_to_name: transferOrder?.bill_to_name || null,
                status: transferOrder?.order_status || null,
                currency: transferOrder?.currency || "USD",
                barcode_url: transferOrder?.barcode_url || null,
                order_date: transferOrder?.order_date || null,
                fullfillment_location:
                  transferOrder?.fullfillment_location || null,
                local_pickup: Boolean(transferOrder?.local_pickup),
                shipping_address: transferOrder?.shipping_address || null,
              }
            : null,
        );

        if (payload?.shipped === true && latestLabel?.label_url) {
          const labelIdentity = `${latestLabel?.id || ""}:${latestLabel.label_url}`;
          if (autoDownloadedLabelRef.current !== labelIdentity) {
            autoDownloadedLabelRef.current = labelIdentity;
            triggerLabelDownload(
              latestLabel.label_url,
              transferOrder?.order_number || nextOrderNumber,
            );
          }
        }

        if (requiresLabelCreation && transferOrder?.id) {
          const orderTotal =
            scopedItems.reduce((sum, item) => {
              const unitPrice = Number(item?.price);
              const quantity = Number(item?.quantity ?? 1);
              if (!Number.isFinite(unitPrice)) return sum;
              return (
                sum +
                unitPrice *
                  (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
              );
            }, 0) || 0;

          setShippingModalRecord({
            ...transferOrder,
            order_total: orderTotal,
            items: scopedItems,
          });
          setShippingModalOpen(true);
          message.warning(tOrders("messages.transferLabelRequired"));
        } else {
          setShippingModalRecord(null);
          setShippingModalOpen(false);
        }
      } catch (error) {
        setItems([]);
        setOrderSummary(null);
        setTransferLabel(null);
        setDesignGroups([]);
        setShippingModalRecord(null);
        setShippingModalOpen(false);
        message.error(
          error?.response?.data?.error?.message ||
            tOrders("messages.loadListError"),
        );
      } finally {
        setSearching(false);
      }
    },
    [message, orderNumber, tOrders, triggerLabelDownload],
  );

  const handleCreateLabelSuccess = useCallback((payload) => {
    const latestLabel = payload?.transfer_label || null;
    if (latestLabel) {
      setTransferLabel(latestLabel);
    }
    setShippingModalOpen(false);
    setShippingModalRecord(null);
  }, []);

  const handleVoidLabel = useCallback(async () => {
    const transferOrderId = orderSummary?.id || shippingModalRecord?.id;
    const labelId = transferLabel?.id || transferLabel?.label_id;
    if (!transferOrderId || !labelId) {
      message.error(tOrders("detail.messages.voidLabelError"));
      return;
    }

    setVoidingLabelId(String(labelId));
    try {
      await TransferOrdersAPI.voidWorkerShipmentLabel({
        transfer_order_id: transferOrderId,
        label_id: labelId,
      });
      message.success(tOrders("detail.messages.voidLabelSuccess"));
      setTransferLabel(null);
      autoDownloadedLabelRef.current = "";
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tOrders("detail.messages.voidLabelError"),
      );
    } finally {
      setVoidingLabelId(null);
    }
  }, [
    message,
    orderSummary?.id,
    shippingModalRecord?.id,
    tOrders,
    transferLabel,
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
          {tOrders("workerShipmentPrinter.title")}
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
                  {tOrders("columns.customerName")}:{" "}
                  {orderSummary?.bill_to_name || tOrders("common.none")}
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

        {transferLabel ? (
          <Card
            className="rounded-2xl border border-slate-100"
            title={tOrders("detail.fields.labels")}
          >
            <Descriptions
              column={{ xs: 1, sm: 2, md: 3 }}
              size="small"
              bordered
            >
              <Descriptions.Item label={tOrders("detail.fields.labelSource")}>
                {transferLabel?.source || tOrders("common.none")}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("detail.fields.labelRate")}>
                {transferLabel?.base_shipping_price != null ? (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      Price:{" "}
                      {formatCurrency(
                        transferLabel.base_shipping_price,
                        orderSummary?.currency || "USD",
                      )}
                    </Typography.Text>
                    <Typography.Text>
                      Total:{" "}
                      {formatCurrency(
                        transferLabel.shipment_total_price ??
                          transferLabel.shipping_price,
                        orderSummary?.currency || "USD",
                      )}
                      {transferLabel?.shipment_multiplier != null
                        ? ` x ${formatAmount(transferLabel.shipment_multiplier)}`
                        : ""}
                    </Typography.Text>
                  </Space>
                ) : transferLabel?.shipping_price != null ? (
                  formatCurrency(
                    transferLabel.shipping_price,
                    orderSummary?.currency || "USD",
                  )
                ) : (
                  tOrders("common.none")
                )}
              </Descriptions.Item>
              <Descriptions.Item
                label={tOrders("detail.fields.labelCreatedAt")}
              >
                {transferLabel?.created_at
                  ? moment(transferLabel.created_at).format("LLL")
                  : tOrders("common.none")}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("detail.fields.labelTracking")}>
                {transferLabel?.tracking_number || tOrders("common.none")}
              </Descriptions.Item>
              <Descriptions.Item
                label={tOrders("detail.actions.viewLabel")}
                span={2}
              >
                <Space wrap>
                  {transferLabel?.label_url ? (
                    <Button
                      icon={<ExportOutlined />}
                      onClick={() =>
                        triggerLabelDownload(
                          transferLabel.label_url,
                          orderSummary?.order_number || orderNumber,
                        )
                      }
                    >
                      {tOrders("actions.download")}
                    </Button>
                  ) : (
                    tOrders("common.none")
                  )}
                  {(transferLabel?.id || transferLabel?.label_id) &&
                  orderSummary?.status !== "shipped" ? (
                    <Popconfirm
                      title={tOrders("detail.actions.voidLabelConfirmTitle")}
                      okText={tOrders("detail.actions.voidLabelConfirmOk")}
                      okButtonProps={{
                        danger: true,
                        loading:
                          voidingLabelId ===
                          String(
                            transferLabel?.id || transferLabel?.label_id || "",
                          ),
                      }}
                      onConfirm={handleVoidLabel}
                    >
                      <Button
                        danger
                        loading={
                          voidingLabelId ===
                          String(
                            transferLabel?.id || transferLabel?.label_id || "",
                          )
                        }
                      >
                        {tOrders("detail.actions.voidLabel")}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ) : null}

        {designGroups.length ? (
          <Card title={tDetail("sections.uploadedDesigns")}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {designGroups.map((group, groupIndex) => (
                <Card
                  key={group?.sub_category_id || `group-${groupIndex}`}
                  type="inner"
                  title={group?.sub_category_name || "-"}
                  extra={
                    <Typography.Text strong>
                      {formatCurrency(
                        group?.total_price,
                        orderSummary?.currency || "USD",
                      )}
                    </Typography.Text>
                  }
                >
                  <Row gutter={[12, 12]}>
                    {(Array.isArray(group?.designs) ? group.designs : []).map(
                      (design) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={design?.id}>
                          <Card size="small" styles={{ body: { padding: 10 } }}>
                            <Space
                              direction="vertical"
                              size={8}
                              style={{ width: "100%" }}
                            >
                              <LazyPreviewImage
                                src={design?.design_url}
                                alt={`design-${design?.id}`}
                                preparingText={tDetail("preview.preparing")}
                                emptyText={tDetail("preview.empty")}
                              />
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                              >
                                {tDetail("designCard.size")}:{" "}
                                {formatAmount(design?.width)}" x{" "}
                                {formatAmount(design?.height)}"
                              </Typography.Text>
                              <Typography.Text strong>
                                {tDetail("designCard.price")}:{" "}
                                {formatCurrency(
                                  design?.price,
                                  orderSummary?.currency || "USD",
                                )}
                              </Typography.Text>
                              <Typography.Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                              >
                                {design?.created_at
                                  ? moment(design.created_at).format("LLL")
                                  : "-"}
                              </Typography.Text>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <Button
                                  size="small"
                                  icon={<ExportOutlined />}
                                  onClick={() => {
                                    if (!design?.design_url) return;
                                    window.open(
                                      design.design_url,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }}
                                >
                                  {tDetail("actions.open")}
                                </Button>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      ),
                    )}
                  </Row>
                </Card>
              ))}
            </Space>
          </Card>
        ) : null}

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => (
              <TransferOrderItemCard
                key={item?.id}
                item={item}
                tOrders={tOrders}
              />
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
