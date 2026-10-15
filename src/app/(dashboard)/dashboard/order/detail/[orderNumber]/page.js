"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { FileSearchOutlined } from "@ant-design/icons";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Tag,
  Tabs,
  Typography,
  Steps,
} from "antd";
import EntityAuditTimeline from "@/components/audit/EntityAuditTimeline";
import RequireRole from "@/components/common/Access/RequireRole";
import { GuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useParams } from "next/navigation";
import { useTranslations } from "@/i18n/use-translations";
import { resolveTrackingUrl } from "@/utils/trackingUrl";
import { useSelector } from "react-redux";
import { hasAnyRole } from "@/utils/rbac";
import GroupedOrderItemDesignPreview, {
  PositionDesignCard,
} from "@/components/orders/OrderItemDesignPreview";
import PageHeader from "@/components/ui/PageHeader";
import StatusTag from "@/components/ui/StatusTag";
import {
  AddressCard,
  InfoField,
  KeyValueList,
  SectionEmpty,
  SectionHeader,
  SideCard,
} from "@/components/orders/detail/DetailBlocks";
import { formatAmount } from "@/utils/formatMoney";

const formatDateTime = (value, fallback = "-") =>
  value ? moment(value).format("LLL") : fallback;

const isReorderedOrder = (order) => {
  if (order?.is_reordered) return true;
  const rawOrder = order?.raw_order;
  return Boolean(
    rawOrder && typeof rawOrder === "object" && rawOrder.reordered === true,
  );
};

const SCRAP_REASON_OPTIONS = [
  { value: "wrong_print", labelKey: "wrongPrint" },
  { value: "damaged_product", labelKey: "damagedProduct" },
  { value: "other", labelKey: "other" },
];

const formatUserName = (user, fallback) => {
  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || user?.email || fallback;
};

const SCRAP_REASON_DETAIL_KEY_MAP = {
  wrong_print: "wrongPrint",
  wrong_engraving: "wrongEngraving",
  apparel_issue: "apparelIssue",
  damaged_product: "damagedProduct",
  other: "other",
};

