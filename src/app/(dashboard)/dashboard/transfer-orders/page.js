"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Button,
  Space,
  App as AntdApp,
  Select,
  Tooltip,
  Popconfirm,
  Popover,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { OrdersAPI, TransferOrdersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";

const normalizeId = (value) => value ?? null;
const toSelectValue = (value) => (value === null ? undefined : value);
const getRecordFieldValue = (record, field) => {
  if (!record) return null;
  const directKey = `${field}_id`;
  if (record[directKey] !== undefined && record[directKey] !== null) {
    return record[directKey];
  }
  const nested = record[field];
  if (nested?.id !== undefined && nested?.id !== null) {
    return nested.id;
  }
  return null;
};
const getNormalizedRecordValue = (record, field) =>
  normalizeId(getRecordFieldValue(record, field));
const hasOwn = Object.prototype.hasOwnProperty;

export default function OrdersPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [transferProducts, setTransferProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [rowSelections, setRowSelections] = useState({});
  const [cellLoading, setCellLoading] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rowActionLoading, setRowActionLoading] = useState({});

  const t = useTranslations("dashboard.preOrders");

  useEffect(() => {
    if (!cooldownEnd) {
      setRemainingSec(0);
      return;
    }
    const tick = () => {
      const ms = Math.max(0, cooldownEnd - Date.now());
      setRemainingSec(Math.ceil(ms / 1000));
      if (ms <= 0) setCooldownEnd(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEnd]);

  useEffect(() => {
    let active = true;
    const loadTransferProducts = async () => {
      setProductsLoading(true);
      try {
        const list = await fetchGenericList("transfer_product", {
          filters: { status: "active" },
        });
        if (active) {
          setTransferProducts(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        if (active) {
          message.error(
            error?.response?.data?.error?.message ||
              t("messages.loadVariationsError")
          );
        }
      } finally {
        if (active) {
          setProductsLoading(false);
        }
      }
    };
    loadTransferProducts();
    return () => {
      active = false;
    };
  }, [message, t]);

  const productOptions = useMemo(
    () =>
      (transferProducts || [])
        .filter((product) => product?.id)
        .map((product) => ({
          value: product.id,
          label: product.name,
        })),
    [transferProducts]
  );

  const baseRequest = useMemo(
    () =>
      makeListRequest(
        OrdersAPI.transferPreList,
        {
          defaultSort: [{ field: "order_date", direction: "desc" }],
          filterMap: {},
          numericArrayKeys: [""],
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

  const clearSelectionOverrides = useCallback(() => {
    setRowSelections((prev) => {
      if (!prev || !Object.keys(prev).length) return prev;
      return {};
    });
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  }, []);

  const clearSelectionForIds = useCallback((ids) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const lookup = new Set(ids.map((value) => String(value)));
    setSelectedRowKeys((prev) =>
      prev.filter((key) => !lookup.has(String(key)))
    );
    setSelectedRows((prev) =>
      prev.filter((row) => !lookup.has(String(row?.id)))
    );
  }, []);

  const request = useCallback(
    async (params) => {
      const result = await baseRequest(params);
      if (Array.isArray(result?.data)) {
        result.data = [...result.data].sort((a, b) => {
          const aProductId = getNormalizedRecordValue(a, "product");
          const bProductId = getNormalizedRecordValue(b, "product");
          const aMissing = aProductId === null || aProductId === undefined ? 1 : 0;
          const bMissing = bProductId === null || bProductId === undefined ? 1 : 0;
          return bMissing - aMissing;
        });
      }
      clearSelectionOverrides();
      resetSelections();
      return result;
    },
    [baseRequest, clearSelectionOverrides, resetSelections]
  );

  const setRowSelectionFields = useCallback((rowId, updates) => {
    if (!rowId || !updates) return;
    setRowSelections((prev) => {
      const current = prev?.[rowId] || {};
      const next = { ...current };
      let changed = false;

      Object.entries(updates).forEach(([field, value]) => {
        if (value === undefined) {
          if (hasOwn.call(next, field)) {
            delete next[field];
            changed = true;
          }
        } else if (next[field] !== value) {
          next[field] = value;
          changed = true;
        }
      });

      if (!changed) return prev;

      const result = { ...prev };
      if (!Object.keys(next).length) {
        delete result[rowId];
      } else {
        result[rowId] = next;
      }
      return result;
    });
  }, []);

  const setCellLoadingState = useCallback((rowId, field, nextState) => {
    if (!rowId || !field) return;
    const key = `${rowId}-${field}`;
    setCellLoading((prev) => {
      if (!nextState) {
        if (!prev[key]) return prev;
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

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

  const isCellLoading = useCallback(
    (rowId, field) => Boolean(cellLoading?.[`${rowId}-${field}`]),
    [cellLoading]
  );

  const isRowActionLoading = useCallback(
    (rowId, action) => Boolean(rowActionLoading?.[`${rowId}-${action}`]),
    [rowActionLoading]
  );

  const handlePreOrderUpdate = useCallback(
    async (record, payload, fieldKey, onError) => {
      if (!record?.id) return;
      setCellLoadingState(record.id, fieldKey, true);
      try {
        await OrdersAPI.transferPreUpdate(record.id, payload);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.updateError")
        );
        onError?.();
      } finally {
        setCellLoadingState(record.id, fieldKey, false);
      }
    },
    [message, setCellLoadingState, t]
  );

  const handleProductSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      const overrides = rowSelections?.[record.id];
      const nextNormalized = normalizeId(nextValue);
      const prevProduct = hasOwn.call(overrides || {}, "productId")
        ? overrides.productId
        : getNormalizedRecordValue(record, "product");
      if (prevProduct === nextNormalized) return;
      setRowSelectionFields(record.id, {
        productId: nextNormalized,
      });

      handlePreOrderUpdate(
        record,
        {
          transfer_product_id: nextNormalized,
        },
        "product",
        () =>
          setRowSelectionFields(record.id, {
            productId: prevProduct,
          })
      );
    },
    [handlePreOrderUpdate, rowSelections, setRowSelectionFields]
  );

  const onRowSelectionChange = useCallback((keys, rows) => {
    setSelectedRowKeys(keys);
    setSelectedRows(rows);
  }, []);

  const approveOrders = useCallback(
    async (records, options = {}) => {
      if (!Array.isArray(records) || !records.length) return;
      const ids = records.map((item) => item?.id);
      const isBulk = Boolean(options?.bulk);
      if (isBulk) {
        setBulkApproving(true);
      }
      ids.forEach((id) => setRowActionLoadingState(id, "approve", true));
      try {
        const payload = records.map((item) => ({
          order_number: item?.order_number,
          transfer_order_pool_item_id: item?.id,
        }));
        await TransferOrdersAPI.create(payload);
        message.success(t("messages.approveSuccess"));
        if (isBulk) {
          resetSelections();
        } else {
          clearSelectionForIds(ids);
        }
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.approveError")
        );
      } finally {
        ids.forEach((id) => setRowActionLoadingState(id, "approve", false));
        if (isBulk) {
          setBulkApproving(false);
        }
      }
    },
    [
      clearSelectionForIds,
      message,
      resetSelections,
      setRowActionLoadingState,
      t,
    ]
  );

  const handleSingleApprove = useCallback(
    (record) => {
      if (!record) return;
      approveOrders([record], { bulk: false });
    },
    [approveOrders]
  );

  const handleBulkApprove = useCallback(() => {
    if (!selectedRows?.length) return;
    approveOrders(selectedRows, { bulk: true });
  }, [approveOrders, selectedRows]);

  const handleCancelOrder = useCallback(
    async (record) => {
      if (!record?.id) return;
      setRowActionLoadingState(record.id, "cancel", true);
      try {
        await OrdersAPI.transferPreCancel(record.id);
        message.success(t("messages.cancelSuccess"));
        clearSelectionForIds([record.id]);
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.cancelError")
        );
      } finally {
        setRowActionLoadingState(record.id, "cancel", false);
      }
    },
    [clearSelectionForIds, message, setRowActionLoadingState, t]
  );

  const onManualFetch = async () => {
    if (pulling || remainingSec > 0) return;
    try {
      setPulling(true);
      setCooldownEnd(Date.now() + 60_000);
      await OrdersAPI.transferManualFetch({});
      message.success(t("messages.fetchSuccess"));
      tableRef.current?.setPage?.(1);
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.fetchError")
      );
    } finally {
      setPulling(false);
    }
  };

  const formatDateTime = (value) =>
    value ? moment(value).format("LLL") : t("common.none");

  const columns = useMemo(() => {
    return [
      {
        title: t("columns.orderNumber"),
        dataIndex: "order_number",
        sorter: true,
        filter: {
          type: "text",
          placeholder: t("filters.searchOrderNumber"),
        },
      },
      {
        title: t("items.columns.item"),
        dataIndex: "name",
        width: 420,
        filter: {
          type: "text",
          placeholder: t("filters.searchItem"),
        },
        render: (value) => value || t("common.none"),
      },
      {
        title: t("items.columns.quantity"),
        dataIndex: "quantity",
        render: (value) => value ?? t("common.none"),
      },
      {
        title: t("items.columns.options"),
        dataIndex: "options",
        render: (options) => {
          if (!Array.isArray(options) || options.length === 0) {
            return t("items.values.noOptions");
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
        dataIndex: "product",
        render: (_, record) => {
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const loading = productsLoading || isCellLoading(record.id, "product");
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectProduct")}
              options={productOptions}
              value={toSelectValue(normalizedProductId)}
              loading={loading}
              disabled={loading}
              onChange={(value) => handleProductSelect(record, value)}
              style={{ minWidth: 180 }}
            />
          );
        },
      },
      {
        title: t("columns.customerName"),
        dataIndex: "bill_to_name",
        sorter: true,
      },
      {
        title: t("columns.orderByDate"),
        dataIndex: "order_date",
        sorter: true,
        filter: {
          type: "dateRange",
          placeholder: t("filters.orderDateRange"),
        },
        render: formatDateTime,
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 120,
        render: (_, record) => {
          const approveLoading = isRowActionLoading(record.id, "approve");
          const cancelLoading = isRowActionLoading(record.id, "cancel");
          const disableActions =
            bulkApproving || approveLoading || cancelLoading;
          return (
            <Space>
              <Popover content={t("actions.approve")}>
                <Popconfirm
                  title={t("actions.confirmApproveTitle")}
                  okText={t("actions.confirmApproveOk")}
                  okButtonProps={{ loading: approveLoading, type: "primary" }}
                  disabled={disableActions}
                  onConfirm={() => handleSingleApprove(record)}
                >
                  <Button
                    icon={<CheckOutlined />}
                    type="primary"
                    loading={approveLoading}
                    disabled={disableActions}
                  />
                </Popconfirm>
              </Popover>
              <Popover content={t("actions.cancel")}>
                <Popconfirm
                  title={t("actions.confirmCancelTitle")}
                  okText={t("actions.confirmCancelOk")}
                  okButtonProps={{ danger: true, loading: cancelLoading }}
                  disabled={disableActions}
                  onConfirm={() => handleCancelOrder(record)}
                >
                  <Button
                    icon={<CloseOutlined />}
                    danger
                    loading={cancelLoading}
                    disabled={disableActions}
                  />
                </Popconfirm>
              </Popover>
            </Space>
          );
        },
      },
    ];
  }, [
    bulkApproving,
    handleCancelOrder,
    handleProductSelect,
    handleSingleApprove,
    isCellLoading,
    isRowActionLoading,
    productOptions,
    productsLoading,
    rowSelections,
    t,
  ]);

  const fetchButtonLabel = pulling
    ? "Fetching Shopify..."
    : remainingSec > 0
    ? `Fetch Shopify (${remainingSec}s)`
    : "Fetch Shopify";

  const rowSelectionConfig = useMemo(
    () => ({
      selectedRowKeys,
      onChange: onRowSelectionChange,
      preserveSelectedRowKeys: false,
    }),
    [onRowSelectionChange, selectedRowKeys]
  );

  const getRowClassName = useCallback((record) => {
    const overrides = rowSelections?.[record?.id];
    const normalizedProductId = hasOwn.call(overrides || {}, "productId")
      ? overrides.productId
      : getNormalizedRecordValue(record, "product");
    if (normalizedProductId === null || normalizedProductId === undefined) {
      return "missing-price-row";
    }
    return "";
  }, [rowSelections]);

  const tableProps = useMemo(
    () => ({
      rowSelection: rowSelectionConfig,
      rowClassName: getRowClassName,
    }),
    [getRowClassName, rowSelectionConfig]
  );

  return (
    <RequireRole
      anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
      anyOfCategories={["Transfers"]}
    >
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          order_number: "",
          customer_name: "",
          order_status: undefined,
          order_date: undefined,
        }}
        toolbarRight={
          <Space>
            <Popconfirm
              title={t("actions.confirmApproveSelectedTitle")}
              okText={t("actions.confirmApproveOk")}
              okButtonProps={{ loading: bulkApproving, type: "primary" }}
              onConfirm={handleBulkApprove}
              disabled={!selectedRowKeys.length || bulkApproving}
            >
              <Button
                icon={<CheckOutlined />}
                type="primary"
                disabled={!selectedRowKeys.length || bulkApproving}
                loading={bulkApproving}
              >
                {t("actions.approveSelected")}
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              loading={pulling}
              disabled={pulling || remainingSec > 0}
              onClick={onManualFetch}
            >
              {fetchButtonLabel}
            </Button>
          </Space>
        }
        tableProps={tableProps}
      />
    </RequireRole>
  );
}
