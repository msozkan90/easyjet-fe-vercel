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

function LazyPreviewImage({ src, alt }) {
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
        <Typography.Text type="secondary">Preparing preview...</Typography.Text>
      ) : !src || failed ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No preview" />
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
        error?.response?.data?.error?.message || "Failed to load transfer order detail",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [message, orderNumber]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleDeleteDesign = useCallback(
    async (designId) => {
      if (!designId) return;
      setDeletingDesignId(designId);
      try {
        await TransferOrdersAPI.deleteDesign(designId);
        message.success("Design deleted successfully");
        await loadDetail({ silent: true });
      } catch (error) {
        message.error(error?.response?.data?.error?.message || "Failed to delete design");
      } finally {
        setDeletingDesignId(null);
      }
    },
    [loadDetail, message],
  );

  const itemColumns = useMemo(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        render: (value) => value || "-",
      },
      {
        title: "Product",
        dataIndex: "transfer_product",
        render: (_, record) => record?.transfer_product?.name || "-",
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        width: 80,
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (value) => <Tag color={STATUS_COLORS[value] || "default"}>{value || "-"}</Tag>,
      },
    ],
    [],
  );

  const handleSaveDesignerNotes = useCallback(async () => {
    if (!detail?.id) return;
    setSavingDesignerNotes(true);
    try {
      await TransferOrdersAPI.update(detail.id, {
        designer_notes: designerNotesDraft?.trim() ? designerNotesDraft.trim() : null,
      });
      message.success("Designer notes saved");
      await loadDetail({ silent: true });
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "Failed to save designer notes");
    } finally {
      setSavingDesignerNotes(false);
    }
  }, [designerNotesDraft, detail?.id, loadDetail, message]);

  const designGroups = useMemo(
    () => (Array.isArray(detail?.design_groups) ? detail.design_groups : []),
    [detail?.design_groups],
  );

  const designTotalPrice = useMemo(
    () => Number(detail?.design_total_price || 0),
    [detail?.design_total_price],
  );
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
    return <Empty description="Transfer order not found" />;
  }

  return (
    <RequireRole
      anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
      anyOfCategories={["Transfers"]}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              Transfer Order #{detail?.order_number || "-"}
            </Typography.Title>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
              <Descriptions.Item label="Order Name">{detail?.order_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[detail?.order_status] || "default"}>
                  {detail?.order_status || "-"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{detail?.bill_to_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Order Date">
                {detail?.order_date ? moment(detail.order_date).format("LLL") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Currency">{detail?.currency || "-"}</Descriptions.Item>
              <Descriptions.Item label="Order Total">{formatAmount(detail?.order_total)}</Descriptions.Item>
              <Descriptions.Item label="Notes">{detail?.notes || "-"}</Descriptions.Item>
              <Descriptions.Item label="Designer Notes" span={2}>
                {detail?.designer_notes || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Designer Notes">
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Input.TextArea
                rows={4}
                value={designerNotesDraft}
                onChange={(event) => setDesignerNotesDraft(event?.target?.value || "")}
                placeholder="Add designer notes..."
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveDesignerNotes}
                  loading={savingDesignerNotes}
                >
                  Save Notes
                </Button>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Price Summary">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Statistic
                  title="Item Prices"
                  value={formatCurrency(itemTotalPrice, detail?.currency)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Design Prices"
                  value={formatCurrency(designTotalPrice, detail?.currency)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Combined"
                  value={formatCurrency(itemTotalPrice + designTotalPrice, detail?.currency)}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Items">
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={Array.isArray(detail?.items) ? detail.items : []}
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Uploaded Designs by Sub Category">
            {!designGroups.length ? (
              <Empty description="No uploaded designs" />
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
                              <LazyPreviewImage src={design?.design_url} alt={`design-${design?.id}`} />
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Size: {formatAmount(design?.width)}" x {formatAmount(design?.height)}"
                              </Typography.Text>
                              <Typography.Text strong>
                                Price: {formatCurrency(design?.price, detail?.currency)}
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
                                    Open
                                  </Button>
                                  <Popconfirm
                                    title="Delete this design?"
                                    description="This will delete the record and remove the file from storage."
                                    okText="Delete"
                                    okButtonProps={{ danger: true, loading: deletingDesignId === design?.id }}
                                    onConfirm={() => handleDeleteDesign(design?.id)}
                                  >
                                    <Button
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      loading={deletingDesignId === design?.id}
                                    >
                                      Delete
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
