"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import moment from "moment";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import { AuditLogsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

const { RangePicker } = DatePicker;

const DEFAULT_RANGE = [dayjs().subtract(29, "day"), dayjs()];

const STATUS_COLORS = {
  active: "green",
  inactive: "red",
  pending: "gold",
  blocked: "default",
};

const METRIC_TAG_COLORS = {
  completed: "green",
  shipped: "blue",
  failed: "red",
};

const buildRangeParams = (range) => {
  const [from, to] = Array.isArray(range) ? range : [];
  return {
    date_from: from?.startOf("day")?.toISOString(),
    date_to: to?.endOf("day")?.toISOString(),
  };
};

const normalizeSummaryList = (response) => {
  const payload = response?.data ?? response ?? [];
  return Array.isArray(payload) ? payload : [];
};

const normalizeDetailPayload = (response) => response?.data ?? response ?? {};

export default function CompanyUserMetricsPage() {
  const t = useTranslations("dashboard.userMetrics");
  const tStatus = useTranslations("common.status");
  const tActions = useTranslations("common.actions");
  const tRoles = useTranslations("forms.common.roles");

  const [dateRange, setDateRange] = useState(DEFAULT_RANGE);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailMetric, setDetailMetric] = useState("all");
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRows, setDetailRows] = useState([]);
  const [detailPagination, setDetailPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
  });
  const [detailSummary, setDetailSummary] = useState({
    completed_count: 0,
    shipped_count: 0,
    failed_count: 0,
  });

  const roleLabels = useMemo(
    () => ({
      [RoleEnum.COMPANY_ADMIN]: tRoles("companyAdmin"),
      [RoleEnum.COMPANY_SHIPMENT_WORKER]: tRoles("companyShipmentWorker"),
      [RoleEnum.COMPANY_COMPLETED_WORKER]: tRoles("companyCompletedWorker"),
    }),
    [tRoles],
  );

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await AuditLogsAPI.userMetricsSummary(buildRangeParams(dateRange));
      startTransition(() => {
        setRows(normalizeSummaryList(response));
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error?.message || t("messages.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [dateRange, t]);

  const loadDetail = useCallback(async () => {
    if (!selectedUser?.user_id) return;

    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await AuditLogsAPI.userMetricLogs(selectedUser.user_id, {
        ...buildRangeParams(dateRange),
        page: detailPage,
        limit: 10,
        metric: detailMetric,
      });
      const payload = normalizeDetailPayload(response);
      startTransition(() => {
        setDetailRows(Array.isArray(payload?.items) ? payload.items : []);
        setDetailPagination({
          total: Number(payload?.pagination?.total || 0),
          page: Number(payload?.pagination?.page || detailPage),
          pageSize: Number(payload?.pagination?.pageSize || 10),
        });
        setDetailSummary(
          payload?.summary || {
            completed_count: 0,
            shipped_count: 0,
            failed_count: 0,
          },
        );
      });
    } catch (requestError) {
      setDetailError(
        requestError?.response?.data?.error?.message || t("messages.loadDetailError"),
      );
    } finally {
      setDetailLoading(false);
    }
  }, [dateRange, detailMetric, detailPage, selectedUser, t]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!selectedUser) return;
    void loadDetail();
  }, [loadDetail, selectedUser]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.completed += Number(row?.completed_count || 0);
          acc.shipped += Number(row?.shipped_count || 0);
          acc.failed += Number(row?.failed_count || 0);
          return acc;
        },
        { completed: 0, shipped: 0, failed: 0 },
      ),
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.user"),
        dataIndex: "full_name",
        key: "full_name",
        render: (_, record) => (
          <div className="flex flex-col">
            <Typography.Text strong>{record?.full_name || "-"}</Typography.Text>
            <Typography.Text type="secondary">{record?.email || "-"}</Typography.Text>
          </div>
        ),
      },
      {
        title: t("columns.role"),
        dataIndex: "role_code",
        key: "role_code",
        render: (value, record) => roleLabels[value] || record?.role_name || "-",
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        key: "status",
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {tStatus(value || "inactive")}
          </Tag>
        ),
      },
      {
        title: t("columns.completed"),
        dataIndex: "completed_count",
        key: "completed_count",
      },
      {
        title: t("columns.shipped"),
        dataIndex: "shipped_count",
        key: "shipped_count",
      },
      {
        title: t("columns.failed"),
        dataIndex: "failed_count",
        key: "failed_count",
      },
      {
        title: t("columns.actions"),
        key: "actions",
        render: (_, record) => (
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setDetailMetric("all");
              setDetailPage(1);
            }}
          >
            {t("actions.detail")}
          </Button>
        ),
      },
    ],
    [roleLabels, t, tStatus],
  );

  const detailColumns = useMemo(
    () => [
      {
        title: t("detail.columns.date"),
        dataIndex: "occurred_at",
        key: "occurred_at",
        width: 190,
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: t("detail.columns.metric"),
        dataIndex: "metric_key",
        key: "metric_key",
        width: 140,
        render: (value) => (
          <Tag color={METRIC_TAG_COLORS[value] || "default"}>
            {t(`metricLabels.${value}`)}
          </Tag>
        ),
      },
      {
        title: t("detail.columns.title"),
        dataIndex: "title",
        key: "title",
        render: (_, record) => (
          <div className="flex flex-col">
            <Typography.Text strong>{record?.title || "-"}</Typography.Text>
            <Typography.Text type="secondary">{record?.summary || "-"}</Typography.Text>
          </div>
        ),
      },
      {
        title: t("detail.columns.status"),
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (value) => (
          <Tag color={value === "failed" ? "red" : "green"}>
            {t(`detail.status.${value || "success"}`)}
          </Tag>
        ),
      },
      {
        title: t("detail.columns.route"),
        dataIndex: "route",
        key: "route",
        render: (value) => value || "-",
      },
      {
        title: t("detail.columns.error"),
        dataIndex: "error_message",
        key: "error_message",
        render: (value) => value || "-",
      },
    ],
    [t],
  );

  return (
    <RequireRole anyOfRoles={["companyadmin"]}>
      <div className="space-y-4 p-4">
        <Card className="rounded-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t("title")}
              </Typography.Title>
              <Typography.Text type="secondary">{t("subtitle")}</Typography.Text>
            </div>
            <Space wrap>
              <RangePicker
                value={dateRange}
                onChange={(value) => setDateRange(value || DEFAULT_RANGE)}
              />
              <Button icon={<ReloadOutlined />} onClick={() => void loadSummary()}>
                {tActions("refresh")}
              </Button>
            </Space>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl">
            <Statistic title={t("stats.completed")} value={totals.completed} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.shipped")} value={totals.shipped} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.failed")} value={totals.failed} />
          </Card>
        </div>

        <Card className="rounded-2xl">
          {error ? <Alert type="error" showIcon message={error} className="mb-4" /> : null}

          {loading ? null : !rows.length ? (
            <Empty description={t("messages.empty")} />
          ) : null}

          <Table
            rowKey="user_id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            locale={{ emptyText: t("messages.empty") }}
            scroll={{ x: 980 }}
          />
        </Card>

        <Modal
          open={Boolean(selectedUser)}
          title={t("detail.title", { user: selectedUser?.full_name || "-" })}
          onCancel={() => {
            setSelectedUser(null);
            setDetailMetric("all");
            setDetailPage(1);
            setDetailRows([]);
            setDetailError("");
          }}
          footer={null}
          width={1200}
        >
          {selectedUser ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.completed")}
                    value={detailSummary.completed_count}
                  />
                </Card>
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.shipped")}
                    value={detailSummary.shipped_count}
                  />
                </Card>
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.failed")}
                    value={detailSummary.failed_count}
                  />
                </Card>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <Typography.Text strong>{selectedUser.full_name || "-"}</Typography.Text>
                  <div className="text-sm text-slate-500">{selectedUser.email || "-"}</div>
                </div>
                <Space wrap>
                  <Select
                    value={detailMetric}
                    onChange={(value) => {
                      setDetailMetric(value);
                      setDetailPage(1);
                    }}
                    options={[
                      { value: "all", label: t("detail.filters.all") },
                      { value: "completed", label: t("metricLabels.completed") },
                      { value: "shipped", label: t("metricLabels.shipped") },
                      { value: "failed", label: t("metricLabels.failed") },
                    ]}
                    style={{ minWidth: 180 }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()}>
                    {tActions("refresh")}
                  </Button>
                </Space>
              </div>

              {detailError ? <Alert type="error" showIcon message={detailError} /> : null}

              <Table
                rowKey="id"
                columns={detailColumns}
                dataSource={detailRows}
                loading={detailLoading}
                pagination={{
                  current: detailPagination.page,
                  pageSize: detailPagination.pageSize,
                  total: detailPagination.total,
                  showSizeChanger: false,
                  onChange: (page) => setDetailPage(page),
                }}
                locale={{ emptyText: t("detail.messages.empty") }}
                scroll={{ x: 1100 }}
              />
            </div>
          ) : null}
        </Modal>
      </div>
    </RequireRole>
  );
}
