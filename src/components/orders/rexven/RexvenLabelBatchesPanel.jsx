"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { FilePdfOutlined, ReloadOutlined, RedoOutlined } from "@ant-design/icons";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { getRexvenLabelErrorReason } from "./useRexvenAwarePdfDownload";

const STATUS_COLORS = {
  processing: "processing",
  completed: "success",
  partially_failed: "warning",
  failed: "error",
};

const RETRYABLE_STATUSES = new Set(["failed", "partially_failed"]);

const isReadyUrl = (url) => typeof url === "string" && url && url !== "#";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
};

const retryOrderIds = (batch) => {
  const processInfo = Array.isArray(batch?.processInfo) ? batch.processInfo : [];
  const failedIds = processInfo
    .filter((entry) => entry?.status !== "completed")
    .map((entry) => entry?.orderId);
  const ids = (failedIds.length ? failedIds : processInfo.map((entry) => entry?.orderId)).filter(
    (id) => Number.isInteger(Number(id)) && Number(id) > 0,
  );
  return Array.from(new Set(ids.map(Number)));
};

export default function RexvenLabelBatchesPanel({ customers = [] }) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.rexvenLabels");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState(null);

  useEffect(() => {
    if (!customerId && customers[0]?.id) setCustomerId(customers[0].id);
  }, [customerId, customers]);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const response = await OrdersAPI.rexvenLabelBatches({ customer_id: customerId, page });
      const data = response?.data ?? {};
      setRows(Array.isArray(data.labelBatches) ? data.labelBatches : []);
      setTotal(Number(data.totalCount || 0));
    } catch (error) {
      setRows([]);
      setTotal(0);
      message.error(error?.response?.data?.error?.message || t("messages.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [customerId, message, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = useCallback(
    async (batch) => {
      const orderIds = retryOrderIds(batch);
      if (!orderIds.length) {
        message.warning(t("messages.retryNoOrders"));
        return;
      }
      setRetryingId(batch.id);
      try {
        await OrdersAPI.retryRexvenLabelBatch(batch.id, {
          customer_id: customerId,
          order_ids: orderIds,
        });
        message.success(t("messages.retryRequested", { id: batch.id }));
        load();
      } catch (error) {
        const reason = getRexvenLabelErrorReason(error);
        message.error(
          reason
            ? t("messages.retryRejected", { reason })
            : error?.response?.data?.error?.message || t("messages.retryFailed"),
          8,
        );
      } finally {
        setRetryingId(null);
      }
    },
    [customerId, load, message, t],
  );

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90 },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 150,
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {t(`statuses.${STATUS_COLORS[value] ? value : "unknown"}`)}
          </Tag>
        ),
      },
      {
        title: t("columns.progress"),
        key: "progress",
        width: 220,
        render: (_, row) => (
          <Space size={[4, 4]} wrap>
            <Tag color="success">
              {t("counts.completed", { count: row?.completedProcessCount ?? 0 })}
            </Tag>
            {row?.failedProcessCount ? (
              <Tag color="error">{t("counts.failed", { count: row.failedProcessCount })}</Tag>
            ) : null}
            {row?.pendingProcessCount ? (
              <Tag color="processing">
                {t("counts.pending", { count: row.pendingProcessCount })}
              </Tag>
            ) : null}
            <Typography.Text type="secondary">
              {t("counts.total", { count: row?.totalProcessCount ?? 0 })}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: t("columns.orders"),
        key: "orders",
        render: (_, row) => {
          const info = Array.isArray(row?.processInfo) ? row.processInfo : [];
          return (
            <Space size={[4, 4]} wrap>
              {info.slice(0, 6).map((entry) => (
                <Tooltip key={`${row.id}-${entry?.orderId}`} title={entry?.errorMessage || undefined}>
                  <Tag color={entry?.status === "completed" ? "default" : "error"}>
                    {entry?.orderNumber || entry?.orderId}
                  </Tag>
                </Tooltip>
              ))}
              {info.length > 6 ? <Tag>+{info.length - 6}</Tag> : null}
            </Space>
          );
        },
      },
      {
        title: t("columns.processedAt"),
        key: "processedAt",
        width: 180,
        render: (_, row) => {
          const info = Array.isArray(row?.processInfo) ? row.processInfo : [];
          const latest = info
            .map((entry) => entry?.processedAt)
            .filter(Boolean)
            .sort()
            .pop();
          return formatDate(latest);
        },
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 200,
        render: (_, row) => (
          <Space>
            <Tooltip title={isReadyUrl(row?.batchPdfUrl) ? t("actions.openPdf") : t("actions.pdfNotReady")}>
              <Button
                icon={<FilePdfOutlined />}
                href={isReadyUrl(row?.batchPdfUrl) ? row.batchPdfUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!isReadyUrl(row?.batchPdfUrl)}
              />
            </Tooltip>
            {RETRYABLE_STATUSES.has(row?.status) ? (
              <Popconfirm
                title={t("actions.confirmRetry")}
                okText={t("actions.retry")}
                onConfirm={() => handleRetry(row)}
              >
                <Button icon={<RedoOutlined />} loading={retryingId === row.id}>
                  {t("actions.retry")}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [handleRetry, retryingId, t],
  );

  const expandedRowRender = useCallback(
    (row) => (
      <Table
        size="small"
        rowKey={(entry) => `${row.id}-${entry?.orderId}-${entry?.pageNumber}`}
        pagination={false}
        dataSource={Array.isArray(row?.processInfo) ? row.processInfo : []}
        columns={[
          { title: t("process.orderNumber"), dataIndex: "orderNumber" },
          { title: t("process.productName"), dataIndex: "productName" },
          { title: t("process.page"), dataIndex: "pageNumber", width: 80 },
          {
            title: t("process.status"),
            dataIndex: "status",
            width: 130,
            render: (value) => (
              <Tag color={value === "completed" ? "success" : value === "failed" ? "error" : "processing"}>
                {value || "-"}
              </Tag>
            ),
          },
          {
            title: t("process.error"),
            dataIndex: "errorMessage",
            render: (value) => value || "-",
          },
          {
            title: t("process.label"),
            dataIndex: "labelPdf",
            width: 90,
            render: (value) =>
              isReadyUrl(value) ? (
                <Button
                  size="small"
                  icon={<FilePdfOutlined />}
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ) : (
                "-"
              ),
          },
        ]}
      />
    ),
    [t],
  );

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert type="info" showIcon message={t("description")} />
      <Space wrap>
        {customers.length > 1 ? (
          <Select
            style={{ minWidth: 240 }}
            value={customerId}
            options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
            onChange={(value) => {
              setCustomerId(value);
              setPage(1);
            }}
          />
        ) : null}
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          {t("actions.refresh")}
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        expandable={{ expandedRowRender }}
        scroll={{ x: true }}
        locale={{ emptyText: t("empty") }}
        pagination={{
          current: page,
          pageSize: 10,
          total,
          showSizeChanger: false,
          onChange: (next) => setPage(next),
        }}
      />
    </Space>
  );
}
