"use client";

import { Children, cloneElement, useCallback, useMemo, useRef, useState } from "react";
import moment from "moment";
import dayjs from "dayjs";
import Link from "next/link";
import {
  App as AntdApp,
  Button,
  DatePicker,
  Image,
  Input,
  Popover,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import CrudTable from "@/components/common/table/CrudTable";
import RequireRole from "@/components/common/Access/RequireRole";
import { TransferOrdersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { useTranslations } from "@/i18n/use-translations";
import { STATUS_COLORS } from "./statusConstants";

const { RangePicker } = DatePicker;

const createDefaultToolbarFilters = () => ({
  order_number: "",
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

const renderTruncatedWithPopover = (value, fallback, maxWidth = 240) => {
  if (!value) return fallback;
  return (
    <Popover
      content={
        <div style={{ maxWidth: 480, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {value}
        </div>
      }
      trigger="hover"
    >
      <span
        style={{
          display: "inline-block",
          maxWidth,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          verticalAlign: "bottom",
        }}
      >
        {value}
      </span>
    </Popover>
  );
};

const extractBarcodeFilename = (url, fallbackName = "barcode.png") => {
  if (!url) return fallbackName;
  try {
    const parsed = new URL(url);
    const lastSegment = (parsed.pathname || "").split("/").filter(Boolean).pop();
    if (!lastSegment) return fallbackName;
    const decoded = decodeURIComponent(lastSegment).trim();
    return decoded || fallbackName;
  } catch {
    return fallbackName;
  }
};

export default function TransferOrdersStatusListPage({
  listApiFn = TransferOrdersAPI.itemsList,
  allowedStatuses = [],
  enableStatusFilter = true,
  columnsBuilder,
  rowActionsRenderer,
  tableRefExternal,
  initialFilters: initialFiltersProp,
  fixedFilters,
  requireRoles = ["companyAdmin", "partnerAdmin", "customerAdmin"],
  toolbarRight,
  showTransferOrderIdCopy = false,
}) {
  const { message } = AntdApp.useApp();
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
      downloaded: t("status.values.downloaded"),
      printed: t("status.values.printed"),
      shipped: t("status.values.shipped"),
      waitingForDesign: t("status.values.waitingForDesign"),
      cancel: t("status.values.cancel"),
      refund: t("status.values.refund"),
      remake: t("status.values.remake"),
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

  const handleBarcodeDownload = useCallback(async (url, orderNumber) => {
    if (!url) return;
    const fallbackName = `${orderNumber || "transfer-order"}-barcode.png`;
    const filename = extractBarcodeFilename(url, fallbackName);
    const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;

    try {
      const response = await fetch(proxyUrl, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error(`Proxy download failed: ${response.status}`);
      const blob = await response.blob();
      saveBlobAsFile(blob, filename);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleCopyTransferOrderId = useCallback(
    async (transferOrderId) => {
      const value = String(transferOrderId || "").trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        message.success("Transfer order id copied.");
      } catch {
        message.error("Transfer order id could not be copied.");
      }
    },
    [message],
  );

  const columns = useMemo(() => {
    const showDetailAction = typeof columnsBuilder !== "function";
    const isPendingList = listApiFn === TransferOrdersAPI.pendingItemsList;
    const showDeliveryMethodColumn = true;
    const showLocalPickupColumn = true;
    const showDesignColumn = isPendingList;
    const showBarcodeColumn = true;
    const baseColumns = [
      ...(showBarcodeColumn
        ? [
            {
              title: t("columns.barcode"),
              dataIndex: "barcode_url",
              width: 88,
              render: (value, record) => {
                if (record?.__isChild) return null;
                if (!value) return t("common.none");
                return (
                  <Image
                    loading="lazy"
                    src={value}
                    alt={`${record?.order_number || "transfer-order"}-barcode`}
                    preview={{
                      mask: <EyeOutlined />,
                      toolbarRender: (originalNode, info) => (
                        cloneElement(originalNode, {}, [
                          ...Children.toArray(originalNode?.props?.children),
                          <div
                            key="barcode-download"
                            className="ant-image-preview-operations-operation"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const src = info?.image?.url || value;
                              void handleBarcodeDownload(src, record?.order_number);
                            }}
                            title={t("actions.download")}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              const src = info?.image?.url || value;
                              void handleBarcodeDownload(src, record?.order_number);
                            }}
                          >
                            <DownloadOutlined />
                          </div>,
                        ])
                      ),
                    }}
                    style={{
                      maxWidth: "45px",
                      maxHeight: "45px",
                      objectFit: "contain",
                    }}
                  />
                );
              },
            },
          ]
        : []),
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
        render: (value, record) => {
          const transferOrderId = record?.transfer_order_id;
          return (
            <Space size={4}>
              {showTransferOrderIdCopy && transferOrderId ? (
                <Tooltip title="Copy transfer order id">
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleCopyTransferOrderId(transferOrderId);
                    }}
                  />
                </Tooltip>
              ) : null}
              <span>{value || t("common.none")}</span>
            </Space>
          );
        },
      },
      {
        title: t("columns.item"),
        dataIndex: "name",
        filter: {
          type: "text",
          placeholder: t("filters.searchItem"),
        },
        render: (value, record) => {
          if (record?.__hasChildren && !record?.__isChild) return null;
          return renderTruncatedWithPopover(value, t("common.none"), 220);
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
      ...(showDeliveryMethodColumn
        ? [
            {
              title: t("columns.deliveryMethod"),
              dataIndex: "delivery_method",
              render: (value, record) => {
                if (record?.__isChild) return null;
                return value || t("common.none");
              },
            },
          ]
        : []),
      ...(showLocalPickupColumn
        ? [
            {
              title: t("columns.localPickup"),
              dataIndex: "local_pickup",
              render: (value, record) => {
                if (record?.__isChild) return null;
                return Boolean(value) ? (
                  <CheckOutlined style={{ color: "#16a34a", fontSize: 16 }} />
                ) : (
                  <CloseOutlined style={{ color: "#dc2626", fontSize: 16 }} />
                );
              },
            },
          ]
        : []),
      ...(showDesignColumn
        ? [
            {
              title: t("columns.hasDesign"),
              dataIndex: "has_design",
              render: (value) => {
                return value ? (
                  <CheckOutlined style={{ color: "#16a34a", fontSize: 16 }} />
                ) : (
                  <CloseOutlined style={{ color: "#dc2626", fontSize: 16 }} />
                );
              },
            },
          ]
        : []),
      {
        title: t("columns.notes"),
        dataIndex: "notes",
        render: (value, record) => {
          if (record?.__isChild) return null;
          return renderTruncatedWithPopover(value, t("common.none"), 260);
        },
      },
      {
        title: t("columns.designerNotes"),
        dataIndex: "designer_notes",
        render: (value, record) => {
          if (record?.__isChild) return null;
          return renderTruncatedWithPopover(value, t("common.none"), 260);
        },
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
              width: rowActionsRenderer ? 220 : 120,
              render: (_, record) => {
                const isParentRow =
                  Boolean(record?.children?.length) && !record?.__isChild;
                const extraActions =
                  typeof rowActionsRenderer === "function"
                    ? rowActionsRenderer({
                        record,
                        isParentRow,
                        reload: () => tableRef.current?.reload?.(),
                      })
                    : null;
                const hasExtraActions = Array.isArray(extraActions)
                  ? extraActions.length > 0
                  : Boolean(extraActions);
                const orderNumber = record?.order_number;
                const canViewDetail = Boolean(orderNumber);
                if (!hasExtraActions && !canViewDetail) return null;
                return (
                  <Space>
                    {canViewDetail ? (
                      <Tooltip title={t("actions.viewDetail")}>
                        <Link href={`/dashboard/transfer-orders/orders/${orderNumber || ""}`}>
                          <Button icon={<FileSearchOutlined />} />
                        </Link>
                      </Tooltip>
                    ) : null}
                    {extraActions}
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
    listApiFn,
    statusLabels,
    statusOptions,
    t,
    handleBarcodeDownload,
    handleCopyTransferOrderId,
    rowActionsRenderer,
    showTransferOrderIdCopy,
    tableRef,
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
