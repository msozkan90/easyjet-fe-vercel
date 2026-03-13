"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Input, Select, Space, Tag, Tooltip } from "antd";
import { FileSearchOutlined, SearchOutlined, CloseCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import CrudTable from "@/components/common/table/CrudTable";
import RequireRole from "@/components/common/Access/RequireRole";
import { useTranslations } from "@/i18n/use-translations";
import { RefundRemakeRequestsAPI } from "@/utils/api";
import {
  buildRefundRemakeListPayload,
  normalizeRefundRemakeListResponse,
} from "@/utils/refundRemakeRequests";

const createDefaultFilters = () => ({
  order_id: "",
  request_type: undefined,
  status: undefined,
});

const cleanFilters = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    })
  );

const STATUS_COLORS = {
  pending: "gold",
  completed: "green",
  canceled: "red",
};

export default function RefundRemakeRequestsListPage({
  requireRoles = ["customerAdmin"],
  fixedFilters = {},
  basePath = "/dashboard/orders/refund-remake",
  hideStatusFilter = false,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const tCommon = useTranslations("common.actions");
  const tableRef = useRef(null);
  const [quickFilters, setQuickFilters] = useState({
    ...createDefaultFilters(),
    ...fixedFilters,
  });

  const request = useCallback(
    async ({ page, pageSize, sort, filters }) => {
      try {
        const mergedFilters = { ...(filters || {}), ...(fixedFilters || {}) };
        const payload = buildRefundRemakeListPayload({
          page,
          pageSize,
          sort,
          filters: mergedFilters,
        });
        const response = await RefundRemakeRequestsAPI.list(payload);
        return normalizeRefundRemakeListResponse(response);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.listLoadError")
        );
        return { list: [], total: 0 };
      }
    },
    [fixedFilters, message, t]
  );

  const requestTypeOptions = useMemo(
    () => [
      { value: "refund", label: t("requestType.refund") },
      { value: "remake", label: t("requestType.remake") },
    ],
    [t]
  );

  const statusOptions = useMemo(
    () => [
      { value: "pending", label: t("status.pending") },
      { value: "completed", label: t("status.completed") },
      { value: "canceled", label: t("status.canceled") },
    ],
    [t]
  );

  const handleSearch = useCallback(() => {
    const nextFilters = cleanFilters({ ...quickFilters, ...fixedFilters });
    tableRef.current?.setFilters?.({
      order_id: nextFilters.order_id || "",
      request_type: nextFilters.request_type,
      status: nextFilters.status,
    });
    tableRef.current?.setPage?.(1);
  }, [fixedFilters, quickFilters]);

  const handleReset = useCallback(() => {
    const next = { ...createDefaultFilters(), ...fixedFilters };
    setQuickFilters(next);
    tableRef.current?.setFilters?.({
      order_id: next.order_id || "",
      request_type: next.request_type,
      status: next.status,
    });
    tableRef.current?.setPage?.(1);
  }, [fixedFilters]);

  const handleFiltersSync = useCallback((filters = {}) => {
    setQuickFilters((prev) => {
      const next = {
        order_id: filters?.order_id ?? fixedFilters?.order_id ?? "",
        request_type: filters?.request_type ?? fixedFilters?.request_type,
        status: filters?.status ?? fixedFilters?.status,
      };
      if (
        prev.order_id === next.order_id &&
        prev.request_type === next.request_type &&
        prev.status === next.status
      ) {
        return prev;
      }
      return next;
    });
  }, [fixedFilters]);

  const columns = useMemo(
    () => [
      {
        title: t("columns.requestType"),
        dataIndex: "request_type",
        sorter: true,
        render: (value) =>
          value === "remake" ? t("requestType.remake") : t("requestType.refund"),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        sorter: true,
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {t(`status.${value || "pending"}`)}
          </Tag>
        ),
      },
      {
        title: t("columns.order"),
        dataIndex: "order_id",
        render: (_, record) => record?.order?.order_number || record?.order_id || "-",
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        sorter: true,
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: t("columns.updatedAt"),
        dataIndex: "updated_at",
        sorter: true,
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 100,
        fixed: "right",
        render: (_, record) => {
          const id = record?.id;
          if (!id) return "-";
          return (
            <Tooltip title={t("actions.viewDetail")}>
              <Button icon={<FileSearchOutlined />} href={`${basePath}/${id}`} />
            </Tooltip>
          );
        },
      },
    ],
    [basePath, t]
  );

  return (
    <RequireRole anyOfRoles={requireRoles}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialSort={{ orderBy: "created_at", orderDir: "desc" }}
        initialFilters={{ ...createDefaultFilters(), ...fixedFilters }}
        onFiltersChange={handleFiltersSync}
        toolbarLeft={
          <Space wrap>
            <Input
              allowClear
              placeholder={t("filters.orderId")}
              value={quickFilters.order_id}
              style={{ minWidth: 220 }}
              onChange={(event) =>
                setQuickFilters((prev) => ({
                  ...prev,
                  order_id: event?.target?.value || "",
                }))
              }
            />
            <Select
              allowClear
              placeholder={t("filters.requestType")}
              options={requestTypeOptions}
              value={quickFilters.request_type}
              style={{ minWidth: 180 }}
              onChange={(value) =>
                setQuickFilters((prev) => ({ ...prev, request_type: value }))
              }
            />
            {!hideStatusFilter ? (
              <Select
                allowClear
                placeholder={t("filters.status")}
                options={statusOptions}
                value={quickFilters.status}
                style={{ minWidth: 180 }}
                onChange={(value) =>
                  setQuickFilters((prev) => ({ ...prev, status: value }))
                }
              />
            ) : null}
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                {tCommon("search")}
              </Button>
              <Button danger icon={<CloseCircleOutlined />} onClick={handleReset}>
                {tCommon("reset")}
              </Button>
            </Space>
          </Space>
        }
      />
    </RequireRole>
  );
}
