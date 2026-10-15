"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import {
  Alert,
  App as AntdApp,
  Button,
  Input,
  Popover,
  Popconfirm,
  Spin,
  Steps,
  Tabs,
  Tooltip,
} from "antd";
import {
  DeleteOutlined,
  ExportOutlined,
  LinkOutlined,
  ProfileOutlined,
  SaveOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import EntityAuditTimeline from "@/components/audit/EntityAuditTimeline";
import RequireRole from "@/components/common/Access/RequireRole";
import DesignThumbnailImage from "@/components/common/media/DesignThumbnailImage";
import {
  AddressCard,
  HeaderFacts,
  KeyValueList,
  SectionEmpty,
  SectionHeader,
  SideCard,
} from "@/components/orders/detail/DetailBlocks";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { hasAnyRole } from "@/utils/rbac";
import StatusTag from "@/components/ui/StatusTag";
import PageHeader from "@/components/ui/PageHeader";
import { MetaChip, YesNoCell } from "@/components/ui/TableCells";
import { formatAmount, formatCurrency } from "@/utils/formatMoney";

const formatDateTime = (value, fallback = "-") =>
  value ? moment(value).format("LLL") : fallback;

const normalizeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((entry) => ({
        name: entry?.name ?? entry?.key ?? "",
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

const isExternalUrl = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const renderOptionsSummary = (options, fallback) => (
  <div className="order-options-popover">
    {options.map((option, index) => (
      <div
        key={`${option?.name || "option"}-${index}`}
        className="order-option-row"
      >
        <span className="order-option-label">{option?.name || fallback}</span>
        {isExternalUrl(option?.value || "") ? (
          <a
            href={option.value}
            target="_blank"
            rel="noreferrer"
            className="order-option-link"
          >
            <LinkOutlined />
            <span>{option?.name || fallback}</span>
          </a>
        ) : (
          <span className="order-option-value">{option?.value || fallback}</span>
        )}
      </div>
    ))}
  </div>
);

export default function TransferOrderDetailPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.transferDetail");
  const tRefundRemake = useTranslations("dashboard.refundRemake");
  const user = useSelector((state) => state.auth.user);
  const params = useParams();
  const orderNumber = useMemo(
    () => String(params?.orderNumber || ""),
    [params],
  );

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [deletingDesignId, setDeletingDesignId] = useState(null);
  const [voidingLabelId, setVoidingLabelId] = useState(null);
  const [savingDesignerNotes, setSavingDesignerNotes] = useState(false);
  const [designerNotesDraft, setDesignerNotesDraft] = useState("");

  const loadDetail = useCallback(
    async (options = {}) => {
      const { silent = false } = options || {};
      if (!orderNumber) {
        setDetail(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const response = await TransferOrdersAPI.detail(orderNumber);
        setDetail(response?.data || null);
        setDesignerNotesDraft(String(response?.data?.designer_notes || ""));
      } catch (error) {
        setDetail(null);
        message.error(
          error?.response?.data?.error?.message ||
            tDetail("messages.loadError"),
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [message, orderNumber, tDetail],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleDeleteDesign = useCallback(
    async (designId) => {
      if (!designId) return;
      setDeletingDesignId(designId);
      try {
        await TransferOrdersAPI.deleteDesign(designId);
        message.success(tDetail("messages.designDeleteSuccess"));
        await loadDetail({ silent: true });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            tDetail("messages.designDeleteError"),
        );
      } finally {
        setDeletingDesignId(null);
      }
    },
    [loadDetail, message, tDetail],
  );

  const handleSaveDesignerNotes = useCallback(async () => {
    if (!detail?.id) return;
    setSavingDesignerNotes(true);
    try {
      await TransferOrdersAPI.update(detail.id, {
        designer_notes: designerNotesDraft?.trim()
          ? designerNotesDraft.trim()
          : null,
      });
      message.success(tDetail("messages.designerNotesSaved"));
      await loadDetail({ silent: true });
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tDetail("messages.designerNotesSaveError"),
      );
    } finally {
      setSavingDesignerNotes(false);
    }
  }, [designerNotesDraft, detail?.id, loadDetail, message, tDetail]);

  const handleVoidLabel = useCallback(async () => {
    const transferOrderId = detail?.id;
    const labelId =
      detail?.transfer_label?.id || detail?.transfer_label?.label_id;

    if (!transferOrderId || !labelId || detail?.order_status === "shipped") {
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
      await loadDetail({ silent: true });
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tOrders("detail.messages.voidLabelError"),
      );
    } finally {
      setVoidingLabelId(null);
    }
  }, [
    detail?.id,
    detail?.order_status,
    detail?.transfer_label,
    loadDetail,
    message,
    tOrders,
  ]);

  const designGroups = useMemo(
    () => (Array.isArray(detail?.design_groups) ? detail.design_groups : []),
    [detail?.design_groups],
  );

  const designTotalPrice = useMemo(
    () => Number(detail?.design_total_price || 0),
    [detail?.design_total_price],
  );
  const canDeleteDesign = useMemo(
    () => detail?.order_status === "newOrder",
    [detail?.order_status],
  );
  const transferLabel = useMemo(
    () => detail?.transfer_label || null,
    [detail?.transfer_label],
  );
  const transferLabelId = transferLabel?.id || transferLabel?.label_id || "";
  const isCompanyUser = hasAnyRole(user, [
    "companyAdmin",
    "companyCompletedWorker",
    "companyShipmentWorker",
  ]);
  const isCustomerAdmin = hasAnyRole(user, ["customerAdmin"]);
  const canViewAuditTimeline = hasAnyRole(user, ["companyAdmin"]);
  const canVoidTransferLabel =
    (isCompanyUser || isCustomerAdmin) &&
    Boolean(transferLabelId) &&
    transferLabel?.source !== "self_label" &&
    detail?.order_status !== "shipped";
  const pendingPoolItems = Number(detail?.pool_completion_summary?.pending_items || 0);
  const itemTotalPrice = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail.items : [];
    return items.reduce((sum, item) => sum + Number(item?.price || 0), 0);
  }, [detail?.items]);
  const remakeContext = useMemo(
    () => detail?.remake_context || null,
    [detail?.remake_context],
  );
  const showRemakeTab = useMemo(
    () => remakeContext?.is_remake_child === true,
    [remakeContext?.is_remake_child],
  );

  const tDesign = useTranslations("dashboard.orders.detail");
  const tEntityTypes = useTranslations("common.entityTypes");
  const none = tOrders("common.none");
  const currency = detail?.currency;
  const statusText = (value) =>
    value ? tOrders(`status.values.${value}`) || value : none;
  const items = Array.isArray(detail?.items) ? detail.items : [];
  const designCount = designGroups.reduce(
    (sum, group) =>
      sum + (Array.isArray(group?.designs) ? group.designs.length : 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    );
  }

  if (!detail) {
    return <Alert type="error" showIcon message={tDetail("messages.notFound")} />;
  }

  const orderDate = formatDateTime(detail?.order_date, none);
  // Filled once the detail API returns the customer entity (see owner_entity
  // on the list endpoint); hidden while it is absent.
  const customerEntityName =
    detail?.customer_entity?.name || detail?.customer?.name || "";
  const partnerName =
    detail?.owner_entity?.type === "partner" ? detail.owner_entity.name : "";
  const progressStep = (() => {
    switch (String(detail?.order_status || "")) {
      case "newOrder":
      case "waitingForDesign":
        return 1;
      case "processing":
      case "downloaded":
        return 2;
      case "printed":
        return 3;
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

  const labelRows = transferLabel
    ? [
        {
          label: tOrders("detail.fields.labelSource"),
          value: transferLabel?.source || none,
        },
        ...(transferLabel?.base_shipping_price != null
          ? [
              {
                label: tDetail("fields.labelPrice"),
                value: (
                  <span className="ej-mono">
                    {formatCurrency(transferLabel.base_shipping_price, currency)}
                  </span>
                ),
              },
              transferLabel?.source === "shipStationCompany"
                ? {
                    label: tDetail("fields.withMultiplier"),
                    value: (
                      <span className="ej-mono">
                        {formatCurrency(
                          transferLabel.shipment_total_price ??
                            transferLabel.shipping_price,
                          currency,
                        )}
                      </span>
                    ),
                  }
                : null,
            ]
          : [
              {
                label: tOrders("detail.fields.labelRate"),
                value:
                  transferLabel?.shipping_price != null ? (
                    <span className="ej-mono">
                      {formatCurrency(transferLabel.shipping_price, currency)}
                    </span>
                  ) : (
                    none
                  ),
              },
            ]),
        transferLabel?.source === "easyjet" &&
        transferLabel?.postage_fee != null
          ? {
              label: tOrders("detail.fields.labelPostageFee"),
              value: (
                <span className="ej-mono">
                  {formatCurrency(transferLabel.postage_fee, currency)}
                </span>
              ),
            }
          : null,
        {
          label: tOrders("detail.fields.labelCreatedAt"),
          value: formatDateTime(transferLabel?.created_at, none),
        },
      ]
    : [];

  const detailTabs = [
    {
      key: "overview",
      label: tDetail("tabs.overview"),
      children: (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            {pendingPoolItems > 0 ? (
              <Alert
                type="warning"
                showIcon
                message={tDetail("messages.poolIncomplete", {
                  count: pendingPoolItems,
                })}
              />
            ) : null}

            <SectionHeader title={tDetail("sections.items")} count={items.length} />
            {items.length ? (
              <ul className="m-0 list-none divide-y divide-[var(--ej-border)] rounded-xl border border-line bg-surface p-0">
                {items.map((item) => {
                  const options = normalizeOptions(item?.options);
                  return (
                    <li
                      key={item?.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                        <span className="break-words text-sm font-medium text-text">
                          {item?.name || none}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {item?.transfer_product?.name || none}
                        </span>
                      </div>
                      {options.length ? (
                        <Popover
                          trigger="hover"
                          placement="bottomLeft"
                          content={renderOptionsSummary(options, none)}
                        >
                          <button
                            type="button"
                            className="order-options-trigger"
                          >
                            <ProfileOutlined />
                            <span>{tOrders("columns.options")}</span>
                            <span className="order-options-count">
                              {options.length}
                            </span>
                          </button>
                        </Popover>
                      ) : null}
                      <MetaChip>
                        {tDetail("designCard.quantity")}: {item?.quantity ?? 1}
                      </MetaChip>
                      <span className="ej-mono min-w-[72px] text-right text-[13px] font-medium text-text">
                        {formatCurrency(item?.price, currency)}
                      </span>
                      <StatusTag status={item?.status} size="small">
                        {statusText(item?.status)}
                      </StatusTag>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <SectionEmpty>{tDesign("messages.noItems")}</SectionEmpty>
            )}

            <SectionHeader
              title={tDetail("sections.uploadedDesigns")}
              count={designCount}
              extra={
                designGroups.length ? (
                  <span className="ej-mono text-sm font-semibold text-text">
                    {formatCurrency(designTotalPrice, currency)}
                  </span>
                ) : null
              }
            />
            {designGroups.length ? (
              <div className="flex flex-col gap-4">
                {designGroups.map((group, groupIndex) => (
                  <section
                    key={group?.sub_category_id || `group-${groupIndex}`}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="m-0 text-sm font-semibold text-text">
                        {group?.sub_category_name || none}
                      </h3>
                      <span className="ej-mono text-[13px] font-semibold text-text">
                        {formatCurrency(group?.total_price, currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
                      {(Array.isArray(group?.designs) ? group.designs : []).map(
                        (design) => (
                          <div
                            key={design?.id}
                            className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-3"
                          >
                            <DesignThumbnailImage
                              design={design}
                              alt={`design-${design?.id}`}
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <MetaChip>
                                {tDetail("designCard.quantity")}:{" "}
                                {design?.quantity ?? 1}
                              </MetaChip>
                              <MetaChip>
                                {formatAmount(design?.width)}&quot; ×{" "}
                                {formatAmount(design?.height)}&quot;
                              </MetaChip>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-col">
                                <span className="ej-mono text-[13px] font-semibold text-text">
                                  {formatCurrency(design?.price, currency)}
                                </span>
                                <span className="text-xs text-text-secondary">
                                  {formatDateTime(design?.created_at, none)}
                                </span>
                              </div>
                              {canDeleteDesign ? (
                                <Popconfirm
                                  title={tDetail("actions.deleteConfirmTitle")}
                                  description={tDetail(
                                    "actions.deleteConfirmDescription",
                                  )}
                                  okText={tDetail("actions.delete")}
                                  okButtonProps={{
                                    danger: true,
                                    loading: deletingDesignId === design?.id,
                                  }}
                                  onConfirm={() => handleDeleteDesign(design?.id)}
                                >
                                  <Tooltip title={tDetail("actions.delete")}>
                                    <Button
                                      danger
                                      type="text"
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      loading={deletingDesignId === design?.id}
                                      aria-label={tDetail("actions.delete")}
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              ) : null}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <SectionEmpty>{tDetail("messages.noUploadedDesigns")}</SectionEmpty>
            )}

            <SideCard title={tDetail("sections.notes")}>
              <KeyValueList
                rows={[
                  {
                    label: tDetail("fields.customerNotes"),
                    value: detail?.notes || none,
                  },
                ]}
              />
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="transfer-designer-notes"
                  className="text-xs text-text-secondary"
                >
                  {tDetail("fields.designerNotes")}
                </label>
                <Input.TextArea
                  id="transfer-designer-notes"
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  value={designerNotesDraft}
                  onChange={(event) =>
                    setDesignerNotesDraft(event?.target?.value || "")
                  }
                  placeholder={tDetail("placeholders.designerNotes")}
                />
                <div className="flex justify-end">
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSaveDesignerNotes}
                    loading={savingDesignerNotes}
                    disabled={
                      designerNotesDraft.trim() ===
                      String(detail?.designer_notes || "").trim()
                    }
                  >
                    {tDetail("actions.saveNotes")}
                  </Button>
                </div>
              </div>
            </SideCard>
          </div>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <SideCard title={tDetail("sections.totals")}>
              <KeyValueList
                rows={[
                  {
                    label: tDetail("priceSummary.itemPrices"),
                    value: (
                      <span className="ej-mono">
                        {formatCurrency(itemTotalPrice, currency)}
                      </span>
                    ),
                  },
                  {
                    label: tDetail("priceSummary.designPrices"),
                    value: (
                      <span className="ej-mono">
                        {formatCurrency(designTotalPrice, currency)}
                      </span>
                    ),
                  },
                  {
                    label: tDetail("priceSummary.combined"),
                    value: (
                      <span className="ej-mono font-semibold">
                        {formatCurrency(
                          itemTotalPrice + designTotalPrice,
                          currency,
                        )}
                      </span>
                    ),
                  },
                  {
                    label: tDetail("fields.orderTotal"),
                    value: (
                      <span className="ej-mono">
                        {formatAmount(detail?.order_total)}
                      </span>
                    ),
                  },
                  {
                    label: tDetail("fields.currency"),
                    value: currency || none,
                  },
                  { label: tDesign("fields.orderDate"), value: orderDate },
                ]}
              />
            </SideCard>
            <SideCard title={tDesign("sections.customer")}>
              <KeyValueList
                rows={[
                  {
                    label: tDesign("fields.customerEntity"),
                    value: customerEntityName || none,
                  },
                  partnerName
                    ? { label: tEntityTypes("partner"), value: partnerName }
                    : null,
                  {
                    label: tDesign("fields.customerName"),
                    value: detail?.bill_to_name || none,
                  },
                  {
                    label: tDesign("fields.customerEmail"),
                    value: detail?.customer_email || none,
                  },
                  {
                    label: tDetail("fields.orderName"),
                    value: detail?.order_name || none,
                  },
                ]}
              />
            </SideCard>
            <SideCard title={tDetail("sections.delivery")}>
              <KeyValueList
                rows={[
                  {
                    label: tOrders("columns.deliveryMethod"),
                    value: detail?.delivery_method || none,
                  },
                  {
                    label: tOrders("columns.localPickup"),
                    value: <YesNoCell value={Boolean(detail?.local_pickup)} />,
                  },
                ]}
              />
            </SideCard>
            <AddressCard
              title={tDesign("sections.shippingAddress")}
              order={detail}
              prefix="ship_to"
              emptyText={none}
            />
            <AddressCard
              title={tDesign("sections.billing")}
              order={detail}
              prefix="bill_to"
              emptyText={none}
            />
          </aside>
        </div>
      ),
    },
    {
      key: "labels",
      label: tDetail("tabs.labels"),
      children: (
        <div className="flex flex-col gap-3">
          <SectionHeader
            title={tDetail("sections.label")}
            count={transferLabel ? 1 : 0}
          />
          {transferLabel ? (
            <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-line bg-surface p-4">
              <KeyValueList rows={labelRows} />
              <div className="flex flex-wrap justify-end gap-2">
                {canVoidTransferLabel ? (
                  <Popconfirm
                    title={tOrders("detail.actions.voidLabelConfirmTitle")}
                    okText={tOrders("detail.actions.voidLabelConfirmOk")}
                    okButtonProps={{
                      danger: true,
                      loading: voidingLabelId === String(transferLabelId),
                    }}
                    onConfirm={handleVoidLabel}
                  >
                    <Button
                      danger
                      loading={voidingLabelId === String(transferLabelId)}
                    >
                      {tOrders("detail.actions.voidLabel")}
                    </Button>
                  </Popconfirm>
                ) : null}
                {transferLabel?.label_url ? (
                  <Button
                    type="primary"
                    icon={<ExportOutlined />}
                    href={transferLabel.label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tOrders("actions.download")}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : (
            <SectionEmpty>{tDetail("messages.noLabel")}</SectionEmpty>
          )}
        </div>
      ),
    },
    ...(showRemakeTab
      ? [
          {
            key: "remaked-order",
            label: tDetail("tabs.remakedOrder"),
            children: (
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <SideCard title={tDetail("sections.remakeRequest")}>
                  <KeyValueList
                    rows={[
                      {
                        label: tRefundRemake("detail.fields.requestType"),
                        value: remakeContext?.request?.request_type
                          ? tRefundRemake(
                              `requestType.${remakeContext.request.request_type}`,
                            ) || remakeContext.request.request_type
                          : none,
                      },
                      {
                        label: tRefundRemake("detail.fields.status"),
                        value: remakeContext?.request?.status ? (
                          <StatusTag status={remakeContext.request.status}>
                            {tRefundRemake(
                              `status.${remakeContext.request.status}`,
                            ) || remakeContext.request.status}
                          </StatusTag>
                        ) : (
                          none
                        ),
                      },
                      {
                        label: tRefundRemake("detail.fields.responsibleEntity"),
                        value:
                          remakeContext?.request?.responsible_entity_name ||
                          none,
                      },
                      {
                        label: tRefundRemake("detail.fields.company"),
                        value: remakeContext?.request?.company_name || none,
                      },
                      {
                        label: tRefundRemake("detail.fields.customer"),
                        value: remakeContext?.request?.customer_name || none,
                      },
                      {
                        label: tRefundRemake("detail.fields.createdAt"),
                        value: formatDateTime(
                          remakeContext?.request?.created_at,
                          none,
                        ),
                      },
                      {
                        label: tRefundRemake("detail.fields.updatedAt"),
                        value: formatDateTime(
                          remakeContext?.request?.updated_at,
                          none,
                        ),
                      },
                      {
                        label: tRefundRemake("detail.fields.description"),
                        value: remakeContext?.request?.description || none,
                      },
                    ]}
                  />
                  {remakeContext?.request?.id ? (
                    <div className="flex justify-end">
                      <Link
                        href={`/dashboard/transfer-orders/orders/refund-remake/${remakeContext.request.id}`}
                      >
                        <Button icon={<ExportOutlined />}>
                          {tDetail("actions.viewRequest")}
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </SideCard>

                <SideCard title={tDetail("sections.originalTransferOrder")}>
                  <KeyValueList
                    rows={[
                      {
                        label: tOrders("columns.orderNumber"),
                        value: remakeContext?.source_order?.order_number ? (
                          <span className="ej-mono">
                            #{remakeContext.source_order.order_number}
                          </span>
                        ) : (
                          none
                        ),
                      },
                      {
                        label: tDetail("fields.orderName"),
                        value: remakeContext?.source_order?.order_name || none,
                      },
                      {
                        label: tOrders("columns.status"),
                        value: remakeContext?.source_order?.order_status ? (
                          <StatusTag
                            status={remakeContext.source_order.order_status}
                          >
                            {statusText(remakeContext.source_order.order_status)}
                          </StatusTag>
                        ) : (
                          none
                        ),
                      },
                      {
                        label: tOrders("columns.orderDate"),
                        value: formatDateTime(
                          remakeContext?.source_order?.order_date,
                          none,
                        ),
                      },
                      {
                        label: tOrders("columns.customerName"),
                        value: remakeContext?.source_order?.bill_to_name || none,
                      },
                      {
                        label: tDetail("fields.currency"),
                        value: remakeContext?.source_order?.currency || none,
                      },
                      {
                        label: tDetail("fields.orderTotal"),
                        value: (
                          <span className="ej-mono">
                            {formatCurrency(
                              remakeContext?.source_order?.order_total,
                              remakeContext?.source_order?.currency,
                            )}
                          </span>
                        ),
                      },
                    ]}
                  />
                  {remakeContext?.source_order?.order_number ? (
                    <div className="flex justify-end">
                      <Link
                        href={`/dashboard/transfer-orders/orders/${encodeURIComponent(remakeContext.source_order.order_number)}`}
                      >
                        <Button icon={<ExportOutlined />}>
                          {tDetail("actions.openOrder")}
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </SideCard>
              </div>
            ),
          },
        ]
      : []),
    ...(canViewAuditTimeline
      ? [
          {
            key: "activity",
            label: tDetail("tabs.activity"),
            children: (
              <EntityAuditTimeline
                entityType="transfer_order"
                entityKey={detail?.order_number || orderNumber}
                visible={canViewAuditTimeline}
              />
            ),
          },
        ]
      : []),
  ];

  const sourceOrderNumber = remakeContext?.source_order?.order_number;

  return (
    <RequireRole
      anyOfRoles={[
        "companyAdmin",
        "companyCompletedWorker",
        "companyShipmentWorker",
        "partnerAdmin",
        "customerAdmin",
      ]}
      anyOfCategories={["Transfers"]}
    >
      <div className="space-y-5">
        <PageHeader
          className=""
          breadcrumb={[
            { title: tDetail("breadcrumb") },
            { title: `#${detail?.order_number || none}` },
          ]}
          title={<span className="ej-mono">#{detail?.order_number || none}</span>}
          meta={
            detail?.order_status ? (
              <>
                <StatusTag status={detail.order_status}>
                  {statusText(detail.order_status)}
                </StatusTag>
                {showRemakeTab ? (
                  <StatusTag tone="refund">{tOrders("status.values.remake")}</StatusTag>
                ) : null}
              </>
            ) : null
          }
          description={
            <HeaderFacts
              items={[
                customerEntityName
                  ? {
                      label: tDesign("fields.customerEntity"),
                      value: partnerName
                        ? `${customerEntityName} (${partnerName})`
                        : customerEntityName,
                      icon: <ShopOutlined aria-hidden="true" />,
                    }
                  : null,
                detail?.order_name
                  ? { label: tDetail("fields.orderName"), value: detail.order_name }
                  : null,
                { label: tDesign("fields.orderDate"), value: orderDate },
              ]}
            />
          }
        />
        {showRemakeTab && sourceOrderNumber ? (
          <Alert
            type="info"
            showIcon
            message={tDetail("messages.remakeOf", {
              orderNumber: sourceOrderNumber,
            })}
          />
        ) : null}
        {progressStep !== null ? (
          <div className="rounded-xl border border-line px-5 py-4">
            <Steps
              size="small"
              current={progressStep}
              status="process"
              items={progressItems}
              aria-label={tDesign("progress.ariaLabel")}
            />
          </div>
        ) : null}
        <Tabs defaultActiveKey="overview" items={detailTabs} />
      </div>
    </RequireRole>
  );
}
