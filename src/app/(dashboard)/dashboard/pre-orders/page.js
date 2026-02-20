"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Button,
  Space,
  App as AntdApp,
  Image,
  Select,
  Tooltip,
  Popconfirm,
  Popover,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { OrdersAPI, ProductVariationAPI, ShipStationAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import { EyeOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";

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
  const [productVariations, setProductVariations] = useState([]);
  const [variationsLoading, setVariationsLoading] = useState(false);
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
    const loadProductVariations = async () => {
      setVariationsLoading(true);
      try {
        const response = await ProductVariationAPI.list();
        if (active) {
          setProductVariations(response?.data || []);
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
          setVariationsLoading(false);
        }
      }
    };
    loadProductVariations();
    return () => {
      active = false;
    };
  }, [message, t]);

  const productOptions = useMemo(
    () =>
      (productVariations || [])
        .filter((product) => product?.id)
        .map((product) => ({
          value: product.id,
          label: product.name,
        })),
    [productVariations]
  );

  const productMap = useMemo(() => {
    const map = new Map();
    (productVariations || []).forEach((product) => {
      if (product?.id === undefined || product?.id === null) return;
      const key = String(product.id);
      map.set(product.id, product);
      map.set(key, product);
    });
    return map;
  }, [productVariations]);

  const getSizeOptions = useCallback(
    (productId) => {
      if (!productId) return [];
      const product = productMap.get(productId);
      return (product?.sizes || [])
        .filter((size) => size?.id)
        .map((size) => ({
          value: size.id,
          label: size.name,
        }));
    },
    [productMap]
  );

  const getColorOptions = useCallback(
    (productId) => {
      if (!productId) return [];
      const product = productMap.get(productId);
      return (product?.colors || [])
        .filter((color) => color?.id)
        .map((color) => ({
          value: color.id,
          label: color.name,
        }));
    },
    [productMap]
  );

  const baseRequest = useMemo(
    () =>
      makeListRequest(
        OrdersAPI.preList,
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

  const getSelectionSnapshot = useCallback(
    (record, overrides = {}) => {
      if (!record?.id) {
        return {
          productId: null,
          sizeId: null,
          colorId: null,
        };
      }
      const currentOverrides = rowSelections?.[record.id] || {};
      const merged = { ...currentOverrides, ...overrides };
      const readValue = (key, field) =>
        hasOwn.call(merged, key)
          ? merged[key]
          : getNormalizedRecordValue(record, field);
      return {
        productId: readValue("productId", "product"),
        sizeId: readValue("sizeId", "size"),
        colorId: readValue("colorId", "color"),
      };
    },
    [rowSelections]
  );

  const findProductPrice = useCallback(
    (productId, sizeId, colorId) => {
      if (
        productId === null ||
        productId === undefined ||
        sizeId === null ||
        sizeId === undefined ||
        colorId === null ||
        colorId === undefined
      ) {
        return undefined;
      }
      const product =
        productMap.get(productId) || productMap.get(String(productId));
      if (!product) return undefined;
      const normalize = (value) =>
        value === undefined || value === null ? null : String(value);
      const targetSize = normalize(sizeId);
      const targetColor = normalize(colorId);
      const match = (product?.prices || []).find(
        (entry) =>
          normalize(entry?.size_id) === targetSize &&
          normalize(entry?.color_id) === targetColor
      );
      if (!match) return undefined;
      const value = match?.price;
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    },
    [productMap]
  );

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
        await OrdersAPI.preUpdate(record.id, payload);
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

      const prevSize = hasOwn.call(overrides || {}, "sizeId")
        ? overrides.sizeId
        : getNormalizedRecordValue(record, "size");
      const prevColor = hasOwn.call(overrides || {}, "colorId")
        ? overrides.colorId
        : getNormalizedRecordValue(record, "color");

      setRowSelectionFields(record.id, {
        productId: nextNormalized,
        sizeId: null,
        colorId: null,
      });

      handlePreOrderUpdate(
        record,
        {
          product_id: nextNormalized,
          size_id: null,
          color_id: null,
        },
        "product",
        () =>
          setRowSelectionFields(record.id, {
            productId: prevProduct,
            sizeId: prevSize,
            colorId: prevColor,
          })
      );
    },
    [handlePreOrderUpdate, rowSelections, setRowSelectionFields]
  );

  const handleSizeSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      const overrides = rowSelections?.[record.id];
      const nextNormalized = normalizeId(nextValue);
      const prevSize = hasOwn.call(overrides || {}, "sizeId")
        ? overrides.sizeId
        : getNormalizedRecordValue(record, "size");
      if (prevSize === nextNormalized) return;

      setRowSelectionFields(record.id, { sizeId: nextNormalized });

      const snapshot = getSelectionSnapshot(record, {
        sizeId: nextNormalized,
      });
      const resolvedPrice = findProductPrice(
        snapshot.productId,
        snapshot.sizeId,
        snapshot.colorId
      );
      const payload = {  product_id: snapshot.productId, size_id: nextNormalized, color_id: snapshot.colorId };
      if (resolvedPrice !== undefined) {
        payload.price = resolvedPrice;
      }

      handlePreOrderUpdate(record, payload, "size", () =>
        setRowSelectionFields(record.id, {
          sizeId: prevSize
        })
      );
    },
    [
      findProductPrice,
      getSelectionSnapshot,
      handlePreOrderUpdate,
      rowSelections,
      setRowSelectionFields,
    ]
  );

  const handleColorSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      const overrides = rowSelections?.[record.id];
      const nextNormalized = normalizeId(nextValue);
      const prevColor = hasOwn.call(overrides || {}, "colorId")
        ? overrides.colorId
        : getNormalizedRecordValue(record, "color");
      if (prevColor === nextNormalized) return;

      setRowSelectionFields(record.id, { colorId: nextNormalized });

      const snapshot = getSelectionSnapshot(record, {
        colorId: nextNormalized,
      });
      const resolvedPrice = findProductPrice(
        snapshot.productId,
        snapshot.sizeId,
        snapshot.colorId
      );
      const payload = {  product_id: snapshot.productId, size_id: snapshot.sizeId, color_id: nextNormalized};
      if (resolvedPrice !== undefined) {
        payload.price = resolvedPrice;
      }

      handlePreOrderUpdate(record, payload, "color", () =>
        setRowSelectionFields(record.id, {
          colorId: prevColor,
        })
      );
    },
    [
      findProductPrice,
      getSelectionSnapshot,
      handlePreOrderUpdate,
      rowSelections,
      setRowSelectionFields,
    ]
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
          order_pool_item_id: item?.id,
        }));
        await OrdersAPI.create(payload);
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
        await OrdersAPI.preCancel(record.id);
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
      await ShipStationAPI.manualOrderGet({});
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

  const formatAmount = (value) => {
    if (value === null || value === undefined || value === "") {
      return t("common.none");
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

  const columns = useMemo(() => {
    return [
      {
        title: t("items.columns.image_url"),
        dataIndex: "image_url",
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
        sorter: true,
        filter: {
          type: "text",
          placeholder: t("filters.searchOrderNumber"),
        },
      },
      {
        title: t("items.columns.sku"),
        dataIndex: "sku",
        filter: {
          type: "text",
          placeholder: t("filters.searchSku"),
        },
        render: (value) => value || t("common.none"),
      },
      // {
      //   title: t("items.columns.item"),
      //   dataIndex: "name",
      //   width: 500,
      //   filter: {
      //     type: "text",
      //     placeholder: t("filters.searchItem"),
      //   },
      //   render: (value) => value || t("common.none"),
      // },
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
          const selectValue = toSelectValue(normalizedProductId);
          const loading =
            variationsLoading || isCellLoading(record.id, "product");
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectProduct")}
              options={productOptions}
              value={selectValue}
              loading={loading}
              disabled={loading}
              onChange={(value) => handleProductSelect(record, value)}
              style={{ minWidth: 120 }}
            />
          );
        },
      },
      {
        title: t("columns.size"),
        dataIndex: "size",
        render: (_, record) => {
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const normalizedSizeId = hasOwn.call(overrides || {}, "sizeId")
            ? overrides.sizeId
            : getNormalizedRecordValue(record, "size");
          const productLoading = isCellLoading(record.id, "product");
          const sizeLoading = isCellLoading(record.id, "size");
          const disabled =
            normalizedProductId === null ||
            variationsLoading ||
            productLoading ||
            sizeLoading;
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectSize")}
              options={getSizeOptions(normalizedProductId)}
              value={toSelectValue(normalizedSizeId)}
              disabled={disabled}
              loading={variationsLoading || sizeLoading}
              onChange={(value) => handleSizeSelect(record, value)}
              style={{ minWidth: 120 }}
            />
          );
        },
      },
      {
        title: t("columns.color"),
        dataIndex: "color",
        render: (_, record) => {
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const normalizedColorId = hasOwn.call(overrides || {}, "colorId")
            ? overrides.colorId
            : getNormalizedRecordValue(record, "color");
          const productLoading = isCellLoading(record.id, "product");
          const colorLoading = isCellLoading(record.id, "color");
          const disabled =
            normalizedProductId === null ||
            variationsLoading ||
            productLoading ||
            colorLoading;
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectColor")}
              options={getColorOptions(normalizedProductId)}
              value={toSelectValue(normalizedColorId)}
              disabled={disabled}
              loading={variationsLoading || colorLoading}
              onChange={(value) => handleColorSelect(record, value)}
              style={{ minWidth: 120 }}
            />
          );
        },
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
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
    getColorOptions,
    getSizeOptions,
    handleColorSelect,
    handleCancelOrder,
    handleProductSelect,
    handleSingleApprove,
    handleSizeSelect,
    isCellLoading,
    isRowActionLoading,
    productOptions,
    rowSelections,
    t,
    variationsLoading,
  ]);

  const fetchButtonLabel = pulling
    ? t("actions.fetching")
    : remainingSec > 0
    ? t("actions.fetchCountdown", { seconds: remainingSec })
    : t("actions.fetch");

  const rowSelectionConfig = useMemo(
    () => ({
      selectedRowKeys,
      onChange: onRowSelectionChange,
      preserveSelectedRowKeys: false,
    }),
    [onRowSelectionChange, selectedRowKeys]
  );

  const getRowClassName = useCallback((record) => {
    const price = record?.price;
    if (price === null || price === undefined || price === "") {
      return "missing-price-row";
    }
    return "";
  }, []);

  const tableProps = useMemo(
    () => ({
      rowSelection: rowSelectionConfig,
      rowClassName: getRowClassName,
    }),
    [getRowClassName, rowSelectionConfig]
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
