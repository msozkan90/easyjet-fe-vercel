"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import {
  GuardedPreviewImage,
} from "@/components/common/media/ImagePreviewGate";
import DesignThumbnailImage from "@/components/common/media/DesignThumbnailImage";
import TransferShippingRatesModal from "@/components/modals/TransferShippingRatesModal";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { printOrderLabel } from "@/utils/orderItemDesignDownloads";

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

const normalizeShippingChecklist = (rawChecklist) => ({
  designs: Array.isArray(rawChecklist?.designs) ? rawChecklist.designs : [],
  without_design_items: Array.isArray(rawChecklist?.without_design_items)
    ? rawChecklist.without_design_items
    : [],
});

const getChecklistOptionText = (entry) => {
  const options = normalizeOptions(entry?.options);
  if (!options.length) return "";
  return options
    .map((option) => `${option?.name || "Option"}: ${option?.value || "-"}`)
    .join(", ");
};

const TransferOrderItemCard = ({
  item,
  tOrders,
  tDetail,
  tCommonActions,
  currency,
}) => {
  const options = normalizeOptions(item?.options);
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");
  const productName =
    item?.transfer_product?.name ||
    item?.product?.name ||
    tOrders("common.none");
  const designs = Array.isArray(item?.designs) ? item.designs : [];

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
            <div className="font-medium">{productName}</div>
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

        <div>
          <Typography.Text type="secondary">
            {tDetail("sections.uploadedDesigns")}
          </Typography.Text>
          {designs.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {designs.map((design) => (
                <Card
                  key={String(design?.id || design?.design_url)}
                  size="small"
                  styles={{ body: { padding: 10 } }}
                >
                  <Space
                    direction="vertical"
                    size={8}
                    style={{ width: "100%" }}
                  >
                    <DesignThumbnailImage
                      design={design}
                      alt={`design-${design?.id}`}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {tDetail("designCard.size")}:{" "}
                      {formatAmount(design?.width)}" x{" "}
                      {formatAmount(design?.height)}"
                    </Typography.Text>
                    <Typography.Text strong>
                      {tDetail("designCard.price")}:{" "}
                      {formatCurrency(design?.price, currency || "USD")}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {design?.created_at
                        ? moment(design.created_at).format("LLL")
                        : "-"}
                    </Typography.Text>
                  </Space>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-sm">
              {tDetail("messages.noUploadedDesigns")}
            </div>
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
  const autoPrintedLabelRef = useRef("");

  const [orderNumber, setOrderNumber] = useState("");
  const [transferOrderId, setTransferOrderId] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [transferLabel, setTransferLabel] = useState(null);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingModalRecord, setShippingModalRecord] = useState(null);
  const [voidingLabelId, setVoidingLabelId] = useState(null);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [shippingChecklist, setShippingChecklist] = useState({
    designs: [],
    without_design_items: [],
  });
  const [printingLabel, setPrintingLabel] = useState(false);
  const [checkedChecklistKeys, setCheckedChecklistKeys] = useState([]);
  const [pendingChecklistOrderId, setPendingChecklistOrderId] = useState("");
  const [confirmingChecklist, setConfirmingChecklist] = useState(false);

  const triggerLabelPrint = useCallback(
    async (labelUrl) => {
      if (!labelUrl) return;
      setPrintingLabel(true);
      try {
        const printResult = await printOrderLabel({ labelUrl });
        if (printResult?.printed) {
          message.success(tOrders("scanner.messages.labelPrintOpened"));
        }
      } catch (error) {
        message.error(
          error?.message || tOrders("scanner.messages.labelPrintError"),
        );
      } finally {
        setPrintingLabel(false);
      }
    },
    [message, tOrders],
  );

  const checklistRequiredKeys = useMemo(() => {
    const designs = shippingChecklist.designs.map(
      (design) => `design:${design?.id}`,
    );
    const withoutDesignItems = shippingChecklist.without_design_items.map(
      (item) => `without-design-item:${item?.id}`,
    );
    return [...designs, ...withoutDesignItems].filter(
      (key) => !key.endsWith(":undefined"),
    );
  }, [shippingChecklist]);

  const allChecklistItemsChecked =
    checklistRequiredKeys.length > 0 &&
    checklistRequiredKeys.every((key) => checkedChecklistKeys.includes(key));

  const applyShipmentPayload = useCallback(
    ({
      payload,
      selectedTransferOrderId,
      resetChecklist = false,
      openChecklist = false,
    }) => {
      const transferOrder = payload?.transfer_order || null;
      const scopedItems = Array.isArray(payload?.items) ? payload.items : [];
      const requiresLabelCreation = payload?.requires_label_creation === true;
      const latestLabel = payload?.transfer_label || null;
      const nextChecklist = normalizeShippingChecklist(payload?.checklist);
      const hasChecklistItems =
        nextChecklist.designs.length > 0 ||
        nextChecklist.without_design_items.length > 0;

      setItems(scopedItems);
      setTransferLabel(latestLabel);
      setOrderNumber(transferOrder?.order_number || "");
      setTransferOrderId(selectedTransferOrderId);
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
              delivery_method: transferOrder?.delivery_method || null,
              fullfillment_location:
                transferOrder?.fullfillment_location || null,
              local_pickup: Boolean(transferOrder?.local_pickup),
              shipping_address: transferOrder?.shipping_address || null,
            }
          : null,
      );
      setShippingChecklist(nextChecklist);
      setPendingChecklistOrderId(selectedTransferOrderId);
      if (resetChecklist) {
        setCheckedChecklistKeys([]);
      }

      if (payload?.shipped === true && latestLabel?.label_url) {
        const labelIdentity = `${latestLabel?.id || ""}:${latestLabel.label_url}`;
        if (autoPrintedLabelRef.current !== labelIdentity) {
          autoPrintedLabelRef.current = labelIdentity;
          void triggerLabelPrint(latestLabel.label_url);
        }
      }

      if (openChecklist && hasChecklistItems && payload?.shipped !== true) {
        setChecklistModalOpen(true);
        setShippingModalRecord(null);
        setShippingModalOpen(false);
        return;
      }

      if (requiresLabelCreation && transferOrder?.id) {
        const orderTotal =
          scopedItems.reduce((sum, item) => {
            const itemPrice = Number(item?.price);
            if (!Number.isFinite(itemPrice)) return sum;
            return sum + itemPrice;
          }, 0) || 0;

        setChecklistModalOpen(false);
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
        if (payload?.shipped === true) {
          setChecklistModalOpen(false);
        }
      }
    },
    [message, tOrders, triggerLabelPrint],
  );

  const handleSearch = useCallback(
    async (rawTransferOrderId) => {
      const nextTransferOrderId = String(
        rawTransferOrderId || transferOrderId || orderNumber,
      ).trim();
      if (!nextTransferOrderId) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }

      setSearching(true);
      setSearched(true);

      try {
        const response = await TransferOrdersAPI.shipWorkerItems({
          transfer_order_id: nextTransferOrderId,
        });
        const payload = response?.data || {};
        applyShipmentPayload({
          payload,
          selectedTransferOrderId: nextTransferOrderId,
          resetChecklist: true,
          openChecklist: payload?.requires_checklist === true,
        });
      } catch (error) {
        setItems([]);
        setOrderSummary(null);
        setTransferLabel(null);
        setShippingModalRecord(null);
        setShippingModalOpen(false);
        setChecklistModalOpen(false);
        setShippingChecklist({ designs: [], without_design_items: [] });
        setCheckedChecklistKeys([]);
        setPendingChecklistOrderId("");
        message.error(
          error?.response?.data?.error?.message ||
            tOrders("messages.loadListError"),
        );
      } finally {
        setSearching(false);
      }
    },
    [applyShipmentPayload, message, orderNumber, tOrders, transferOrderId],
  );

  const confirmShipSearch = useCallback(
    (rawTransferOrderId) => {
      const nextTransferOrderId = String(
        rawTransferOrderId || transferOrderId || orderNumber,
      ).trim();
      if (!nextTransferOrderId) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }
      void handleSearch(nextTransferOrderId);
    },
    [handleSearch, message, orderNumber, tOrders, transferOrderId],
  );

  const handleCreateLabelSuccess = useCallback(
    (payload) => {
      const latestLabel = payload?.transfer_label || null;
      if (latestLabel) {
        setTransferLabel(latestLabel);
      }
      setShippingModalOpen(false);
      setShippingModalRecord(null);
      if (checklistRequiredKeys.length) {
        setChecklistModalOpen(true);
      }
    },
    [checklistRequiredKeys.length],
  );

  const handleChecklistConfirm = useCallback(async () => {
    const nextTransferOrderId = String(
      pendingChecklistOrderId || transferOrderId || orderNumber,
    ).trim();
    if (!nextTransferOrderId) {
      message.warning(tOrders("filters.searchOrderNumber"));
      return;
    }
    if (!allChecklistItemsChecked) {
      message.warning("Please complete the shipping checklist.");
      return;
    }

    const checkedDesignIds = checkedChecklistKeys
      .filter((key) => key.startsWith("design:"))
      .map((key) => key.replace("design:", ""));
    const checkedWithoutDesignItemIds = checkedChecklistKeys
      .filter((key) => key.startsWith("without-design-item:"))
      .map((key) => key.replace("without-design-item:", ""));

    setConfirmingChecklist(true);
    try {
      const response = await TransferOrdersAPI.shipWorkerItems({
        transfer_order_id: nextTransferOrderId,
        confirm_checklist: true,
        checked_design_ids: checkedDesignIds,
        checked_without_design_item_ids: checkedWithoutDesignItemIds,
      });
      const payload = response?.data || {};
      applyShipmentPayload({
        payload,
        selectedTransferOrderId: nextTransferOrderId,
        resetChecklist: false,
        openChecklist: false,
      });
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tOrders("messages.loadListError"),
      );
    } finally {
      setConfirmingChecklist(false);
    }
  }, [
    allChecklistItemsChecked,
    applyShipmentPayload,
    checkedChecklistKeys,
    message,
    orderNumber,
    pendingChecklistOrderId,
    tOrders,
    transferOrderId,
  ]);

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
      autoPrintedLabelRef.current = "";
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
            onChange={(event) => {
              const value = event.target.value;
              setOrderNumber(value);
              setTransferOrderId(value);
            }}
            onSearch={() => confirmShipSearch()}
            onPaste={(event) => {
              const pastedValue = event?.clipboardData?.getData("text") || "";
              const normalizedOrderNumber = String(pastedValue).trim();
              if (!normalizedOrderNumber) return;
              event.preventDefault();
              setOrderNumber(normalizedOrderNumber);
              setTransferOrderId(normalizedOrderNumber);
              confirmShipSearch(normalizedOrderNumber);
            }}
          />
        </Card>

        {searching ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : null}

        {printingLabel ? (
          <Alert
            type="info"
            showIcon
            message={tOrders("scanner.messages.labelPrintPreparing")}
          />
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
                <GuardedPreviewImage
                  src={orderSummary.barcode_url}
                  alt={`${orderSummary?.order_number || "transfer-order"}-barcode`}
                  width={120}
                  openLabel={tCommonActions("open")}
                  preparingText={tDetail("preview.preparing")}
                  emptyText={tOrders("common.none")}
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
                      Label Price:{" "}
                      {formatCurrency(
                        transferLabel.base_shipping_price,
                        orderSummary?.currency || "USD",
                      )}
                    </Typography.Text>
                    {transferLabel?.source === "shipStationCompany" && (
                      <Typography.Text>
                        With Multiplier:{" "}
                        {formatCurrency(
                          transferLabel.shipment_total_price ??
                            transferLabel.shipping_price,
                          orderSummary?.currency || "USD",
                        )}
                      </Typography.Text>
                    )}
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
                      icon={<PrinterOutlined />}
                      loading={printingLabel}
                      onClick={() =>
                        void triggerLabelPrint(transferLabel.label_url)
                      }
                    >
                      {tOrders("actions.printLabel")}
                    </Button>
                  ) : (
                    tOrders("common.none")
                  )}
                  {(transferLabel?.id || transferLabel?.label_id) &&
                  transferLabel?.source !== "self_label" &&
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

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => (
              <TransferOrderItemCard
                key={item?.id}
                item={item}
                tOrders={tOrders}
                tDetail={tDetail}
                tCommonActions={tCommonActions}
                currency={orderSummary?.currency || "USD"}
              />
            ))}
          </div>
        ) : null}

        {searched && !searching && !items.length ? (
          <Empty description={tOrders("messages.noItems")} />
        ) : null}
      </div>
      <Modal
        open={checklistModalOpen}
        title="Shipping checklist"
        okText="Confirm shipment"
        cancelText={tCommonActions("cancel")}
        okButtonProps={{
          disabled: !allChecklistItemsChecked,
          loading: confirmingChecklist,
        }}
        onOk={handleChecklistConfirm}
        onCancel={() => setChecklistModalOpen(false)}
        width={760}
        destroyOnClose={false}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Check every design and without-design item before shipping this transfer order."
          />

          <Checkbox.Group
            value={checkedChecklistKeys}
            onChange={(values) => setCheckedChecklistKeys(values)}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  Designs
                </Typography.Title>
                {shippingChecklist.designs.length ? (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {shippingChecklist.designs.map((design) => {
                      const designKey = `design:${design?.id}`;
                      return (
                        <div
                          key={designKey}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <Checkbox value={designKey} />
                          <div className="h-14 w-14 flex-none overflow-hidden rounded border border-slate-100 bg-slate-50">
                            {design?.design_url ? (
                              <DesignThumbnailImage
                                design={design}
                                alt={`shipping-checklist-design-${design?.id}`}
                                width={56}
                                preview
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Typography.Text strong className="block truncate">
                              {design?.name ||
                                design?.sub_category_name ||
                                "Design"}
                            </Typography.Text>
                            <Typography.Text type="secondary" className="block">
                              {design?.sub_category_name || "-"}
                            </Typography.Text>
                          </div>
                          <div className="flex flex-none flex-wrap justify-end gap-2">
                            <Tag color="blue">
                              Qty: {design?.quantity ?? "-"}
                            </Tag>
                            <Tag>
                              {formatAmount(design?.width)}" x{" "}
                              {formatAmount(design?.height)}"
                            </Tag>
                            <Tag
                              color={STATUS_COLORS[design?.status] || "default"}
                            >
                              {design?.status || "-"}
                            </Tag>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No designs"
                  />
                )}
              </div>

              <Divider style={{ margin: 0 }} />

              <div>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  Without-design items
                </Typography.Title>
                {shippingChecklist.without_design_items.length ? (
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {shippingChecklist.without_design_items.map((item) => {
                      const itemKey = `without-design-item:${item?.id}`;
                      const optionText = getChecklistOptionText(item);
                      return (
                        <div
                          key={itemKey}
                          className="flex items-center gap-3 px-3 py-2"
                        >
                          <Checkbox value={itemKey} />
                          <div className="min-w-0 flex-1">
                            <Typography.Text strong className="block truncate">
                              {item?.name ||
                                item?.transfer_product?.name ||
                                "Without-design item"}
                            </Typography.Text>
                            <Typography.Text type="secondary" className="block">
                              {item?.transfer_product?.name || "-"}
                            </Typography.Text>
                            {optionText ? (
                              <Typography.Text
                                type="secondary"
                                className="block truncate"
                              >
                                {optionText}
                              </Typography.Text>
                            ) : null}
                          </div>
                          <div className="flex flex-none flex-wrap justify-end gap-2">
                            <Tag color="blue">Qty: {item?.quantity ?? "-"}</Tag>
                            <Tag color="green">{formatAmount(item?.price)}</Tag>
                            <Tag
                              color={STATUS_COLORS[item?.status] || "default"}
                            >
                              {item?.status || "-"}
                            </Tag>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No without-design items"
                  />
                )}
              </div>
            </Space>
          </Checkbox.Group>
        </Space>
      </Modal>
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
