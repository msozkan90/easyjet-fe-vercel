"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSelector } from "react-redux";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Popover,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tabs,
  Typography,
} from "antd";
import EntityAuditTimeline from "@/components/audit/EntityAuditTimeline";
import RequireRole from "@/components/common/Access/RequireRole";
import { LazyGuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import { TransferOrdersAPI } from "@/utils/api";
import {
  DeleteOutlined,
  ExportOutlined,
  LinkOutlined,
  ProfileOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import { hasAnyRole } from "@/utils/rbac";

const STATUS_COLORS = {
  newOrder: "blue",
  waitingForDesign: "gold",
  readyForProduction: "purple",
  processing: "geekblue",
  pdf: "cyan",
  completed: "green",
  shipped: "volcano",
  cancel: "red",
};

const REMAKE_REQUEST_STATUS_COLORS = {
  pending: "gold",
  completed: "green",
  canceled: "red",
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "-";
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

  const itemColumns = useMemo(
    () => [
      {
        title: tOrders("columns.item"),
        dataIndex: "name",
        render: (value) => value || tOrders("common.none"),
      },
      {
        title: tOrders("columns.options"),
        dataIndex: "options",
        width: 140,
        render: (value) => {
          const options = normalizeOptions(value);
          if (!options.length) return tOrders("values.noOptions");

          return (
            <Popover
              trigger="hover"
              placement="rightTop"
              content={renderOptionsSummary(options, tOrders("common.none"))}
            >
              <button type="button" className="order-options-trigger">
                <ProfileOutlined />
                <span>{tOrders("columns.options")}</span>
                <span className="order-options-count">{options.length}</span>
              </button>
            </Popover>
          );
        },
      },
      {
        title: tOrders("columns.product"),
        dataIndex: "transfer_product",
        render: (_, record) =>
          record?.transfer_product?.name || tOrders("common.none"),
      },
      {
        title: tOrders("columns.quantity"),
        dataIndex: "quantity",
        width: 80,
      },
      {
        title: tOrders("columns.status"),
        dataIndex: "status",
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {value
              ? tOrders(`status.values.${value}`) || value
              : tOrders("common.none")}
          </Tag>
        ),
      },
    ],
    [tOrders],
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
  const canViewAuditTimeline = hasAnyRole(user, ["companyAdmin"]);
  const canVoidTransferLabel =
    isCompanyUser &&
    Boolean(transferLabelId) &&
    transferLabel?.source !== "self_label" &&
    detail?.order_status !== "shipped";
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

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!detail) {
    return <Empty description={tDetail("messages.notFound")} />;
  }

  const detailTabs = [
    {
      key: "overview",
      label: tDetail("tabs.overview"),
      children: (
        <div className="space-y-6">
          <Card title={tDetail("tabs.overview")}>
            <Descriptions
              column={{ xs: 1, sm: 2, md: 3 }}
              bordered
              size="small"
            >
              <Descriptions.Item label={tDetail("fields.orderName")}>
                {detail?.order_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.status")}>
                <Tag color={STATUS_COLORS[detail?.order_status] || "default"}>
                  {detail?.order_status
                    ? tOrders(`status.values.${detail?.order_status}`) ||
                      detail?.order_status
                    : tOrders("common.none")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.customerName")}>
                {detail?.bill_to_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.orderDate")}>
                {detail?.order_date
                  ? moment(detail.order_date).format("LLL")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.currency")}>
                {detail?.currency || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.orderTotal")}>
                {formatAmount(detail?.order_total)}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.notes")}>
                {detail?.notes || "-"}
              </Descriptions.Item>
              <Descriptions.Item
                label={tOrders("columns.designerNotes")}
                span={2}
              >
                {detail?.designer_notes || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={tOrders("columns.designerNotes")}>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Input.TextArea
                rows={4}
                value={designerNotesDraft}
                onChange={(event) =>
                  setDesignerNotesDraft(event?.target?.value || "")
                }
                placeholder={tDetail("placeholders.designerNotes")}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveDesignerNotes}
                  loading={savingDesignerNotes}
                >
                  {tDetail("actions.saveNotes")}
                </Button>
              </div>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: "items",
      label: tDetail("tabs.itemsAndDesigns"),
      children: (
        <div className="space-y-6">
          <Card title={tDetail("sections.items")}>
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={Array.isArray(detail?.items) ? detail.items : []}
              pagination={false}
            />
          </Card>

          <Card title={tDetail("sections.uploadedDesigns")}>
            {!designGroups.length ? (
              <Empty description={tDetail("messages.noUploadedDesigns")} />
            ) : (
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                {designGroups.map((group, groupIndex) => (
                  <Card
                    key={group?.sub_category_id || `group-${groupIndex}`}
                    type="inner"
                    title={group?.sub_category_name || "-"}
                    extra={
                      <Typography.Text strong>
                        {formatCurrency(group?.total_price, detail?.currency)}
                      </Typography.Text>
                    }
                  >
                    <Row gutter={[12, 12]}>
                      {(Array.isArray(group?.designs) ? group.designs : []).map(
                        (design) => (
                          <Col xs={24} sm={12} md={8} lg={6} key={design?.id}>
                            <Card
                              size="small"
                              styles={{ body: { padding: 10 } }}
                            >
                              <Space
                                direction="vertical"
                                size={8}
                                style={{ width: "100%" }}
                              >
                                <LazyGuardedPreviewImage
                                  src={design?.design_url}
                                  alt={`design-${design?.id}`}
                                  openLabel={tDetail("actions.open")}
                                  preparingText={tDetail("preview.preparing")}
                                  emptyText={tDetail("preview.empty")}
                                />
                                <Typography.Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                >
                                  {tDetail("designCard.quantity")}:{" "}
                                  {design?.quantity ?? 1}
                                </Typography.Text>
                                <Typography.Text
                                  type="secondary"
                                  style={{ fontSize: 12 }}
                                >
                                  {tDetail("designCard.size")}:{" "}
                                  {formatAmount(design?.width)}&quot; x{" "}
                                  {formatAmount(design?.height)}&quot;
                                </Typography.Text>
                                <Typography.Text strong>
                                  {tDetail("designCard.price")}:{" "}
                                  {formatCurrency(
                                    design?.price,
                                    detail?.currency,
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
                                  <Space>
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
                                    {canDeleteDesign ? (
                                      <Popconfirm
                                        title={tDetail(
                                          "actions.deleteConfirmTitle",
                                        )}
                                        description={tDetail(
                                          "actions.deleteConfirmDescription",
                                        )}
                                        okText={tDetail("actions.delete")}
                                        okButtonProps={{
                                          danger: true,
                                          loading:
                                            deletingDesignId === design?.id,
                                        }}
                                        onConfirm={() =>
                                          handleDeleteDesign(design?.id)
                                        }
                                      >
                                        <Button
                                          danger
                                          size="small"
                                          icon={<DeleteOutlined />}
                                          loading={
                                            deletingDesignId === design?.id
                                          }
                                        >
                                          {tDetail("actions.delete")}
                                        </Button>
                                      </Popconfirm>
                                    ) : null}
                                  </Space>
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
            )}
          </Card>
        </div>
      ),
    },
    {
      key: "operations",
      label: tDetail("tabs.labelsAndPricing"),
      children: (
        <div className="space-y-6">
          {transferLabel ? (
            <Card title={tOrders("detail.fields.labels")}>
              <Descriptions
                column={{ xs: 1, sm: 2, md: 3 }}
                bordered
                size="small"
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
                          detail?.currency,
                        )}
                      </Typography.Text>
                      {transferLabel?.source === "shipStationCompany" ? (
                        <Typography.Text>
                          With Multiplier:{" "}
                          {formatCurrency(
                            transferLabel.shipment_total_price ??
                              transferLabel.shipping_price,
                            detail?.currency,
                          )}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  ) : transferLabel?.shipping_price != null ? (
                    formatCurrency(
                      transferLabel.shipping_price,
                      detail?.currency,
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
                <Descriptions.Item
                  label={tOrders("detail.actions.viewLabel")}
                  span={3}
                >
                  <Space wrap>
                    {transferLabel?.label_url ? (
                      <Button
                        icon={<ExportOutlined />}
                        onClick={() => {
                          window.open(
                            transferLabel.label_url,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        {tOrders("actions.download")}
                      </Button>
                    ) : (
                      tOrders("common.none")
                    )}
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
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : null}

          <Card title={tDetail("sections.priceSummary")}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Statistic
                  title={tDetail("priceSummary.itemPrices")}
                  value={formatCurrency(itemTotalPrice, detail?.currency)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title={tDetail("priceSummary.designPrices")}
                  value={formatCurrency(designTotalPrice, detail?.currency)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title={tDetail("priceSummary.combined")}
                  value={formatCurrency(
                    itemTotalPrice + designTotalPrice,
                    detail?.currency,
                  )}
                />
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
    ...(showRemakeTab
      ? [
          {
            key: "remaked-order",
            label: tDetail("tabs.remakedOrder"),
            children: (
              <div className="space-y-6">
                <Card title={tDetail("sections.remakeRequest")}>
                  <Descriptions
                    column={{ xs: 1, sm: 2, md: 3 }}
                    bordered
                    size="small"
                  >
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.requestType")}
                    >
                      {remakeContext?.request?.request_type
                        ? tRefundRemake(
                            `requestType.${remakeContext.request.request_type}`,
                          ) || remakeContext.request.request_type
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.status")}
                    >
                      {remakeContext?.request?.status ? (
                        <Tag
                          color={
                            REMAKE_REQUEST_STATUS_COLORS[
                              remakeContext.request.status
                            ] || "default"
                          }
                        >
                          {tRefundRemake(
                            `status.${remakeContext.request.status}`,
                          ) || remakeContext.request.status}
                        </Tag>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.responsibleEntity")}
                    >
                      {remakeContext?.request?.responsible_entity_name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.company")}
                    >
                      {remakeContext?.request?.company_name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.customer")}
                    >
                      {remakeContext?.request?.customer_name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.createdAt")}
                    >
                      {remakeContext?.request?.created_at
                        ? moment(remakeContext.request.created_at).format("LLL")
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.updatedAt")}
                    >
                      {remakeContext?.request?.updated_at
                        ? moment(remakeContext.request.updated_at).format("LLL")
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label={tDetail("fields.requestLink")}>
                      {remakeContext?.request?.id ? (
                        <Link
                          href={`/dashboard/transfer-orders/orders/refund-remake/${remakeContext.request.id}`}
                        >
                          <Button icon={<ExportOutlined />}>
                            {tDetail("actions.viewRequest")}
                          </Button>
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tRefundRemake("detail.fields.description")}
                      span={3}
                    >
                      {remakeContext?.request?.description || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card title={tDetail("sections.originalTransferOrder")}>
                  <Descriptions
                    column={{ xs: 1, sm: 2, md: 3 }}
                    bordered
                    size="small"
                  >
                    <Descriptions.Item label={tOrders("columns.orderNumber")}>
                      {remakeContext?.source_order?.order_number || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label={tDetail("fields.orderName")}>
                      {remakeContext?.source_order?.order_name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label={tOrders("columns.status")}>
                      {remakeContext?.source_order?.order_status ? (
                        <Tag
                          color={
                            STATUS_COLORS[
                              remakeContext.source_order.order_status
                            ] || "default"
                          }
                        >
                          {tOrders(
                            `status.values.${remakeContext.source_order.order_status}`,
                          ) || remakeContext.source_order.order_status}
                        </Tag>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label={tOrders("columns.orderDate")}>
                      {remakeContext?.source_order?.order_date
                        ? moment(remakeContext.source_order.order_date).format(
                            "LLL",
                          )
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={tOrders("columns.customerName")}
                    >
                      {remakeContext?.source_order?.bill_to_name || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label={tDetail("fields.currency")}>
                      {remakeContext?.source_order?.currency || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label={tDetail("fields.orderTotal")}>
                      {formatCurrency(
                        remakeContext?.source_order?.order_total,
                        remakeContext?.source_order?.currency,
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label={tDetail("fields.orderLink")}>
                      {remakeContext?.source_order?.order_number ? (
                        <Link
                          href={`/dashboard/transfer-orders/orders/${encodeURIComponent(remakeContext.source_order.order_number)}`}
                        >
                          <Button icon={<ExportOutlined />}>
                            {tDetail("actions.openOrder")}
                          </Button>
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
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
      <div className="min-h-full bg-slate-50/70 p-4 md:p-6">
        <div className="space-y-6">
          <Card className="rounded-2xl border border-slate-100 shadow-sm">
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {tDetail("header.orderNumber", {
                orderNumber: detail?.order_number || "-",
              })}
            </Typography.Title>
            <Descriptions
              column={{ xs: 1, sm: 2, md: 3 }}
              bordered
              size="small"
            >
              <Descriptions.Item label={tDetail("fields.orderName")}>
                {detail?.order_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.status")}>
                <Tag color={STATUS_COLORS[detail?.order_status] || "default"}>
                  {detail?.order_status
                    ? tOrders(`status.values.${detail?.order_status}`) ||
                      detail?.order_status
                    : tOrders("common.none")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.customerName")}>
                {detail?.bill_to_name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.orderDate")}>
                {detail?.order_date
                  ? moment(detail.order_date).format("LLL")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.currency")}>
                {detail?.currency || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.orderTotal")}>
                {formatAmount(detail?.order_total)}
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.notes")}>
                {detail?.notes || "-"}
              </Descriptions.Item>
              <Descriptions.Item
                label={tOrders("columns.designerNotes")}
                span={2}
              >
                {detail?.designer_notes || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          <Card
            className="rounded-2xl border border-slate-100 shadow-sm"
            bodyStyle={{ padding: 20 }}
          >
            <Tabs
              defaultActiveKey="overview"
              items={detailTabs}
              className="[&_.ant-tabs-nav]:mb-6 [&_.ant-tabs-tab]:rounded-full [&_.ant-tabs-tab]:px-4 [&_.ant-tabs-tab]:py-2"
            />
          </Card>
        </div>
      </div>
    </RequireRole>
  );
}
