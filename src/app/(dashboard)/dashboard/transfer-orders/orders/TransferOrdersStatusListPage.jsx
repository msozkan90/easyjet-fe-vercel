"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import moment from "moment";
import dayjs from "dayjs";
import Link from "next/link";
import {
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import {
  CloseCircleOutlined,
  FileSearchOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import CrudTable from "@/components/common/table/CrudTable";
import RequireRole from "@/components/common/Access/RequireRole";
import { TransferOrdersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import { STATUS_COLORS } from "./statusConstants";

const { RangePicker } = DatePicker;

const createDefaultToolbarFilters = () => ({
  order_number: "",
  sku: "",
  status: [],
  order_date: undefined,
});

const formatAmount = (value, fallback) => {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return value;
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function TransferOrdersStatusListPage({
  listApiFn = TransferOrdersAPI.itemsList,
  allowedStatuses = [],
  enableStatusFilter = true,
  columnsBuilder,
  tableRefExternal,
  initialFilters: initialFiltersProp,
  fixedFilters,
  requireRoles = ["companyAdmin", "partnerAdmin", "customerAdmin"],
  toolbarRight,
  showOptionsInsteadOfSku = false,
}) {
  const t = useTranslations("dashboard.orders");
  const tCommonActions = useTranslations("common.actions");
  const internalTableRef = useRef(null);
  const tableRef = tableRefExternal || internalTableRef;
  const [quickFilters, setQuickFilters] = useState(() =>
    initialFiltersProp
      ? { ...createDefaultToolbarFilters(), ...initialFiltersProp }
      : createDefaultToolbarFilters(),
  );

  const statusLabels = useMemo(
    () => ({
      newOrder: t("status.values.newOrder"),
      processing: t("status.values.processing"),
      pdf: t("status.values.pdf"),
      completed: t("status.values.completed"),
      shipped: t("status.values.shipped"),
      waitingForDesign: t("status.values.waitingForDesign"),
      cancel: t("status.values.cancel"),
    }),
    [t],
  );

  const statusOptions = useMemo(() => {
    const source =
      Array.isArray(allowedStatuses) && allowedStatuses.length > 0
        ? allowedStatuses
        : Object.keys(statusLabels);
    return source.map((value) => ({
      value,
      label: statusLabels[value] || value,
    }));
  }, [allowedStatuses, statusLabels]);

  const baseRequest = useMemo(
    () =>
      makeListRequest(
        listApiFn,
        {
          defaultSort: [{ field: "order_date", direction: "desc" }],
          fixedFilters: fixedFilters || {},
          filterTransform: (filters = {}) => {
            const next = { ...filters };
            if (allowedStatuses?.length) {
              const arr = Array.isArray(next.status)
                ? next.status
                : next.status
                  ? [next.status]
                  : [];
              const filtered = arr.filter((status) =>
                allowedStatuses.includes(status),
              );
              next.status = filtered.length ? filtered : undefined;
            }
            const orderDate = next.order_date;
            if (orderDate?.gte || orderDate?.lte) {
              next.date_from = orderDate?.gte;
              next.date_to = orderDate?.lte;
            } else {
              delete next.date_from;
              delete next.date_to;
            }
            return next;
          },
        },
        normalizeListAndMeta,
      ),
    [allowedStatuses, fixedFilters, listApiFn],
  );

  const annotateRows = useCallback(function markRows(items = [], parent = null) {
    return (items || []).map((item) => {
      const hasChildren = Array.isArray(item?.children) && item.children.length > 0;
      const next = {
        ...item,
        __hasChildren: hasChildren,
        __isChild: Boolean(parent),
      };
      if (hasChildren) {
        next.children = markRows(item.children, next);
      }
      return next;
    });
  }, []);

  const request = useCallback(
    async (params) => {
      const result = await baseRequest(params);
      return {
        ...result,
        list: annotateRows(result?.list || []),
      };
    },
    [annotateRows, baseRequest],
  );

  const applyFilterPatch = useCallback(
    (patch) => {
      tableRef.current?.setFilters?.(patch);
      tableRef.current?.setPage?.(1);
    },
    [tableRef],
  );

  const handleOrderNumberChange = useCallback((event) => {
    const value = event?.target?.value ?? "";
    setQuickFilters((prev) => ({ ...prev, order_number: value }));
  }, []);

  const handleSkuChange = useCallback((event) => {
    const value = event?.target?.value ?? "";
    setQuickFilters((prev) => ({ ...prev, sku: value }));
  }, []);

  const handleStatusChange = useCallback(
    (value) => {
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      const filtered = allowedStatuses?.length
        ? arr.filter((status) => allowedStatuses.includes(status))
        : arr;
      setQuickFilters((prev) => ({ ...prev, status: filtered }));
    },
    [allowedStatuses],
  );

  const handleOrderDateChange = useCallback((range) => {
    let nextValue;
    if (range && range[0] && range[1]) {
      nextValue = {
        gte: range[0].startOf("day").toISOString(),
        lte: range[1].endOf("day").toISOString(),
      };
    }
    setQuickFilters((prev) => ({ ...prev, order_date: nextValue }));
  }, []);

  const handleFiltersSync = useCallback((nextFilters = {}) => {
    setQuickFilters((prev) => {
      const normalizedDate =
        nextFilters?.order_date &&
        nextFilters.order_date.gte &&
        nextFilters.order_date.lte
          ? {
              gte: nextFilters.order_date.gte,
              lte: nextFilters.order_date.lte,
            }
          : undefined;

      const nextState = {
        order_number: nextFilters?.order_number ?? "",
        sku: nextFilters?.sku ?? "",
        status:
          Array.isArray(nextFilters?.status) && nextFilters.status.length
            ? [...nextFilters.status]
            : [],
        order_date: normalizedDate,
      };

      const dateEqual =
        (!prev.order_date && !nextState.order_date) ||
        (prev.order_date &&
          nextState.order_date &&
          prev.order_date.gte === nextState.order_date.gte &&
          prev.order_date.lte === nextState.order_date.lte);
      if (
        prev.order_number === nextState.order_number &&
        prev.sku === nextState.sku &&
        dateEqual &&
        prev.status.length === nextState.status.length &&
        prev.status.every((v, idx) => v === nextState.status[idx])
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  const handleToolbarSearch = useCallback(() => {
    applyFilterPatch({
      order_number: quickFilters.order_number || "",
      sku: quickFilters.sku || "",
      status:
        Array.isArray(quickFilters.status) && quickFilters.status.length
          ? [...quickFilters.status]
          : undefined,
      order_date: quickFilters.order_date
        ? { ...quickFilters.order_date }
        : undefined,
    });
  }, [applyFilterPatch, quickFilters]);

  const handleToolbarReset = useCallback(() => {
    const resetState = createDefaultToolbarFilters();
    setQuickFilters(resetState);
    applyFilterPatch(resetState);
  }, [applyFilterPatch]);

  const orderDateRangeValue = useMemo(() => {
    if (quickFilters.order_date?.gte && quickFilters.order_date?.lte) {
      return [
        dayjs(quickFilters.order_date.gte),
        dayjs(quickFilters.order_date.lte),
      ];
    }
    return null;
  }, [quickFilters.order_date]);

  const columns = useMemo(() => {
    const showDetailAction = typeof columnsBuilder !== "function";
    const baseColumns = [
      {
        title: null,
        dataIndex: "id",
        width: 5,
        render: (_, record) => {
          if (record?.children?.length) {
            return (
              <span className="orders-cell-strong">
                ({record.children.length})
              </span>
            );
          }
          return null;
        },
      },
      {
        title: t("columns.orderNumber"),
        dataIndex: "order_number",
        filter: {
          type: "text",
          placeholder: t("filters.searchOrderNumber"),
        },
      },
      {
        title: showOptionsInsteadOfSku ? t("columns.options") : t("columns.sku"),
        dataIndex: "sku",
        filter: {
          type: "text",
          placeholder: showOptionsInsteadOfSku ? t("filters.searchItem") : t("filters.searchSku"),
        },
        render: (value, record) => {
          if (record?.__hasChildren && !record?.__isChild) return null;
          if (!showOptionsInsteadOfSku) {
            return value || t("common.none");
          }
          const options = record?.options;
          if (!Array.isArray(options) || options.length === 0) {
            return t("values.noOptions");
          }
          return (
            <Space direction="vertical" size={0}>
              {options.map((option, index) => {
                const name = option?.name ?? t("common.none");
                const optionValue = option?.value ?? t("common.none");
                const key = `${name}-${optionValue}-${index}`;
                const displayText = `${name}: ${optionValue}`;
                return (
                  <Tooltip title={displayText} key={key}>
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: 240,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span style={{ fontWeight: "bold" }}>{name}: </span>
                      {optionValue}
                    </span>
                  </Tooltip>
                );
              })}
            </Space>
          );
        },
      },
      {
        title: "Name",
        dataIndex: "name",
        filter: {
          type: "text",
          placeholder: "Search name",
        },
        render: (value, record) => {
          if (record?.__hasChildren && !record?.__isChild) return null;
          return value || t("common.none");
        },
      },
      {
        title: t("columns.product"),
        dataIndex: "product",
        render: (_, record) => {
          if (record?.__hasChildren && !record?.__isChild) return null;
          return record?.product?.name || t("common.none");
        },
      },
      {
        title: "Item Count",
        dataIndex: "item_count",
        render: (_, record) => {
          if (record?.__hasChildren && !record?.__isChild) {
            return record?.item_count ?? record?.children?.length ?? t("common.none");
          }
          return null;
        },
      },
      {
        title: t("columns.quantity"),
        dataIndex: "quantity",
        sorter: true,
        render: (_, record) => {
          if (record?.__hasChildren && !record?.__isChild) return null;
          return record?.quantity ?? t("common.none");
        },
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        filter:
          enableStatusFilter && statusOptions.length
            ? {
                type: "multi",
                placeholder: t("filters.selectStatus"),
                options: statusOptions,
                width: 220,
              }
            : undefined,
        render: (value) => {
          if (!value) return t("common.none");
          const label = statusLabels[value] || value;
          const color = STATUS_COLORS[value] || "default";
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
        render: (value, record) => {
          if (record?.__isChild) return null;
          return formatAmount(value, t("common.none"));
        },
      },
      {
        title: t("columns.customerName"),
        dataIndex: "bill_to_name",
        render: (value) => value || t("common.none"),
      },
      {
        title: t("columns.orderDate"),
        dataIndex: "order_date",
        sorter: true,
        filter: {
          type: "dateRange",
          placeholder: t("filters.orderDateRange"),
        },
        render: (value) => (value ? moment(value).format("LLL") : t("common.none")),
      },
      ...(showDetailAction
        ? [
            {
              title: t("columns.actions"),
              key: "actions",
              width: 120,
              render: (_, record) => {
                return (
                  <Space>
                    <Tooltip title={t("actions.viewDetail")}>
                      <Link href={`/dashboard/transfer-orders/orders/${record?.order_number || ""}`}>
                        <Button icon={<FileSearchOutlined />} />
                      </Link>
                    </Tooltip>
                  </Space>
                );
              },
            },
          ]
        : []),
    ];

    return [
      {
        title: "",
        dataIndex: "__expander",
        key: "__expander",
        width: 36,
        className: "orders-expand-column",
        render: () => null,
      },
      ...(typeof columnsBuilder === "function"
        ? columnsBuilder(baseColumns)
        : baseColumns),
    ];
  }, [
    columnsBuilder,
    enableStatusFilter,
    showOptionsInsteadOfSku,
    statusLabels,
    statusOptions,
    t,
  ]);

  const getRowClassName = useCallback((record, _index, indent = 0) => {
    const baseClasses = [];
    if (record?.__hasChildren || record?.__isChild) {
      baseClasses.push("orders-nested-row");
    }
    if (record?.__hasChildren) {
      baseClasses.push("orders-parent-row");
    } else if (record?.__isChild || indent > 0) {
      baseClasses.push("orders-child-row");
    }
    return baseClasses.join(" ");
  }, []);

  const tableProps = useMemo(
    () => ({
      locale: { emptyText: t("table.noData") },
      expandable: {
        expandIconColumnIndex: 0,
        columnWidth: 36,
      },
      rowClassName: getRowClassName,
    }),
    [getRowClassName, t],
  );

  return (
    <RequireRole anyOfRoles={requireRoles}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          order_number: "",
          sku: "",
          name: "",
          status: Array.isArray(initialFiltersProp?.status)
            ? initialFiltersProp.status
            : [],
          order_date: undefined,
        }}
        toolbarLeft={
          <Space wrap size="middle">
            <Input
              allowClear
              placeholder={t("filters.searchOrderNumber")}
              value={quickFilters.order_number}
              onChange={handleOrderNumberChange}
              style={{ minWidth: 180 }}
            />
            <Input
              allowClear
              placeholder={t("filters.searchSku")}
              value={quickFilters.sku}
              onChange={handleSkuChange}
              style={{ minWidth: 160 }}
            />
            {enableStatusFilter && statusOptions.length ? (
              <Select
                mode="multiple"
                allowClear
                placeholder={t("filters.selectStatus")}
                options={statusOptions}
                value={quickFilters.status}
                onChange={handleStatusChange}
                style={{ minWidth: 220 }}
                maxTagCount="responsive"
                optionFilterProp="label"
              />
            ) : null}
            <RangePicker
              allowClear
              value={orderDateRangeValue}
              onChange={handleOrderDateChange}
              placeholder={[
                t("filters.orderDateRange"),
                t("filters.orderDateRange"),
              ]}
              style={{ minWidth: 260 }}
            />
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleToolbarSearch}
              >
                {tCommonActions("search")}
              </Button>
              <Button
                type="primary"
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleToolbarReset}
              >
                {tCommonActions("reset")}
              </Button>
            </Space>
          </Space>
        }
        toolbarRight={toolbarRight}
        onFiltersChange={handleFiltersSync}
        tableProps={tableProps}
      />
    </RequireRole>
  );
}
