"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Image,
  Popconfirm,
  Spin,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useParams } from "next/navigation";
import { useTranslations } from "@/i18n/use-translations";
import { STATUS_COLORS } from "@/app/(dashboard)/dashboard/orders/statusConstants";
import { extractDesignAreaFromRecord } from "@/utils/designArea";

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

const formatDateTime = (value, fallback = "-") =>
  value ? dayjs(value).format("LLL") : fallback;

const LABEL_STATUS_COLORS = {
  purchased: "green",
  created: "blue",
  refunded: "volcano",
  voided: "volcano",
  cancelled: "volcano",
  error: "red",
  failed: "red",
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

const InfoField = ({ label, value, className, valueClassName }) => (
  <div className={`flex flex-col gap-1 ${className || ""}`}>
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <span
      className={`text-sm font-semibold text-slate-900 ${valueClassName || ""}`}
    >
      {value}
    </span>
  </div>
);

const MetricCard = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex flex-col gap-1">
    <Typography.Title level={5} style={{ margin: 0 }}>
      {title}
    </Typography.Title>
    {subtitle ? (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {subtitle}
      </Typography.Text>
    ) : null}
  </div>
);

const AddressBlock = ({ title, rows }) => (
  <Card
    title={title}
    className="rounded-2xl border border-slate-100 shadow-sm"
    bodyStyle={{ padding: 16 }}
    size="small"
  >
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <InfoField key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  </Card>
);

