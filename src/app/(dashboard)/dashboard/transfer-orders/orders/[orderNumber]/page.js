"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { useParams } from "next/navigation";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Popconfirm,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { TransferOrdersAPI } from "@/utils/api";
import { DeleteOutlined, ExportOutlined, SaveOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";

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

function LazyPreviewImage({ src, alt, preparingText, emptyText }) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
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
      {!visible ? (
        <Typography.Text type="secondary">{preparingText}</Typography.Text>
      ) : !src || failed ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : (
        <img
          src={src}
          alt={alt || "design"}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </div>
  );
}

export default function TransferOrderDetailPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.transferDetail");
  const params = useParams();
  const orderNumber = useMemo(() => String(params?.orderNumber || ""), [params]);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [deletingDesignId, setDeletingDesignId] = useState(null);
  const [savingDesignerNotes, setSavingDesignerNotes] = useState(false);
  const [designerNotesDraft, setDesignerNotesDraft] = useState("");

  const loadDetail = useCallback(async (options = {}) => {
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
        error?.response?.data?.error?.message || tDetail("messages.loadError"),
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [message, orderNumber, tDetail]);

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
        message.error(error?.response?.data?.error?.message || tDetail("messages.designDeleteError"));
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
        title: tOrders("columns.product"),
        dataIndex: "transfer_product",
        render: (_, record) => record?.transfer_product?.name || tOrders("common.none"),
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
            {value ? tOrders(`status.values.${value}`) || value : tOrders("common.none")}
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
        designer_notes: designerNotesDraft?.trim() ? designerNotesDraft.trim() : null,
      });
      message.success(tDetail("messages.designerNotesSaved"));
      await loadDetail({ silent: true });
    } catch (error) {
      message.error(error?.response?.data?.error?.message || tDetail("messages.designerNotesSaveError"));
    } finally {
      setSavingDesignerNotes(false);
    }
  }, [designerNotesDraft, detail?.id, loadDetail, message, tDetail]);

  const designGroups = useMemo(
    () => (Array.isArray(detail?.design_groups) ? detail.design_groups : []),
    [detail?.design_groups],
  );

  const designTotalPrice = useMemo(
    () => Number(detail?.design_total_price || 0),
    [detail?.design_total_price],
  );
  const transferLabel = useMemo(() => detail?.transfer_label || null, [detail?.transfer_label]);
  const itemTotalPrice = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail.items : [];
    return items.reduce((sum, item) => sum + Number(item?.price || 0), 0);
  }, [detail?.items]);

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
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {tDetail("header.orderNumber", { orderNumber: detail?.order_number || "-" })}
            </Typography.Title>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
              <Descriptions.Item label={tDetail("fields.orderName")}>{detail?.order_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.status")}>
                <Tag color={STATUS_COLORS[detail?.order_status] || "default"}>
                  {detail?.order_status
                    ? tOrders(`status.values.${detail?.order_status}`) || detail?.order_status
                    : tOrders("common.none")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.customerName")}>{detail?.bill_to_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.orderDate")}>
                {detail?.order_date ? moment(detail.order_date).format("LLL") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.currency")}>{detail?.currency || "-"}</Descriptions.Item>
              <Descriptions.Item label={tDetail("fields.orderTotal")}>{formatAmount(detail?.order_total)}</Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.notes")}>{detail?.notes || "-"}</Descriptions.Item>
              <Descriptions.Item label={tOrders("columns.designerNotes")} span={2}>
                {detail?.designer_notes || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {transferLabel ? (
          <Col span={24}>
            <Card title={tOrders("detail.fields.labels")}>
              <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
                <Descriptions.Item label={tOrders("detail.fields.labelSource")}>
                  {transferLabel?.source || tOrders("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={tOrders("detail.fields.labelRate")}>
                  {transferLabel?.shipping_price != null
                    ? formatCurrency(transferLabel.shipping_price, detail?.currency)
                    : tOrders("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={tOrders("detail.fields.labelCreatedAt")}>
                  {transferLabel?.created_at ? moment(transferLabel.created_at).format("LLL") : tOrders("common.none")}
                </Descriptions.Item>
                <Descriptions.Item label={tOrders("detail.actions.viewLabel")} span={3}>
                  {transferLabel?.label_url ? (
                    <Button
                      icon={<ExportOutlined />}
                      onClick={() => {
                        window.open(transferLabel.label_url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      {tOrders("actions.download")}
                    </Button>
                  ) : (
                    tOrders("common.none")
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        ) : null}

        <Col span={24}>
          <Card title={tOrders("columns.designerNotes")}>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Input.TextArea
                rows={4}
                value={designerNotesDraft}
                onChange={(event) => setDesignerNotesDraft(event?.target?.value || "")}
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
        </Col>

        <Col span={24}>
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
                  value={formatCurrency(itemTotalPrice + designTotalPrice, detail?.currency)}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title={tDetail("sections.items")}>
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={Array.isArray(detail?.items) ? detail.items : []}
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={24}>
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
                      {(Array.isArray(group?.designs) ? group.designs : []).map((design) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={design?.id}>
                          <Card size="small" styles={{ body: { padding: 10 } }}>
                            <Space direction="vertical" size={8} style={{ width: "100%" }}>
                              <LazyPreviewImage
                                src={design?.design_url}
                                alt={`design-${design?.id}`}
                                preparingText={tDetail("preview.preparing")}
                                emptyText={tDetail("preview.empty")}
                              />
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {tDetail("designCard.size")}: {formatAmount(design?.width)}" x {formatAmount(design?.height)}"
                              </Typography.Text>
                              <Typography.Text strong>
                                {tDetail("designCard.price")}: {formatCurrency(design?.price, detail?.currency)}
                              </Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {design?.created_at ? moment(design.created_at).format("LLL") : "-"}
                              </Typography.Text>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<ExportOutlined />}
                                    onClick={() => {
                                      if (!design?.design_url) return;
                                      window.open(design.design_url, "_blank", "noopener,noreferrer");
                                    }}
                                  >
                                    {tDetail("actions.open")}
                                  </Button>
                                  <Popconfirm
                                    title={tDetail("actions.deleteConfirmTitle")}
                                    description={tDetail("actions.deleteConfirmDescription")}
                                    okText={tDetail("actions.delete")}
                                    okButtonProps={{ danger: true, loading: deletingDesignId === design?.id }}
                                    onConfirm={() => handleDeleteDesign(design?.id)}
                                  >
                                    <Button
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      loading={deletingDesignId === design?.id}
                                    >
                                      {tDetail("actions.delete")}
                                    </Button>
                                  </Popconfirm>
                                </Space>
                              </div>
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </RequireRole>
  );
}