const SCRAP_SOURCE_KEY_MAP = {
  scanner: "scanner",
  order_detail: "orderDetail",
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

const LabelCard = ({
  label,
  shipmentPrice,
  tDesign,
  tOrders,
  onVoid,
  voiding,
  canManageVoid = false,
}) => {
  const detail = label?.label_detail || {};
  const source = label?.source;
  const statusValue = detail?.status || label?.status;
  const statusKey = statusValue ? String(statusValue).toLowerCase() : "";
  const labelUrl = detail?.labelUrl || label?.label_url;
  const currency = detail?.currency || "USD";
  const createdAt = formatDateTime(
    detail?.createdAt || label?.created_at,
    tOrders("common.none"),
  );
  const canVoid =
    canManageVoid &&
    source !== "self_label" &&
    source !== "rexven_label" &&
    (detail?.status === "PURCHASED" ||
      detail?.status === "completed" ||
      label?.status === "active");
  const carrierValue =
    detail?.carrier_code || detail?.carrier || tOrders("common.none");
  const serviceValue =
    detail?.service_code || detail?.service || tOrders("common.none");
  const trackingValue =
    detail?.tracking_number ||
    detail?.trackingNumber ||
    label?.tracking_number ||
    tOrders("common.none");
  const trackingUrl = resolveTrackingUrl({
    trackingNumber:
      detail?.tracking_number ||
      detail?.trackingNumber ||
      label?.tracking_number,
    trackingUrl:
      detail?.tracking_url ||
      detail?.trackingUrl ||
      label?.tracking_url ||
      label?.trackingUrl,
    carrier: detail?.carrier || label?.carrier,
    carrierCode: detail?.carrier_code || label?.carrier_code,
    service:
      detail?.service ||
      detail?.service_code ||
      label?.service ||
      label?.service_code,
  });
  const trackingDisplayValue =
    source && trackingUrl ? (
      <a
        href={trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-brand-700 underline underline-offset-2 transition hover:text-brand-800"
      >
        {trackingValue}
      </a>
    ) : source ? (
      trackingValue
    ) : (
      tOrders("common.none")
    );

  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-text-secondary">
            {tDesign("fields.labelSource")}
          </span>
          <span className="truncate text-[15px] font-semibold text-text">
            {label?.source || tOrders("common.none")}
          </span>
        </div>
        {statusValue ? (
          <StatusTag status={statusKey}>{statusValue}</StatusTag>
        ) : null}
      </div>
      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField
          label={tDesign("fields.labelCarrier")}
          value={source ? carrierValue : tOrders("common.none")}
        />
        <InfoField
          label={tDesign("fields.labelService")}
          value={source ? serviceValue : tOrders("common.none")}
        />
        <InfoField
          label={tDesign("fields.labelShippingCharged")}
          value={
            shipmentPrice == null
              ? tOrders("common.none")
              : `${formatAmount(shipmentPrice)} ${currency}`
          }
          valueClassName="ej-mono"
        />
        <InfoField
          label={tDesign("fields.labelTracking")}
          value={trackingDisplayValue}
          valueClassName="ej-mono"
        />
        <InfoField label={tDesign("fields.labelCreatedAt")} value={createdAt} />
      </div>
      {labelUrl || canVoid ? (
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          {canVoid ? (
            <Popconfirm
              title={tDesign("actions.voidLabelConfirmTitle")}
              okText={tDesign("actions.voidLabelConfirmOk")}
              okButtonProps={{ danger: true, loading: voiding }}
              onConfirm={() => onVoid?.(label)}
              disabled={!onVoid}
            >
              <Button danger loading={voiding}>
                {tDesign("actions.voidLabel")}
              </Button>
            </Popconfirm>
          ) : null}
          {labelUrl ? (
            <Button
              href={labelUrl}
              target="_blank"
              rel="noreferrer"
              icon={<FileSearchOutlined />}
            >
              {tDesign("actions.viewLabel")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

const firstDefined = (...values) =>
  values.find((value) => value !== null && value !== undefined && value !== "");

const LabelVoidCard = ({ labelVoid, tDesign, tOrders }) => {
  const detail =
    labelVoid?.void_detail && typeof labelVoid.void_detail === "object"
      ? labelVoid.void_detail
      : {};
  const detailRows =
    Array.isArray(detail?.rows) && detail.rows.length ? detail.rows : [detail];
  const status = firstDefined(labelVoid?.status, detail?.status);
  const statusKey = status ? String(status).toLowerCase() : "";
  const statusLabel = statusKey
    ? tDesign(`labelVoid.statuses.${statusKey}`)
    : tOrders("common.none");

  return (
    <Card
      className="rounded-xl border border-line"
      styles={{ body: { padding: 16 } }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tDesign("fields.labelSource")}
          </Typography.Text>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {labelVoid?.source || tOrders("common.none")}
          </Typography.Title>
        </div>
        <StatusTag status={statusKey} tone={statusKey ? undefined : "danger"}>
          {statusLabel}
        </StatusTag>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField
          label={tDesign("labelVoid.fields.recordedAt")}
          value={formatDateTime(labelVoid?.created_at, tOrders("common.none"))}
        />
      </div>

      <div className="mt-4 space-y-4">
        {detailRows.map((row, index) => {
          const safeRow = row && typeof row === "object" ? row : {};
          const externalOrderId = firstDefined(
            safeRow.externalOrderId,
            safeRow.external_order_id,
          );
          const trackingNumber = firstDefined(
            safeRow.trackingNumber,
            safeRow.tracking_number,
          );
          const shipmentId = firstDefined(
            safeRow.easypostShipmentId,
            safeRow.shipment_id,
            safeRow.shipmentId,
          );
          const requestedAt = firstDefined(
            safeRow.requestedAt,
            safeRow.requested_at,
          );
          const processedAt = firstDefined(
            safeRow.processedAt,
            safeRow.processed_at,
          );
          const amountCents = firstDefined(
            safeRow.amountCents,
            safeRow.amount_cents,
          );
          const resultMessage = firstDefined(
            safeRow.failureReason,
            safeRow.failure_reason,
            safeRow.message,
          );
          const approved = safeRow.approved;
          const refundId = firstDefined(safeRow.refundId, safeRow.refund_id);
          const detailStatus = safeRow.status;

          return (
            <div
              key={safeRow.refundId || safeRow.id || index}
              className={
                detailRows.length > 1
                  ? "rounded-xl border border-slate-100 bg-slate-50 p-4"
                  : ""
              }
            >
              {detailRows.length > 1 ? (
                <Typography.Text strong className="mb-3 block">
                  {tDesign("labelVoid.detailNumber", { number: index + 1 })}
                </Typography.Text>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {refundId !== undefined ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.refundId")}
                    value={String(refundId)}
                  />
                ) : null}
                {detailStatus ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.detailStatus")}
                    value={String(detailStatus)}
                  />
                ) : null}
                {externalOrderId ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.externalOrderId")}
                    value={String(externalOrderId)}
                  />
                ) : null}
                {trackingNumber ? (
                  <InfoField
                    label={tDesign("fields.labelTracking")}
                    value={String(trackingNumber)}
                  />
                ) : null}
                {shipmentId ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.shipmentId")}
                    value={String(shipmentId)}
                    valueClassName="break-all"
                  />
                ) : null}
                {requestedAt ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.requestedAt")}
                    value={formatDateTime(requestedAt, tOrders("common.none"))}
                  />
                ) : null}
                {processedAt ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.processedAt")}
                    value={formatDateTime(processedAt, tOrders("common.none"))}
                  />
                ) : null}
                {amountCents !== undefined ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.refundAmount")}
                    value={formatAmount(Number(amountCents) / 100)}
                  />
                ) : null}
                {typeof approved === "boolean" ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.approved")}
                    value={tDesign(
                      approved ? "labelVoid.values.yes" : "labelVoid.values.no",
                    )}
                  />
                ) : null}
                {resultMessage ? (
                  <InfoField
                    label={tDesign("labelVoid.fields.resultMessage")}
                    value={String(resultMessage)}
                    valueClassName="break-words"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const ProductionRecoveryCard = ({
  recovery,
  tDesign,
  tOrders,
  canRetry,
  retrying,
  onRetry,
}) => {
  const isSyncRecovery =
    recovery?.status === "committed" &&
    !["not_required", "completed"].includes(recovery?.sync_status);
  const displayStatus = isSyncRecovery
    ? `sync_${recovery?.sync_status}`
    : recovery?.status;
  const errorDetail = isSyncRecovery
    ? recovery?.sync_last_error
    : recovery?.last_error;
  const retryCount = isSyncRecovery
    ? recovery?.sync_retry_count
    : recovery?.retry_count;
  const nextRetryAt = isSyncRecovery
    ? recovery?.sync_next_retry_at
    : recovery?.next_retry_at;
  const canRetryVoid =
    canRetry && recovery?.status === "manual_review" && !isSyncRecovery;

  return (
    <Card
      className="rounded-xl border border-amber-200 bg-amber-50/40"
      styles={{ body: { padding: 16 } }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tDesign("fields.labelSource")}
          </Typography.Text>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {recovery?.source || tOrders("common.none")}
          </Typography.Title>
        </div>
        <Tag
          color={displayStatus === "voided" ? "green" : "orange"}
          className="rounded-full px-4 py-1 text-sm"
        >
          {tDesign(`labelRecovery.statuses.${displayStatus}`)}
        </Tag>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField
          label={tDesign("labelRecovery.fields.createdAt")}
          value={formatDateTime(recovery?.created_at, tOrders("common.none"))}
        />
        <InfoField
          label={tDesign("labelRecovery.fields.retryCount")}
          value={retryCount ?? 0}
        />
        <InfoField
          label={tDesign("labelRecovery.fields.nextRetryAt")}
          value={formatDateTime(nextRetryAt, tOrders("common.none"))}
        />
        {errorDetail?.message ? (
          <InfoField
            label={tDesign("labelRecovery.fields.lastError")}
            value={errorDetail.message}
            valueClassName="break-words"
          />
        ) : null}
      </div>
      {canRetryVoid ? (
        <div className="mt-4">
          <Button danger loading={retrying} onClick={() => onRetry?.(recovery)}>
            {tDesign("labelRecovery.actions.retry")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
};

const ScrapMovementCard = ({ movement, tDesign, tOrders }) => {
  const reasonKey =
    SCRAP_REASON_DETAIL_KEY_MAP[movement?.reason_detail] ||
    movement?.reason_detail;
  const sourceKey =
    SCRAP_SOURCE_KEY_MAP[movement?.source_screen] || movement?.source_screen;
  const variantLabel = [
    movement?.product?.name,
    movement?.size?.name,
    movement?.color?.name,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Card
      className="rounded-xl border border-line"
      styles={{ body: { padding: 16 } }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tDesign("scrap.fields.variant")}
          </Typography.Text>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {variantLabel || tOrders("common.none")}
          </Typography.Title>
        </div>
        <Tag color="volcano" className="rounded-full px-4 py-1 text-sm">
          {tDesign("scrap.quantityBadge", {
            quantity: movement?.quantity ?? 0,
          })}
        </Tag>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField
          label={tDesign("scrap.fields.reason")}
          value={
            tOrders(`scanner.scrap.reasonOptions.${reasonKey}`) ||
            movement?.reason_detail ||
            tOrders("common.none")
          }
        />
        <InfoField
          label={tDesign("scrap.fields.causedBy")}
          value={formatUserName(movement?.caused_by, tOrders("common.none"))}
        />
        <InfoField
          label={tDesign("scrap.fields.recordedBy")}
          value={formatUserName(movement?.recorded_by, tOrders("common.none"))}
        />
        <InfoField
          label={tDesign("scrap.fields.source")}
          value={
            tDesign(`scrap.sourceOptions.${sourceKey}`) ||
            movement?.source_screen ||
            tOrders("common.none")
          }
        />
        <InfoField
          label={tDesign("scrap.fields.createdAt")}
          value={formatDateTime(movement?.created_at, tOrders("common.none"))}
        />
      </div>
      <div className="mt-4">
        <Typography.Text type="secondary">
          {tDesign("scrap.fields.note")}
        </Typography.Text>
        <div className="mt-1 text-sm text-text-secondary">
          {movement?.note || tOrders("common.none")}
        </div>
      </div>
    </Card>
  );
};

const ItemDesignPreview = ({
  item,
  designs,
  positionMap,
  tDesign,
  tOrders,
  fallbackText,
}) => {
  if (!designs.length) {
    return <Empty description={tDesign("designs.empty")} />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-4">
      {designs.map((design) => (
        <PositionDesignCard
          key={design?.id || design?.product_position_id}
          item={item}
          design={design}
          positionMap={positionMap}
          tDetail={tDesign}
          tOrders={tOrders}
          fallbackText={fallbackText}
        />
      ))}
    </div>
  );
};

const OrderItemCard = ({
  item,
  positionMap,
  tOrders,
  tDesign,
  tCommonActions,
  fallbackText,
}) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  const rawDesigns = Array.isArray(item?.designs) ? item.designs : [];
  const hasPersonalization = Boolean(item?.has_personalization);
  const usesPersonalizedDesignGroups =
    hasPersonalization && Number(item?.quantity || 1) > 1;
  const groupedDesigns = new Map();
  rawDesigns.forEach((design) => {
    const key = design?.design_group_id
      ? `group-${design.design_group_id}-${design.product_position_id}`
      : `legacy-${design?.id}`;
    const current = groupedDesigns.get(key) || [];
    current.push(design);
    groupedDesigns.set(key, current);
  });
  const designs = Array.from(groupedDesigns.values()).map((group) => ({
    ...group[0],
    display_quantity: group[0]?.design_group_id
      ? group.length
      : hasPersonalization && Number(item?.quantity || 1) > 1
        ? Number(item.quantity)
        : 1,
  }));
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card
      key={item?.id}
      className="rounded-xl border border-line"
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full max-w-[260px] rounded-xl border border-line bg-surface p-4">
          <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-line bg-subtle">
            {item?.image_url ? (
              <GuardedPreviewImage
                src={item.image_url}
                alt={item?.name || "order item"}
                openLabel={tCommonActions("open")}
                emptyText={tOrders("common.none")}
                preview
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Empty description={tDesign("designs.noImage")} />
            )}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {item?.name || tOrders("columns.item")}
            </Typography.Title>
            <Tag className="ej-mono">
              {tOrders("columns.sku")} {item?.sku || tOrders("common.none")}
            </Tag>
            <Tag>
              {tOrders("columns.quantity")}:{" "}
              {item?.quantity ?? tOrders("common.none")}
            </Tag>
            <Tag>
              {tOrders("columns.price")}:{" "}
              {formatAmount(item?.price || item?.unit_price)}
            </Tag>
            <StatusTag status={statusKey}>
              {tOrders("columns.status")}: {statusLabel}
            </StatusTag>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField
              label={tOrders("columns.product")}
              value={item?.product?.name || tOrders("common.none")}
            />
            <InfoField
              label={tOrders("columns.size")}
              value={item?.size?.name || tOrders("common.none")}
            />
            <InfoField
              label={tOrders("columns.color")}
              value={item?.color?.name || tOrders("common.none")}
            />
          </div>
          <div className="grid gap-2">
            <Typography.Text type="secondary">
              {tOrders("columns.options")}
            </Typography.Text>
            {options.length ? (
              <div className="flex flex-wrap gap-2 text-sm">
                {options.map((option, index) => (
                  <span
                    key={`${option?.name || "option"}-${index}`}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-text-secondary"
                  >
                    {option?.name || tOrders("common.none")}:{" "}
                    {option?.value || tOrders("common.none")}
                  </span>
                ))}
              </div>
            ) : (
              <Typography.Text>{tOrders("values.noOptions")}</Typography.Text>
            )}
          </div>
          <div className="grid gap-2">
            <Typography.Text type="secondary">
              {tOrders("columns.notes")}
            </Typography.Text>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-line bg-surface px-3 py-1 text-text-secondary">
                {item?.notes || tOrders("common.none")}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <SectionHeader title={tDesign("designs.title")} />
        <div className="mt-4">
          {usesPersonalizedDesignGroups ? (
            <GroupedOrderItemDesignPreview
              item={item}
              positionMap={positionMap}
              tDetail={tDesign}
              tOrders={tOrders}
              fallbackText={fallbackText}
            />
          ) : (
            <ItemDesignPreview
              item={item}
              designs={designs}
              positionMap={positionMap}
              tDesign={tDesign}
              tOrders={tOrders}
              fallbackText={fallbackText}
            />
          )}
        </div>
      </div>
    </Card>
  );
};

export default function OrderDetailPage() {
  const { message } = AntdApp.useApp();
  const [scrapForm] = Form.useForm();
  const tOrders = useTranslations("dashboard.orders");
  const tDesign = useTranslations("dashboard.orders.detail");
  const tCommonActions = useTranslations("common.actions");
  const user = useSelector((state) => state.auth.user);
  const params = useParams();
  const orderNumber = params?.orderNumber;
  const canRecordScrap = hasAnyRole(user, ["companyadmin"]);
  const canViewAuditTimeline = hasAnyRole(user, [
    "companyadmin",
    "systemadmin",
  ]);
  const canRetryLabelRecovery = hasAnyRole(user, [
    "companyadmin",
    "systemadmin",
  ]);

  const [orderDetail, setOrderDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [positionsByProductId, setPositionsByProductId] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [voidingLabelId, setVoidingLabelId] = useState(null);
  const [retryingRecoveryId, setRetryingRecoveryId] = useState(null);
  const [scrapModalOpen, setScrapModalOpen] = useState(false);
  const [recordingScrap, setRecordingScrap] = useState(false);

  const items = useMemo(
    () => {
      const orderStatus = String(
        orderDetail?.order_status || orderDetail?.status || "",
      ).toLowerCase();
      const orderItems = Array.isArray(orderDetail?.items)
        ? orderDetail.items
        : [];

      if (["cancel", "cancelled", "canceled"].includes(orderStatus)) {
        return orderItems;
      }

      return orderItems.filter(
        (item) =>
          !["cancel", "cancelled", "canceled"].includes(
            String(item?.status || "").toLowerCase(),
          ),
      );
    },
    [orderDetail],
  );
  const labels = useMemo(
    () => (Array.isArray(orderDetail?.labels) ? orderDetail.labels : []),
    [orderDetail],
  );
  const shipments = useMemo(
    () => (Array.isArray(orderDetail?.shipments) ? orderDetail.shipments : [])
      .filter((shipment) => shipment.status === "active" && shipment.fulfillment_status !== "canceled"),
    [orderDetail],
  );
  const canceledShipments = useMemo(
    () => Array.isArray(orderDetail?.canceled_shipments) ? orderDetail.canceled_shipments : [],
    [orderDetail],
  );
  const shipmentTotal = useMemo(
    () =>
      shipments.reduce(
        (total, shipment) =>
          total + Number(shipment?.shipment_price || 0),
        0,
      ),
    [shipments],
  );
  const orderItemsTotal = useMemo(
    () =>
      (Array.isArray(orderDetail?.items) ? orderDetail.items : []).reduce(
        (total, item) =>
          total + Number(item?.price || 0) * Number(item?.quantity || 0),
        0,
      ),
    [orderDetail?.items],
  );
  const amountPaidTotal = orderItemsTotal + shipmentTotal;
  const labelVoids = useMemo(
    () =>
      Array.isArray(orderDetail?.label_voids) ? orderDetail.label_voids : [],
    [orderDetail],
  );
  const labelRecoveries = useMemo(
    () =>
      Array.isArray(orderDetail?.production_attempts)
        ? orderDetail.production_attempts
        : [],
    [orderDetail],
  );
  const scrapMovements = useMemo(
    () =>
      Array.isArray(orderDetail?.product_stock_movements)
        ? orderDetail.product_stock_movements
        : [],
    [orderDetail],
  );

  const loadOrderDetail = useCallback(async () => {
    if (!orderNumber) return;
    setLoading(true);
    try {
      const response = await OrdersAPI.orderDetail(orderNumber);
      setOrderDetail(response?.data || null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tDesign("messages.loadOrderError"),
      );
    } finally {
      setLoading(false);
    }
  }, [message, orderNumber, tDesign]);

  const handleVoidLabel = useCallback(
    async (label) => {
      const orderId =
        orderDetail?.id || orderDetail?.order_id || orderDetail?.orderId;
      const labelId = label?.label_id || label?.id || label?.labelId;
      const labelIdKey = labelId ? String(labelId) : "";

      if (!orderId || !labelId) {
        message.error(tDesign("messages.voidLabelError"));
        return;
      }

      setVoidingLabelId(labelIdKey);
      try {
        await OrdersAPI.voidLabel({ order_id: orderId, label_id: labelId });
        message.success(tDesign("messages.voidLabelSuccess"));
        await loadOrderDetail();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            tDesign("messages.voidLabelError"),
        );
      } finally {
        setVoidingLabelId(null);
      }
    },
    [loadOrderDetail, message, orderDetail, tDesign],
  );

  const handleRetryLabelRecovery = useCallback(
    async (recovery) => {
      if (!recovery?.id) return;
      setRetryingRecoveryId(String(recovery.id));
      try {
        await OrdersAPI.retryProductionLabelRecovery(recovery.id);
        message.success(tDesign("labelRecovery.messages.retrySuccess"));
        await loadOrderDetail();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            tDesign("labelRecovery.messages.retryError"),
        );
      } finally {
        setRetryingRecoveryId(null);
      }
    },
    [loadOrderDetail, message, tDesign],
  );

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: String(item?.id),
        label: [
          item?.product?.name,
          item?.size?.name,
          item?.color?.name,
          item?.sku ? `SKU: ${item.sku}` : null,
        ]
          .filter(Boolean)
          .join(" / "),
        item,
      })),
    [items],
  );

  const reasonOptions = useMemo(
    () =>
      SCRAP_REASON_OPTIONS.map((option) => ({
        value: option.value,
        label: tOrders(`scanner.scrap.reasonOptions.${option.labelKey}`),
      })),
    [tOrders],
  );

  const openScrapModal = useCallback(() => {
    scrapForm.setFieldsValue({
      entries: [{ quantity: 1, reason_detail: "wrong_print" }],
    });
    setScrapModalOpen(true);
  }, [scrapForm]);

  const handleRecordScrap = useCallback(async () => {
    const orderId =
      orderDetail?.id || orderDetail?.order_id || orderDetail?.orderId;
    if (!orderId) {
      message.error(tDesign("scrap.messages.orderIdMissing"));
      return;
    }

    try {
      setRecordingScrap(true);
      const values = await scrapForm.validateFields();
      const entries = (values?.entries || []).map((entry) => {
        const selected = itemOptions.find(
          (option) => option.value === entry.order_item_id,
        )?.item;
        if (
          !selected?.product_id ||
          !selected?.size_id ||
          !selected?.color_id
        ) {
          throw new Error(tDesign("scrap.messages.invalidItem"));
        }
        return {
          order_item_id: entry.order_item_id,
          product_id: selected.product_id,
          size_id: selected.size_id,
          color_id: selected.color_id,
          quantity: entry.quantity,
          reason: "manual_adjustment",
          reason_detail: entry.reason_detail,
          note: entry.note || undefined,
        };
      });

      await OrdersAPI.recordScrap({
        order_id: orderId,
        entries,
      });
      message.success(tDesign("scrap.messages.recordSuccess"));
      setScrapModalOpen(false);
      scrapForm.resetFields();
      await loadOrderDetail();
    } catch (error) {
      const errorMessage =
        error?.errorFields?.length > 0
          ? null
          : error?.message || error?.response?.data?.error?.message;
      if (errorMessage) {
        message.error(errorMessage);
      }
    } finally {
      setRecordingScrap(false);
    }
  }, [itemOptions, loadOrderDetail, message, orderDetail, scrapForm, tDesign]);

  useEffect(() => {
    loadOrderDetail();
  }, [loadOrderDetail]);

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
          .map((id) => String(id)),
      ),
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
            const response = await ProductPositionsAPI.flatList({
              pagination: { page: 1, pageSize: 100 },
              filters: { product_id: productId, status: "active" },
            });
            return [productId, extractPositionList(response)];
          }),
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
          error?.response?.data?.error?.message ||
            tDesign("messages.loadPositionsError"),
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
  }, [items, message, tDesign]);

  const statusLabel = orderDetail?.order_status || orderDetail?.status;
  const statusText = statusLabel
    ? tOrders(`status.values.${statusLabel}`) || statusLabel
    : "";
  const isReordered = isReorderedOrder(orderDetail);
  const canManageLabelVoid = useCallback(
    (label) => {
      if (!hasAnyRole(user, ["customeradmin"])) return false;
      const orderStatus = String(statusLabel || "").toLowerCase();
      if (orderStatus !== "processing" && orderStatus !== "neworder") {
        return false;
      }
      const shipmentId = label?.shipment_id || label?.shipment?.id;
      if (!shipmentId) return false;
      const shipmentStatus = String(
        label?.shipment?.fulfillment_status || "",
      ).toLowerCase();
      if (shipmentStatus === "shipped" || shipmentStatus === "canceled") {
        return false;
      }
      const shipmentItems = items.filter(
        (item) => String(item?.shipment_id || "") === String(shipmentId),
      );
      const activeShipmentItems = shipmentItems.filter(
        (item) => String(item?.status || "").toLowerCase() !== "cancel",
      );
      return (
        activeShipmentItems.length > 0 &&
        activeShipmentItems.every(
          (item) =>
            String(item?.status || "").toLowerCase() === "processing",
        )
      );
    },
    [items, statusLabel, user],
  );

  const fallbackText = tDesign("designs.designAreaPlaceholder");
  const pendingPoolItems = Number(
    orderDetail?.pool_completion_summary?.pending_items || 0,
  );
  const orderTotal = formatAmount(orderDetail?.order_total);
  const amountPaid = formatAmount(orderDetail?.amount_paid);
  const orderDate = formatDateTime(
    orderDetail?.order_date,
    tOrders("common.none"),
  );
  const paymentDate = formatDateTime(
    orderDetail?.payment_date,
    tOrders("common.none"),
  );
  const shipDate = formatDateTime(
    orderDetail?.ship_date,
    tOrders("common.none"),
  );

  const progressStep = (() => {
    switch (String(statusLabel || "")) {
      case "newOrder":
      case "waitingForDesign":
        return 1;
      case "readyForProduction":
      case "processing":
      case "pdf":
      case "designFlaw":
      case "downloaded":
      case "printed":
        return 2;
      case "completed":
        return 4;
      case "shipped":
        return 5;
      default:
        return null;
    }
  })();
  const progressItems = [
    "received",
    "preparation",
    "production",
    "completed",
    "shipped",
  ].map((key) => ({ key, title: tDesign(`progress.${key}`) }));

  const detailTabs = [
    {
      key: "overview",
      label: tDesign("tabs.overview"),
      children: (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            {pendingPoolItems > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={tDesign("messages.poolIncomplete", {
                  count: pendingPoolItems,
                })}
              />
            ) : null}
            <SectionHeader
              title={tDesign("sections.items")}
              count={items.length}
              extra={
                positionsLoading ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {tDesign("messages.positionsLoading")}
                  </Typography.Text>
                ) : null
              }
            />
            {items.length ? (
              <div className="grid gap-6">
                {items.map((item) => {
                  const productId = String(
                    item?.product_id || item?.product?.id || "",
                  );
                  const positions = positionsByProductId[productId] || [];
                  const positionMap = new Map(
                    positions.map((position) => [String(position?.id), position]),
                  );
                  return (
                    <OrderItemCard
                      key={item?.id}
                      item={item}
                      positionMap={positionMap}
                      tOrders={tOrders}
                      tDesign={tDesign}
                      tCommonActions={tCommonActions}
                      fallbackText={fallbackText}
                    />
                  );
                })}
              </div>
            ) : (
              <Empty description={tDesign("messages.noItems")} />
            )}
            <SideCard title={tDesign("sections.notes")}>
              <KeyValueList
                rows={[
                  {
                    label: tDesign("fields.customerNotes"),
                    value: orderDetail?.customer_notes || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.internalNotes"),
                    value: orderDetail?.internal_notes || tOrders("common.none"),
                  },
                ]}
              />
            </SideCard>
          </div>
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <SideCard title={tDesign("sections.totals")}>
              <KeyValueList
                rows={[
                  {
                    label: tDesign("fields.orderTotal"),
                    value: (
                      <span className="ej-mono">
                        {formatAmount(orderItemsTotal, "0.00")}
                      </span>
                    ),
                  },
                  {
                    label: tDesign("fields.shippingAmount"),
                    value: (
                      <span className="ej-mono">
                        {formatAmount(shipmentTotal)}
                      </span>
                    ),
                  },
                  {
                    label: tDesign("fields.amountPaid"),
                    value: (
                      <span className="ej-mono font-semibold">
                        {formatAmount(amountPaidTotal, "0.00")}
                      </span>
                    ),
                  },
                  { label: tDesign("fields.orderDate"), value: orderDate },
                  { label: tDesign("fields.paymentDate"), value: paymentDate },
                  { label: tDesign("fields.shipDate"), value: shipDate },
                ]}
              />
            </SideCard>
            <SideCard title={tDesign("sections.customer")}>
              <KeyValueList
                rows={[
                  {
                    label: tDesign("fields.customerName"),
                    value: orderDetail?.bill_to_name || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.customerEmail"),
                    value: orderDetail?.customer_email || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.customerUsername"),
                    value:
                      orderDetail?.customer_username || tOrders("common.none"),
                  },
                ]}
              />
            </SideCard>
            <AddressCard
              title={tDesign("sections.shippingAddress")}
              order={orderDetail}
              prefix="ship_to"
              emptyText={tOrders("common.none")}
            />
            <AddressCard
              title={tDesign("sections.billing")}
              order={orderDetail}
              prefix="bill_to"
              emptyText={tOrders("common.none")}
            />
            <SideCard title={tDesign("sections.shipping")}>
              <KeyValueList
                rows={[
                  {
                    label: tDesign("fields.requestedService"),
                    value:
                      orderDetail?.requested_service || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.carrierCode"),
                    value: orderDetail?.carrier_code || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.serviceCode"),
                    value: orderDetail?.service_code || tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.weight"),
                    value: orderDetail?.weight?.value
                      ? `${orderDetail.weight.value} ${
                          orderDetail.weight.units || ""
                        }`.trim()
                      : tOrders("common.none"),
                  },
                  {
                    label: tDesign("fields.dimensions"),
                    value: orderDetail?.dimensions
                      ? `${orderDetail.dimensions.length} x ${
                          orderDetail.dimensions.width
                        } x ${orderDetail.dimensions.height} ${
                          orderDetail.dimensions.units || ""
                        }`
                      : tOrders("common.none"),
                  },
                ]}
              />
            </SideCard>
          </aside>
        </div>
      ),
    },
    {
      key: "operations",
      label: tDesign("tabs.labelsAndProduction"),
      children: (
        <div className="flex flex-col gap-8">
          {shipments.length ? (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title={tDesign("shipments.title")}
                count={shipments.length}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="rounded-xl border border-line bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Typography.Text strong>
                        {shipment.shipment_number ||
                          tDesign("shipments.fallbackName", {
                            sequence: shipment.sequence,
                          })}
                      </Typography.Text>
                      <StatusTag status={shipment.fulfillment_status}>
                        {tOrders(`status.values.${shipment.fulfillment_status}`).startsWith("dashboard.")
                          ? shipment.fulfillment_status
                          : tOrders(`status.values.${shipment.fulfillment_status}`)}
                      </StatusTag>
                    </div>
                    <div className="mt-2 text-sm text-text-secondary">
                      {tDesign("shipments.itemsSummary", {
                        count:
                          shipment.items?.filter((item) => item.status !== "cancel")
                            .length || 0,
                        amount: `$${formatAmount(shipment.shipment_price)}`,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {canceledShipments.length ? (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title={tDesign("shipments.canceledTitle")}
                count={canceledShipments.length}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {canceledShipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-xl border border-line bg-subtle p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Typography.Text strong>
                        {shipment.shipment_number ||
                          tDesign("shipments.fallbackName", {
                            sequence: shipment.sequence,
                          })}
                      </Typography.Text>
                      <StatusTag status="canceled">
                        {tDesign("shipments.canceled")}
                      </StatusTag>
                    </div>
                    <div className="mt-2 text-sm text-text-secondary">
                      {tDesign("shipments.labelsSummary", {
                        labels: shipment.labels?.length || 0,
                        voids: shipment.label_voids?.length || 0,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={tDesign("sections.labels")}
              count={labels.length}
            />
            {labels.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {labels.map((label) => (
                  <LabelCard
                    key={label?.id || label?.label_url}
                    label={label}
                    shipmentPrice={shipments.find((shipment) => shipment.id === label?.shipment_id)?.shipment_price}
                    tDesign={tDesign}
                    tOrders={tOrders}
                    onVoid={handleVoidLabel}
                    canManageVoid={canManageLabelVoid(label)}
                    voiding={
                      voidingLabelId &&
                      String(
                        label?.label_id || label?.id || label?.labelId || "",
                      ) === voidingLabelId
                    }
                  />
                ))}
              </div>
            ) : (
              <SectionEmpty>{tDesign("messages.noLabels")}</SectionEmpty>
            )}
          </div>
          {labelRecoveries.length ? (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title={tDesign("sections.labelRecovery")}
                count={labelRecoveries.length}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {labelRecoveries.map((recovery) => (
                  <ProductionRecoveryCard
                    key={recovery?.id}
                    recovery={recovery}
                    tDesign={tDesign}
                    tOrders={tOrders}
                    canRetry={canRetryLabelRecovery}
                    retrying={retryingRecoveryId === String(recovery?.id || "")}
                    onRetry={handleRetryLabelRecovery}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={tDesign("sections.labelVoids")}
              count={labelVoids.length}
            />
            {labelVoids.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {labelVoids.map((labelVoid) => (
                  <LabelVoidCard
                    key={labelVoid?.id}
                    labelVoid={labelVoid}
                    tDesign={tDesign}
                    tOrders={tOrders}
                  />
                ))}
              </div>
            ) : (
              <SectionEmpty>{tDesign("labelVoid.empty")}</SectionEmpty>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={tDesign("sections.scrap")}
              count={scrapMovements.length}
              extra={
                canRecordScrap ? (
                  <Button onClick={openScrapModal}>
                    {tDesign("scrap.actions.add")}
                  </Button>
                ) : null
              }
            />
            {scrapMovements.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {scrapMovements.map((movement) => (
                  <ScrapMovementCard
                    key={movement?.id}
                    movement={movement}
                    tDesign={tDesign}
                    tOrders={tOrders}
                  />
                ))}
              </div>
            ) : (
              <SectionEmpty>{tDesign("scrap.messages.empty")}</SectionEmpty>
            )}
          </div>
        </div>
      ),
    },
    ...(canViewAuditTimeline
      ? [
          {
            key: "activity",
            label: tDesign("tabs.activity"),
            children: (
              <EntityAuditTimeline
                entityType="order"
                entityKey={orderDetail?.order_number || orderNumber}
                visible={canViewAuditTimeline}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <RequireRole
      anyOfRoles={[
        "systemAdmin",
        "companyAdmin",
        "customerAdmin",
        "companyCompletedWorker",
        "companyShipmentWorker",
        "partnerAdmin",
      ]}
    >
      <div>
        {!orderNumber ? (
          <Alert
            type="error"
            message={tDesign("messages.missingParams")}
            showIcon
          />
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : !orderDetail ? (
          <Alert
            type="error"
            message={tDesign("messages.noOrderFound")}
            showIcon
          />
        ) : (
          <div className="space-y-5">
            <PageHeader
              className=""
              breadcrumb={[
                { title: tOrders("title") },
                { title: `#${orderDetail?.order_number || ""}` },
              ]}
              title={
                <span className="ej-mono">
                  #{orderDetail?.order_number || tOrders("common.none")}
                </span>
              }
              meta={
                statusLabel ? (
                  <>
                    <StatusTag status={statusLabel}>{statusText}</StatusTag>
                    {isReordered ? (
                      <StatusTag tone="refund">
                        {tOrders("values.reordered")}
                      </StatusTag>
                    ) : null}
                  </>
                ) : null
              }
              description={`${tDesign("fields.orderDate")}: ${orderDate}`}
            />
            {progressStep !== null ? (
              <div className="rounded-xl border border-line px-5 py-4">
                <Steps
                  size="small"
                  current={progressStep}
                  status={statusLabel === "designFlaw" ? "error" : "process"}
                  items={progressItems}
                  aria-label={tDesign("progress.ariaLabel")}
                />
              </div>
            ) : null}
            <Tabs defaultActiveKey="overview" items={detailTabs} />
          </div>
        )}
        <Modal
          open={scrapModalOpen}
          title={tDesign("scrap.title")}
          onCancel={() => {
            setScrapModalOpen(false);
            scrapForm.resetFields();
          }}
          onOk={handleRecordScrap}
          okText={tDesign("scrap.actions.confirm")}
          cancelText={tCommonActions("cancel")}
          confirmLoading={recordingScrap}
          width={760}
        >
          <Form form={scrapForm} layout="vertical">
            <Form.List name="entries">
              {(fields, { add, remove }) => (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      className="rounded-xl border border-line"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <Typography.Text strong>
                          {tDesign("scrap.entryTitle", { index: index + 1 })}
                        </Typography.Text>
                        {fields.length > 1 ? (
                          <Button
                            danger
                            type="text"
                            onClick={() => remove(field.name)}
                          >
                            {tCommonActions("remove")}
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item
                          name={[field.name, "order_item_id"]}
                          label={tDesign("scrap.fields.item")}
                          rules={[
                            {
                              required: true,
                              message: tDesign("scrap.validation.item"),
                            },
                          ]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={itemOptions}
                            placeholder={tDesign("scrap.placeholders.item")}
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "quantity"]}
                          label={tDesign("scrap.fields.quantity")}
                          rules={[
                            {
                              required: true,
                              message: tDesign("scrap.validation.quantity"),
                            },
                          ]}
                        >
                          <InputNumber
                            min={1}
                            precision={0}
                            className="w-full"
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "reason_detail"]}
                          label={tDesign("scrap.fields.reason")}
                          rules={[
                            {
                              required: true,
                              message: tDesign("scrap.validation.reason"),
                            },
                          ]}
                        >
                          <Select
                            options={reasonOptions}
                            placeholder={tDesign("scrap.placeholders.reason")}
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "note"]}
                          label={tDesign("scrap.fields.note")}
                        >
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            placeholder={tDesign("scrap.placeholders.note")}
                          />
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    onClick={() => add({ quantity: 1 })}
                  >
                    {tDesign("scrap.actions.addEntry")}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form>
        </Modal>
      </div>
    </RequireRole>
  );
}
