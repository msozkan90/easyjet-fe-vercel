"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import Link from "next/link";
import moment from "moment";
import { useParams } from "next/navigation";
import RequireRole from "@/components/common/Access/RequireRole";
import { useTranslations } from "@/i18n/use-translations";
import { RefundRemakeRequestsAPI } from "@/utils/api";
import {
  extractRefundRemakeEntityFromResponse,
  normalizeRefundRemakeImages,
  normalizeRefundRemakeItems,
} from "@/utils/refundRemakeRequests";

const STATUS_COLORS = {
  pending: "gold",
  completed: "green",
  canceled: "red",
};

export default function RefundRemakeRequestDetailPage({
  requireRoles = ["customerAdmin"],
  allowStatusActions = false,
  backHref = "/dashboard/orders/refund-remake",
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const params = useParams();
  const requestId = params?.id;
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const response = await RefundRemakeRequestsAPI.details(requestId);
      setDetail(extractRefundRemakeEntityFromResponse(response));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.detailLoadError")
      );
    } finally {
      setLoading(false);
    }
  }, [message, requestId, t]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const requestItems = useMemo(() => normalizeRefundRemakeItems(detail), [detail]);
  const images = useMemo(() => normalizeRefundRemakeImages(detail), [detail]);

  const updateStatus = useCallback(
    async (payload) => {
      if (!requestId) return;
      setStatusUpdating(true);
      try {
        await RefundRemakeRequestsAPI.updateStatus(requestId, payload);
        message.success(t("messages.statusUpdateSuccess"));
        await loadDetail();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.statusUpdateError")
        );
      } finally {
        setStatusUpdating(false);
      }
    },
    [loadDetail, message, requestId, t]
  );

  const handleCancelSubmit = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const rejectReason = String(values?.reject_reason || "").trim();
    if (!rejectReason) return;
    await updateStatus({ status: "canceled", reject_reason: rejectReason });
    form.resetFields();
    setCancelModalOpen(false);
  }, [form, updateStatus]);

  const isPending = detail?.status === "pending";
  const isCanceled = detail?.status === "canceled";

  const itemColumns = useMemo(
    () => [
      { title: t("detail.items.orderItem"), dataIndex: "orderItemId" },
      { title: t("detail.items.sku"), dataIndex: "sku", render: (value) => value || "-" },
      {
        title: t("detail.items.product"),
        dataIndex: "productName",
        render: (value) => value || "-",
      },
      { title: t("detail.items.quantity"), dataIndex: "quantity" },
      {
        title: t("detail.items.price"),
        dataIndex: "price",
        render: (value) =>
          value === undefined || value === null ? "-" : Number(value).toFixed(2),
      },
    ],
    [t]
  );

  return (
    <RequireRole anyOfRoles={requireRoles}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Space wrap>
          <Link href={backHref}>
            <Button icon={<ArrowLeftOutlined />}>{t("actions.backToList")}</Button>
          </Link>
          {allowStatusActions ? (
            <>
              <Popconfirm
                title={t("actions.completeConfirm")}
                onConfirm={() => updateStatus({ status: "completed" })}
                okButtonProps={{ loading: statusUpdating }}
                disabled={!isPending || statusUpdating}
              >
                <Button
                  type="primary"
                  disabled={!isPending || statusUpdating}
                  loading={statusUpdating}
                >
                  {t("actions.complete")}
                </Button>
              </Popconfirm>
              <Button
                danger
                disabled={!isPending || statusUpdating}
                onClick={() => setCancelModalOpen(true)}
              >
                {t("actions.cancel")}
              </Button>
            </>
          ) : null}
        </Space>

        <Card>
          {loading ? (
            <Spin />
          ) : !detail ? (
            <Empty description={t("messages.noData")} />
          ) : (
            <Space direction="vertical" style={{ width: "100%" }} size="large">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label={t("detail.fields.id")}>
                  {detail?.id || "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.order")}>
                  {detail?.order?.order_number || detail?.order_id || "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.requestType")}>
                  {detail?.request_type === "remake"
                    ? t("requestType.remake")
                    : t("requestType.refund")}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.status")}>
                  <Tag color={STATUS_COLORS[detail?.status] || "default"}>
                    {t(`status.${detail?.status || "pending"}`)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.responsibleEntity")}>
                  {detail?.responsible_entity?.entity_name ||
                    detail?.responsible_entity?.name ||
                    detail?.responsible_entity_id ||
                    "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.createdAt")}>
                  {detail?.created_at ? moment(detail.created_at).format("LLL") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.updatedAt")}>
                  {detail?.updated_at ? moment(detail.updated_at).format("LLL") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.description")}>
                  {detail?.description || "-"}
                </Descriptions.Item>
                <Descriptions.Item label={t("detail.fields.rejectReason")} span={2}>
                  {isCanceled ? detail?.reject_reason || "-" : "-"}
                </Descriptions.Item>
              </Descriptions>

              <Card type="inner" title={t("detail.sections.items")}>
                <Table
                  rowKey="orderItemId"
                  columns={itemColumns}
                  dataSource={requestItems}
                  pagination={false}
                  locale={{ emptyText: t("messages.noItems") }}
                  scroll={{ x: true }}
                />
              </Card>

              <Card type="inner" title={t("detail.sections.images")}>
                {images.length ? (
                  <Image.PreviewGroup>
                    <Space wrap>
                      {images.map((url, index) => (
                        <Image key={`${url}-${index}`} src={url} width={110} alt="request-image" />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                ) : (
                  <Empty description={t("messages.noImages")} />
                )}
              </Card>
            </Space>
          )}
        </Card>
      </Space>

      <Modal
        open={cancelModalOpen}
        title={t("actions.cancelModalTitle")}
        onCancel={() => {
          setCancelModalOpen(false);
          form.resetFields();
        }}
        onOk={handleCancelSubmit}
        okText={t("actions.cancelConfirm")}
        okButtonProps={{ danger: true, loading: statusUpdating }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reject_reason"
            label={t("detail.fields.rejectReason")}
            rules={[{ required: true, message: t("validation.rejectReasonRequired") }]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </RequireRole>
  );
}
