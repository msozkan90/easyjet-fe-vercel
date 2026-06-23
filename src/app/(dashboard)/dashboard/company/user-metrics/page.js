"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Tag,
  Typography,
} from "antd";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { AuditLogsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

const { RangePicker } = DatePicker;

const DEFAULT_RANGE = null;

const STATUS_COLORS = {
  active: "green",
  inactive: "red",
  pending: "gold",
  blocked: "default",
};

const METRIC_TAG_COLORS = {
  completed: "green",
  shipped: "blue",
  scrap: "orange",
  remake: "purple",
  refund: "red",
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
const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const sortRows = (rows, sort = {}) => {
  const orderBy = sort?.orderBy;
  const orderDir = sort?.orderDir === "asc" ? "asc" : "desc";
  const direction = orderDir === "asc" ? 1 : -1;
  if (!orderBy) return [...rows];

  return [...rows].sort((left, right) => {
    const compareText = (a, b) => normalizeText(a).localeCompare(normalizeText(b));
    const compareNumber = (a, b) => (Number(a || 0) - Number(b || 0));

    switch (orderBy) {
      case "full_name":
        return direction * compareText(left?.full_name, right?.full_name);
      case "role_code":
        return direction * compareText(left?.role_code || left?.role_name, right?.role_code || right?.role_name);
      case "status":
        return direction * compareText(left?.status, right?.status);
      case "total_count":
      case "completed_count":
      case "shipped_count":
      case "scrap_count":
      case "remake_count":
      case "refund_count":
        return direction * compareNumber(left?.[orderBy], right?.[orderBy]);
      default:
        return 0;
    }
  });
};

const filterSummaryRows = (rows, filters = {}) =>
  rows.filter((row) => {
    if (filters?.full_name) {
      const haystack = normalizeText(`${row?.full_name || ""} ${row?.email || ""}`);
      if (!haystack.includes(normalizeText(filters.full_name))) return false;
    }
    if (filters?.role_code && normalizeText(row?.role_code) !== normalizeText(filters.role_code)) {
      return false;
    }
    if (filters?.status && normalizeText(row?.status) !== normalizeText(filters.status)) {
      return false;
    }
    return true;
  });

const paginateRows = (rows, page = 1, pageSize = 10) => {
  const safePage = Math.max(1, Number(page || 1));
  const safePageSize = Math.max(1, Number(pageSize || 10));
  const start = (safePage - 1) * safePageSize;
  return {
    list: rows.slice(start, start + safePageSize),
    total: rows.length,
  };
};

export default function CompanyUserMetricsPage() {
  const t = useTranslations("dashboard.userMetrics");
  const tStatus = useTranslations("common.status");
  const tActions = useTranslations("common.actions");
  const tRoles = useTranslations("forms.common.roles");
  const summaryTableRef = useRef(null);
  const detailTableRef = useRef(null);

  const [dateRange, setDateRange] = useState(DEFAULT_RANGE);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailMetric, setDetailMetric] = useState("completed");
  const [detailError, setDetailError] = useState("");
  const [detailSummary, setDetailSummary] = useState({
    total_count: 0,
    completed_count: 0,
    shipped_count: 0,
    scrap_count: 0,
    remake_count: 0,
    refund_count: 0,
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

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    summaryTableRef.current?.setPage?.(1);
    summaryTableRef.current?.reload?.();
  }, [rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.total += Number(row?.total_count || 0);
          acc.completed += Number(row?.completed_count || 0);
          acc.shipped += Number(row?.shipped_count || 0);
          acc.scrap += Number(row?.scrap_count || 0);
          acc.remake += Number(row?.remake_count || 0);
          acc.refund += Number(row?.refund_count || 0);
          return acc;
        },
        { total: 0, completed: 0, shipped: 0, scrap: 0, remake: 0, refund: 0 },
      ),
    [rows],
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.user"),
        dataIndex: "full_name",
        key: "full_name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchUser") },
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
        sorter: true,
        filter: {
          type: "select",
          placeholder: t("filters.selectRole"),
          options: Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
          width: 240,
        },
        render: (value, record) => roleLabels[value] || record?.role_name || "-",
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        key: "status",
        sorter: true,
        filter: {
          type: "select",
          placeholder: t("filters.selectStatus"),
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
            { value: "pending", label: tStatus("pending") },
            { value: "blocked", label: tStatus("blocked") },
          ],
          width: 220,
        },
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {tStatus(value || "inactive")}
          </Tag>
        ),
      },
      {
        title: t("columns.total"),
        dataIndex: "total_count",
        key: "total_count",
        sorter: true,
      },
      {
        title: t("columns.completed"),
        dataIndex: "completed_count",
        key: "completed_count",
        sorter: true,
      },
      {
        title: t("columns.shipped"),
        dataIndex: "shipped_count",
        key: "shipped_count",
        sorter: true,
      },
      {
        title: t("columns.scrap"),
        dataIndex: "scrap_count",
        key: "scrap_count",
        sorter: true,
      },
      {
        title: t("columns.remake"),
        dataIndex: "remake_count",
        key: "remake_count",
        sorter: true,
      },
      {
        title: t("columns.refund"),
        dataIndex: "refund_count",
        key: "refund_count",
        sorter: true,
      },
      {
        title: t("columns.actions"),
        key: "actions",
        render: (_, record) => (
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUser(record);
              setDetailMetric("completed");
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
        sorter: true,
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: t("detail.columns.metric"),
        dataIndex: "metric_key",
        key: "metric_key",
        width: 140,
        sorter: true,
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
        sorter: true,
        filter: { type: "text", placeholder: t("detail.filters.searchTitle") },
        render: (_, record) => <Typography.Text strong>{record?.title || "-"}</Typography.Text>,
      },
      {
        title: t("detail.columns.description"),
        dataIndex: "description",
        key: "description",
        sorter: true,
        filter: { type: "text", placeholder: t("detail.filters.searchDescription") },
        render: (value) => (
          <Typography.Text type="secondary">{value || "-"}</Typography.Text>
        ),
      },
      {
        title: t("detail.columns.status"),
        dataIndex: "status",
        key: "status",
        width: 120,
        sorter: true,
        render: () => (
          <Tag color="green">
            {t("detail.status.success")}
          </Tag>
        ),
      },
      {
        title: t("detail.columns.requestType"),
        dataIndex: "request_type",
        key: "request_type",
        width: 130,
        sorter: true,
        filter: {
          type: "select",
          placeholder: t("detail.filters.selectRequestType"),
          options: [
            { value: "create", label: tActions("create") },
            { value: "update", label: tActions("update") },
            { value: "replace", label: tActions("replace") },
            { value: "delete", label: tActions("delete") },
          ],
          width: 220,
        },
        render: (value) => (
          <Tag>{value ? tActions(value) : "-"}</Tag>
        ),
      },
      {
        title: t("detail.columns.route"),
        dataIndex: "route",
        key: "route",
        sorter: true,
        filter: { type: "text", placeholder: t("detail.filters.searchRoute") },
        render: (value) => value || "-",
      },
      {
        title: t("detail.columns.error"),
        dataIndex: "error_message",
        key: "error_message",
        sorter: true,
        render: (value) => value || "-",
      },
    ],
    [t, tActions],
  );

  const summaryRequest = useCallback(
    async ({ page, pageSize, sort, filters }) => {
      const filtered = filterSummaryRows(rows, filters);
      const sorted = sortRows(filtered, sort);
      return paginateRows(sorted, page, pageSize);
    },
    [rows],
  );

  const detailRequest = useCallback(
    async ({ page, pageSize, sort, filters }) => {
      if (!selectedUser?.user_id) {
        return { list: [], total: 0 };
      }

      setDetailError("");
      try {
        const response = await AuditLogsAPI.userMetricLogs(selectedUser.user_id, {
          ...buildRangeParams(dateRange),
          page,
          limit: pageSize,
          metric: detailMetric,
          title: filters?.title || undefined,
          description: filters?.description || undefined,
          request_type: filters?.request_type || undefined,
          route: filters?.route || undefined,
          sort_by: sort?.orderBy || "occurred_at",
          sort_dir: sort?.orderDir || "desc",
        });
        const payload = normalizeDetailPayload(response);
        startTransition(() => {
          setDetailSummary(
            payload?.summary || {
              total_count: 0,
              completed_count: 0,
              shipped_count: 0,
              scrap_count: 0,
              remake_count: 0,
              refund_count: 0,
            },
          );
        });
        return {
          list: Array.isArray(payload?.items) ? payload.items : [],
          total: Number(payload?.pagination?.total || 0),
        };
      } catch (requestError) {
        setDetailError(
          requestError?.response?.data?.error?.message || t("messages.loadDetailError"),
        );
        return { list: [], total: 0 };
      }
    },
    [dateRange, detailMetric, selectedUser, t],
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

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Card className="rounded-2xl">
            <Statistic title={t("stats.total")} value={totals.total} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.completed")} value={totals.completed} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.shipped")} value={totals.shipped} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.scrap")} value={totals.scrap} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.remake")} value={totals.remake} />
          </Card>
          <Card className="rounded-2xl">
            <Statistic title={t("stats.refund")} value={totals.refund} />
          </Card>
        </div>

        <Card className="rounded-2xl">
          {error ? <Alert type="error" showIcon message={error} className="mb-4" /> : null}

          {loading ? null : !rows.length ? (
            <Empty description={t("messages.empty")} />
          ) : null}

          <CrudTable
            ref={summaryTableRef}
            columns={columns}
            request={summaryRequest}
            initialPageSize={10}
            initialFilters={{
              full_name: "",
              role_code: undefined,
              status: undefined,
            }}
            initialSort={{ orderBy: "total_count", orderDir: "desc" }}
            tableProps={{
              locale: { emptyText: t("messages.empty") },
              scroll: { x: 980 },
            }}
          />
        </Card>

        <Modal
          open={Boolean(selectedUser)}
          title={t("detail.title", { user: selectedUser?.full_name || "-" })}
          onCancel={() => {
            setSelectedUser(null);
            setDetailMetric("completed");
            setDetailError("");
            setDetailSummary({
              total_count: 0,
              completed_count: 0,
              shipped_count: 0,
              scrap_count: 0,
              remake_count: 0,
              refund_count: 0,
            });
          }}
          footer={null}
          width={1200}
        >
          {selectedUser ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.total")}
                    value={detailSummary.total_count}
                  />
                </Card>
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
                    title={t("stats.scrap")}
                    value={detailSummary.scrap_count}
                  />
                </Card>
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.remake")}
                    value={detailSummary.remake_count}
                  />
                </Card>
                <Card size="small" className="rounded-2xl">
                  <Statistic
                    title={t("stats.refund")}
                    value={detailSummary.refund_count}
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
                    }}
                    options={[
                      { value: "completed", label: t("metricLabels.completed") },
                      { value: "shipped", label: t("metricLabels.shipped") },
                      { value: "scrap", label: t("metricLabels.scrap") },
                      { value: "remake", label: t("metricLabels.remake") },
                      { value: "refund", label: t("metricLabels.refund") },
                    ]}
                    style={{ minWidth: 180 }}
                  />
                  <Button icon={<ReloadOutlined />} onClick={() => detailTableRef.current?.reload?.()}>
                    {tActions("refresh")}
                  </Button>
                </Space>
              </div>

              {detailError ? <Alert type="error" showIcon message={detailError} /> : null}

              <CrudTable
                ref={detailTableRef}
                key={`${selectedUser.user_id}-${detailMetric}-${buildRangeParams(dateRange).date_from || ""}-${buildRangeParams(dateRange).date_to || ""}`}
                rowKey="id"
                columns={detailColumns}
                request={detailRequest}
                initialPageSize={10}
                initialFilters={{
                  title: "",
                  description: "",
                  request_type: undefined,
                  route: "",
                }}
                initialSort={{ orderBy: "occurred_at", orderDir: "desc" }}
                tableProps={{
                  locale: { emptyText: t("detail.messages.empty") },
                  scroll: { x: 1100 },
                }}
              />
            </div>
          ) : null}
        </Modal>
      </div>
    </RequireRole>
  );
}