const LabelCard = ({ label, tDesign, tOrders, onVoid, voiding }) => {
  const detail = label?.label_detail || {};
  const ssSource = [
    "shipStationCompany",
    "shipStationCustomer",
    "shipStationPartner",
  ];
  const source = label?.source;
  const statusValue = detail?.status || label?.status;
  const statusKey = statusValue ? String(statusValue).toLowerCase() : "";
  const statusColor = LABEL_STATUS_COLORS[statusKey] || "default";
  const labelUrl = detail?.labelUrl || label?.label_url;
  const rateValue =
    detail?.rate === null || detail?.rate === undefined ? null : detail?.rate;
  const rateText =
    rateValue === null
      ? tOrders("common.none")
      : `${formatAmount(rateValue)} ${detail?.currency || ""}`.trim();
  const createdAt = formatDateTime(
    detail?.createdAt || label?.created_at,
    tOrders("common.none"),
  );
  const canVoid =
    detail?.status === "PURCHASED" || detail?.status === "completed";

  return (
    <Card
      className="rounded-2xl border border-slate-100 shadow-sm"
      bodyStyle={{ padding: 16 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tDesign("fields.labelSource")}
          </Typography.Text>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {label?.source || tOrders("common.none")}
          </Typography.Title>
        </div>
        {statusValue ? (
          <Tag color={statusColor} className="rounded-full px-4 py-1 text-sm">
            {statusValue}
          </Tag>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField
          label={tDesign("fields.labelCarrier")}
          value={
            source
              ? ssSource.includes(source)
                ? detail?.label_detail?.carrier_code
                : detail?.carrier || tOrders("common.none")
              : tOrders("common.none")
          }
        />
        <InfoField
          label={tDesign("fields.labelService")}
          value={
            source
              ? ssSource.includes(source)
                ? detail?.label_detail?.service_code
                : detail?.service || tOrders("common.none")
              : tOrders("common.none")
          }
        />
        <InfoField label={tDesign("fields.labelRate")} value={rateText} />
        <InfoField
          label={tDesign("fields.labelTracking")}
          value={
            source
              ? ssSource.includes(source)
                ? detail?.label_detail?.trackingNumber
                : detail?.tracking_number
              : tOrders("common.none")
          }
        />
        <InfoField label={tDesign("fields.labelCreatedAt")} value={createdAt} />
      </div>
      {labelUrl || canVoid ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {labelUrl ? (
            <a
              href={labelUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              {tDesign("actions.viewLabel")}
            </a>
          ) : null}
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
        </div>
      ) : null}
    </Card>
  );
};

const ItemDesignPreview = ({
  item,
  designs,
  positionMap,
  tDesign,
  fallbackText,
}) => {
  if (!designs.length) {
    return <Empty description={tDesign("designs.empty")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {designs.map((design) => {
        const positionId = String(design?.product_position_id || "");
        const position = positionMap.get(positionId);
        const designArea = position
          ? extractDesignAreaFromRecord(position)
          : null;
        const positionImageUrl = position?.images?.[0]?.image_url;
        const previewImageUrl = positionImageUrl || item?.image_url;
        const designPreviewUrl = design?.design_url;
        const positionName =
          position?.name ||
          design?.product_position?.name ||
          tDesign("designs.unknownPosition");

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
                  <Empty description={tDesign("designs.noPreview")} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {tDesign("designs.positionLabel")}
              </Typography.Text>
              <Typography.Text>{positionName}</Typography.Text>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const OrderItemCard = ({
  item,
  positionMap,
  tOrders,
  tDesign,
  fallbackText,
}) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  const designs = Array.isArray(item?.designs) ? item.designs : [];

  return (
    <Card
      key={item?.id}
      className="rounded-3xl border border-slate-100 shadow-sm"
      bodyStyle={{ padding: 20 }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full max-w-[260px] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
            {item?.image_url ? (
              <Image
                src={item.image_url}
                alt={item?.name || "order item"}
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
            <Tag className="rounded-full" color="geekblue">
              {tOrders("columns.sku")} {item?.sku || tOrders("common.none")}
            </Tag>
            <Tag className="rounded-full" color="gold">
              {tOrders("columns.quantity")}:{" "}
              {item?.quantity ?? tOrders("common.none")}
            </Tag>
            <Tag className="rounded-full" color="green">
              {tOrders("columns.price")}:{" "}
              {formatAmount(item?.price || item?.unit_price)}
            </Tag>
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
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700"
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
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                {item?.notes || tOrders("common.none")}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <SectionHeader title={tDesign("designs.title")} />
        <div className="mt-4">
          <ItemDesignPreview
            item={item}
            designs={designs}
            positionMap={positionMap}
            tDesign={tDesign}
            fallbackText={fallbackText}
          />
        </div>
      </div>
    </Card>
  );
};

export default function OrderDetailPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDesign = useTranslations("dashboard.orders.detail");
  const params = useParams();
  const orderNumber = params?.orderNumber;

  const [orderDetail, setOrderDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [positionsByProductId, setPositionsByProductId] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [voidingLabelId, setVoidingLabelId] = useState(null);

  const items = useMemo(
    () => (Array.isArray(orderDetail?.items) ? orderDetail.items : []),
    [orderDetail],
  );
  const labels = useMemo(
    () => (Array.isArray(orderDetail?.labels) ? orderDetail.labels : []),
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
            const response = await ProductPositionsAPI.list({
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
  const statusColor = STATUS_COLORS[statusLabel] || "default";

  const billingRows = useMemo(
    () => [
      {
        label: tDesign("fields.billToName"),
        value: orderDetail?.bill_to_name || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToCompany"),
        value: orderDetail?.bill_to_company || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToStreet1"),
        value: orderDetail?.bill_to_street1 || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToStreet2"),
        value: orderDetail?.bill_to_street2 || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToCity"),
        value: orderDetail?.bill_to_city || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToState"),
        value: orderDetail?.bill_to_state || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToPostalCode"),
        value: orderDetail?.bill_to_postal_code || tOrders("common.none"),
      },
      {
        label: tDesign("fields.billToCountry"),
        value: orderDetail?.bill_to_country || tOrders("common.none"),
      },
    ],
    [orderDetail, tDesign, tOrders],
  );

  const shippingRows = useMemo(
    () => [
      {
        label: tDesign("fields.shipToName"),
        value: orderDetail?.ship_to_name || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToCompany"),
        value: orderDetail?.ship_to_company || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToStreet1"),
        value: orderDetail?.ship_to_street1 || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToStreet2"),
        value: orderDetail?.ship_to_street2 || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToCity"),
        value: orderDetail?.ship_to_city || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToState"),
        value: orderDetail?.ship_to_state || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToPostalCode"),
        value: orderDetail?.ship_to_postal_code || tOrders("common.none"),
      },
      {
        label: tDesign("fields.shipToCountry"),
        value: orderDetail?.ship_to_country || tOrders("common.none"),
      },
    ],
    [orderDetail, tDesign, tOrders],
  );

  const fallbackText = tDesign("designs.designAreaPlaceholder");
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

  return (
    <RequireRole
      anyOfRoles={[
        "companyAdmin",
        "customerAdmin",
        "companyCompletedWorker",
        "companyShipmentWorker",
        "partnerAdmin",
      ]}
    >
      <div className="min-h-full bg-slate-50/70 p-4 md:p-6">
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
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {tDesign("sections.orderInfo")}
                  </Typography.Text>
                  <div className="flex flex-wrap items-center gap-3">
                    <Typography.Title level={2} style={{ margin: 0 }}>
                      #{orderDetail?.order_number || tOrders("common.none")}
                    </Typography.Title>
                    {statusLabel ? (
                      <Tag
                        color={statusColor}
                        className="rounded-full px-4 py-1 text-sm"
                      >
                        {statusLabel}
                      </Tag>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
                  <MetricCard
                    label={tDesign("fields.amountPaid")}
                    value={
                      orderDetail?.shipments[0]?.shipping_amount
                        ? formatAmount(
                            orderDetail?.shipments[0]?.shipping_amount,
                          ) +
                          formatAmount(
                            orderDetail?.items
                              .map((i) => i.price * i.quantity)
                              .reduce((a, b) => a + b, 0),
                          )
                        : "0.00"
                    }
                  />
                  <MetricCard
                    label={tDesign("fields.orderTotal")}
                    value={formatAmount(
                      orderDetail?.items
                        .map((i) => i.price * i.quantity)
                        .reduce((a, b) => a + b, 0),
                    )}
                  />

                  <MetricCard
                    label={tDesign("fields.shippingAmount")}
                    value={formatAmount(
                      orderDetail?.shipments[0]?.shipping_amount,
                    )}
                  />
                </div>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                <Card
                  className="rounded-2xl border border-slate-100 shadow-sm"
                  bodyStyle={{ padding: 16 }}
                >
                  <SectionHeader title={tDesign("sections.customer")} />
                  <div className="mt-4 grid gap-3">
                    <InfoField
                      label={tDesign("fields.customerName")}
                      value={
                        orderDetail?.customer?.name || tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.customerEmail")}
                      value={
                        orderDetail?.customer_email || tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.customerUsername")}
                      value={
                        orderDetail?.customer_username || tOrders("common.none")
                      }
                    />
                  </div>
                </Card>
                <Card
                  className="rounded-2xl border border-slate-100 shadow-sm"
                  bodyStyle={{ padding: 16 }}
                >
                  <SectionHeader title={tDesign("sections.shipping")} />
                  <div className="mt-4 grid gap-3">
                    <InfoField
                      label={tDesign("fields.requestedService")}
                      value={
                        orderDetail?.requested_service || tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.carrierCode")}
                      value={
                        orderDetail?.carrier_code || tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.serviceCode")}
                      value={
                        orderDetail?.service_code || tOrders("common.none")
                      }
                    />
                  </div>
                </Card>
                <Card
                  className="rounded-2xl border border-slate-100 shadow-sm"
                  bodyStyle={{ padding: 16 }}
                >
                  <SectionHeader title={tDesign("sections.package")} />
                  <div className="mt-4 grid gap-3">
                    <InfoField
                      label={tDesign("fields.weight")}
                      value={
                        orderDetail?.weight?.value
                          ? `${orderDetail.weight.value} ${
                              orderDetail.weight.units || ""
                            }`.trim()
                          : tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.dimensions")}
                      value={
                        orderDetail?.dimensions
                          ? `${orderDetail.dimensions.length} x ${
                              orderDetail.dimensions.width
                            } x ${orderDetail.dimensions.height} ${
                              orderDetail.dimensions.units || ""
                            }`
                          : tOrders("common.none")
                      }
                    />
                  </div>
                </Card>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <AddressBlock
                  title={tDesign("sections.billing")}
                  rows={billingRows}
                />
                <AddressBlock
                  title={tDesign("sections.shippingAddress")}
                  rows={shippingRows}
                />
              </div>
              <div className="mt-6 grid gap-4">
                <Card
                  className="rounded-2xl border border-slate-100 shadow-sm"
                  bodyStyle={{ padding: 16 }}
                >
                  <SectionHeader title={tDesign("sections.notes")} />
                  <div className="mt-4 grid gap-3">
                    <InfoField
                      label={tDesign("fields.customerNotes")}
                      value={
                        orderDetail?.customer_notes || tOrders("common.none")
                      }
                    />
                    <InfoField
                      label={tDesign("fields.internalNotes")}
                      value={
                        orderDetail?.internal_notes || tOrders("common.none")
                      }
                    />
                  </div>
                </Card>
              </div>
              <div className="mt-6 space-y-4">
                <SectionHeader title={tDesign("sections.labels")} />
                {labels.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {labels.map((label) => (
                      <LabelCard
                        key={label?.id || label?.label_url}
                        label={label}
                        tDesign={tDesign}
                        tOrders={tOrders}
                        onVoid={handleVoidLabel}
                        voiding={
                          voidingLabelId &&
                          String(
                            label?.label_id ||
                              label?.id ||
                              label?.labelId ||
                              "",
                          ) === voidingLabelId
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty description={tDesign("messages.noLabels")} />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeader title={tDesign("sections.items")} />
              {positionsLoading ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {tDesign("messages.positionsLoading")}
                </Typography.Text>
              ) : null}
            </div>

            {items.length ? (
              <div className="grid gap-6">
                {items.map((item) => {
                  const productId = String(
                    item?.product_id || item?.product?.id || "",
                  );
                  const positions = positionsByProductId[productId] || [];
                  const positionMap = new Map(
                    positions.map((position) => [
                      String(position?.id),
                      position,
                    ]),
                  );
                  return (
                    <OrderItemCard
                      key={item?.id}
                      item={item}
                      positionMap={positionMap}
                      tOrders={tOrders}
                      tDesign={tDesign}
                      fallbackText={fallbackText}
                    />
                  );
                })}
              </div>
            ) : (
              <Empty description={tDesign("messages.noItems")} />
            )}
          </div>
        )}
      </div>
    </RequireRole>
  );
}
