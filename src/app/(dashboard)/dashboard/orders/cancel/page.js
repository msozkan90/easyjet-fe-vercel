"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  DatePicker,
  Image,
  Input,
  Popconfirm,
  Popover,
  Space,
  Tag,
  Tooltip,
} from "antd";
import CrudTable from "@/components/common/table/CrudTable";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductVariationAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import {
  CloseCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { STATUS_COLORS } from "../statusConstants";

const { RangePicker } = DatePicker;

const createDefaultToolbarFilters = () => ({
  order_number: "",
  sku: "",
  order_date: undefined,
});

const formatAmount = (value, fallback) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function CancelOrdersPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const tCommonActions = useTranslations("common.actions");
  const tableRef = useRef(null);
  const [productVariations, setProductVariations] = useState([]);
  const [rowActionLoading, setRowActionLoading] = useState({});
  const [quickFilters, setQuickFilters] = useState(createDefaultToolbarFilters);

  useEffect(() => {
    let active = true;
    const loadVariations = async () => {
      try {
        const resp = await ProductVariationAPI.list();
        if (!active) return;
        setProductVariations(resp?.data || []);
      } catch (error) {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.loadVariationsError")
        );
      }
    };
    loadVariations();
    return () => {
      active = false;
    };
  }, [message, t]);

  const productOptions = useMemo(() => {
    const map = new Map();
    (productVariations || []).forEach((product) => {
      if (!product?.id || map.has(product.id)) return;
      map.set(product.id, {
        value: product.id,
        label: product.name,
      });
    });
    return Array.from(map.values());
  }, [productVariations]);

  const sizeOptions = useMemo(() => {
    const map = new Map();
    (productVariations || []).forEach((product) => {
      (product?.sizes || []).forEach((size) => {
        if (!size?.id || map.has(size.id)) return;
        map.set(size.id, {
          value: size.id,
          label: size.name,
        });
      });
    });
    return Array.from(map.values());
  }, [productVariations]);

  const colorOptions = useMemo(() => {
    const map = new Map();
    (productVariations || []).forEach((product) => {
      (product?.colors || []).forEach((color) => {
        if (!color?.id || map.has(color.id)) return;
        map.set(color.id, {
          value: color.id,
          label: color.name,
        });
      });
    });
    return Array.from(map.values());
  }, [productVariations]);

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
    [t]
  );

  const baseRequest = useMemo(
    () =>
      makeListRequest(
        OrdersAPI.cancelItemsList,
        {
          defaultSort: [{ field: "order_date", direction: "desc" }],
          filterTransform: (filters = {}) => {
            const next = { ...filters };
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
        normalizeListAndMeta
      ),
    []
  );

  const annotateRows = useCallback(function markRows(
    items = [],
    parent = null
  ) {
    return (items || []).map((item) => {
      const hasChildren =
        Array.isArray(item?.children) && item.children.length > 0;
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
  },
  []);

  const request = useCallback(
    async (params) => {
      const result = await baseRequest(params);
      return {
        ...result,
        list: annotateRows(result?.list || []),
      };
    },
    [annotateRows, baseRequest]
  );

  const formatDateTime = (value) =>
    value ? moment(value).format("LLL") : t("common.none");

  const applyFilterPatch = useCallback(
    (patch) => {
      tableRef.current?.setFilters?.(patch);
      tableRef.current?.setPage?.(1);
    },
    [tableRef]
  );

  const handleOrderNumberChange = useCallback((event) => {
    const value = event?.target?.value ?? "";
    setQuickFilters((prev) => ({ ...prev, order_number: value }));
  }, []);

  const handleSkuChange = useCallback((event) => {
    const value = event?.target?.value ?? "";
    setQuickFilters((prev) => ({ ...prev, sku: value }));
  }, []);

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
        dateEqual
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  const handleToolbarSearch = useCallback(() => {
    const payload = {
      order_number: quickFilters.order_number || "",
      sku: quickFilters.sku || "",
      order_date: quickFilters.order_date
        ? { ...quickFilters.order_date }
        : undefined,
    };
    applyFilterPatch(payload);
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

  const setRowActionLoadingState = useCallback((rowId, action, nextState) => {
    if (!rowId || !action) return;
    const key = `${rowId}-${action}`;
    setRowActionLoading((prev) => {
      if (!nextState) {
        if (!prev?.[key]) return prev;
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      if (prev?.[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

  const isRowActionLoading = useCallback(
    (rowId, action) => Boolean(rowActionLoading?.[`${rowId}-${action}`]),
    [rowActionLoading]
  );

  const handleStatusUpdate = useCallback(
    async (record, status) => {
      if (!record?.id || !status) return;
      const actionKey = status === "cancel" ? "cancel" : status;
      setRowActionLoadingState(record.id, actionKey, true);
      try {
        await OrdersAPI.update({
          items: [
            {
              id: record.id,
              status,
            },
          ],
        });
        message.success(t("messages.statusUpdateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.statusUpdateError")
        );
      } finally {
        setRowActionLoadingState(record.id, actionKey, false);
      }
    },
    [message, setRowActionLoadingState, t]
  );

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t("columns.image"),
        dataIndex: "image_url",
        width: 80,
        render: (value) =>
          value ? (
            <Image
              loading="lazy"
              src={value}
              alt="Item"
              preview={{ mask: <EyeOutlined /> }}
              style={{
                maxWidth: "45px",
                maxHeight: "45px",
                objectFit: "contain",
              }}
            />
          ) : (
            t("common.none")
          ),
      },
      {
        title: t("columns.orderNumber"),
        dataIndex: "order_number",
        filter: {
          type: "text",
          placeholder: t("filters.searchOrderNumber"),
        },
        render: (_, record) => {
          const value = record?.order?.order_number || t("common.none");
          if (record?.__hasChildren || record?.__isChild) {
            return <span className="orders-cell-strong">{value}</span>;
          }
          return value;
        },
      },
      {
        title: t("columns.sku"),
        dataIndex: "sku",
        filter: {
          type: "text",
          placeholder: t("filters.searchSku"),
        },
        render: (value, record) => {
          const display = value || t("common.none");
          if (record?.__hasChildren || record?.__isChild) {
            return <span className="orders-cell-strong">{display}</span>;
          }
          return display;
        },
      },
      // {
      //   title: t("columns.item"),
      //   dataIndex: "name",
      //   width: 320,
      //   filter: {
      //     type: "text",
      //     placeholder: t("filters.searchItem"),
      //   },
      //   render: (value) => value || t("common.none"),
      // },
      {
        title: t("columns.quantity"),
        dataIndex: "quantity",
        sorter: true,
        render: (value) => value ?? t("common.none"),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        render: (value) => {
          if (!value) return t("common.none");
          const label = statusLabels[value] || value;
          const color = STATUS_COLORS[value] || "default";
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        title: t("columns.options"),
        dataIndex: "options",
        render: (options) => {
          if (!Array.isArray(options) || options.length === 0) {
            return t("values.noOptions");
          }
          return (
            <Space direction="vertical" size={0}>
              {options.map((option, index) => {
                const name = option?.name ?? t("common.none");
                const value = option?.value ?? t("common.none");
                const key = `${name}-${value}-${index}`;
                const displayText = `${name}: ${value}`;
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
                      {value}
                    </span>
                  </Tooltip>
                );
              })}
            </Space>
          );
        },
      },
      {
        title: t("columns.product"),
        dataIndex: "product_id",
        filter: {
          type: "select",
          placeholder: t("filters.selectProduct"),
          options: productOptions,
          width: 240,
        },
        render: (_, record) => record?.product?.name || t("common.none"),
      },
      {
        title: t("columns.size"),
        dataIndex: "size_id",
        filter: {
          type: "select",
          placeholder: t("filters.selectSize"),
          options: sizeOptions,
          width: 240,
        },
        render: (_, record) => record?.size?.name || t("common.none"),
      },
      {
        title: t("columns.color"),
        dataIndex: "color_id",
        filter: {
          type: "select",
          placeholder: t("filters.selectColor"),
          options: colorOptions,
          width: 240,
        },
        render: (_, record) => record?.color?.name || t("common.none"),
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
        render: (value) => formatAmount(value, t("common.none")),
      },
      {
        title: t("columns.customerName"),
        dataIndex: "bill_to_name",
        render: (_, record) => record?.order?.bill_to_name || t("common.none"),
      },
      {
        title: t("columns.orderDate"),
        dataIndex: "order_date",
        sorter: true,
        filter: {
          type: "dateRange",
          placeholder: t("filters.orderDateRange"),
        },
        render: (_, record) => formatDateTime(record?.order?.order_date),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 160,
        render: (_, record) => {
          const rowId = record?.id;
          const newOrderLoading = isRowActionLoading(rowId, "newOrder");
          const disabled = !rowId || newOrderLoading;
          const orderNumber =
            record?.order?.order_number || record?.order_number;
          const canViewDetail = !record?.__isChild && Boolean(orderNumber);
          const detailHref = canViewDetail
            ? `/dashboard/order/detail/${orderNumber}`
            : "";
          return (
            <Space>
              <Popover content={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  type="default"
                  disabled={!canViewDetail}
                  href={detailHref}
                />
              </Popover>
              <Popover content={t("actions.newOrder")}>
                <Popconfirm
                  title={t("actions.confirmNewOrderTitle")}
                  okText={t("actions.confirmNewOrderOk")}
                  okButtonProps={{
                    type: "primary",
                    loading: newOrderLoading,
                  }}
                  disabled={disabled}
                  onConfirm={() => handleStatusUpdate(record, "newOrder")}
                >
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    loading={newOrderLoading}
                    disabled={disabled}
                  />
                </Popconfirm>
              </Popover>
            </Space>
          );
        },
      },
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
      ...baseColumns,
    ];
  }, [
    colorOptions,
    productOptions,
    sizeOptions,
    statusLabels,
    handleStatusUpdate,
    isRowActionLoading,
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
    [getRowClassName, t]
  );

  return (
    <RequireRole anyOfRoles={["companyAdmin", "customerAdmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          order_number: "",
          sku: "",
          name: "",
          product_id: undefined,
          size_id: undefined,
          color_id: undefined,
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
        onFiltersChange={handleFiltersSync}
        tableProps={tableProps}
      />
    </RequireRole>
  );
}
