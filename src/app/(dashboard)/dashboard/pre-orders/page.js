"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { useSelector } from "react-redux";
import {
  Button,
  Space,
  App as AntdApp,
  Select,
  Tag,
  Tooltip,
  Popconfirm,
  Popover,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import SelectionFloatActions from "@/components/common/actions/SelectionFloatActions";
import CrudTable from "@/components/common/table/CrudTable";
import ShipStationStoreStatusCard from "@/components/common/shipstation/ShipStationStoreStatusCard";
import { GuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import { OrdersAPI, ProductVariationAPI, ShipStationAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { getFirstInvalidOrderNumber } from "@/utils/orderNumberValidation";
import { useTranslations } from "@/i18n/use-translations";
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  UndoOutlined,
} from "@ant-design/icons";

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

export default function OrdersPage({ mode = "pending" }) {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const variantUpdateLocksRef = useRef(new Set());
  const [pulling, setPulling] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [productVariations, setProductVariations] = useState([]);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [rowSelections, setRowSelections] = useState({});
  const [cellLoading, setCellLoading] = useState({});
  const [selectedRowMap, setSelectedRowMap] = useState({});
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [rowActionLoading, setRowActionLoading] = useState({});
  const user = useSelector((state) => state.auth.user);
  const isCancelledView = mode === "cancelled";

  const t = useTranslations("dashboard.preOrders");
  const tCommonActions = useTranslations("common.actions");
  const storeId = user?.entity?.store_id;
  const customerName =
    user?.entity?.entity_name || user?.displayName || user?.email || "";

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
    if (isCancelledView) {
      setProductVariations([]);
      setVariationsLoading(false);
      return;
    }

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
              t("messages.loadVariationsError"),
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
  }, [isCancelledView, message, t]);

  const productOptions = useMemo(
    () =>
      (productVariations || [])
        .filter((product) => product?.id)
        .map((product) => ({
          value: product.id,
          label: product.name,
        })),
    [productVariations],
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
    [productMap],
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
    [productMap],
  );

  const baseRequest = useMemo(
    () =>
      makeListRequest(
        OrdersAPI.preList,
        {
          defaultSort: [
            {
              field: isCancelledView ? "deactivated_at" : "order_date",
              direction: isCancelledView ? "desc" : "asc",
            },
          ],
          filterMap: {},
          numericArrayKeys: [""],
          filterTransform: (filters = {}) => {
            const next = { ...filters };
            next.item_state = isCancelledView ? "cancelled" : "pending";
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
    [isCancelledView],
  );

  const reconcileSelectionOverrides = useCallback((records = []) => {
    const recordMap = new Map(
      (Array.isArray(records) ? records : [])
        .filter((record) => record?.id)
        .map((record) => [String(record.id), record]),
    );
    setRowSelections((prev) => {
      if (!prev || !Object.keys(prev).length) return prev;
      const next = { ...prev };
      let changed = false;

      Object.entries(prev).forEach(([rowId, overrides]) => {
        const record = recordMap.get(String(rowId));
        if (!record || !overrides) return;
        const remaining = { ...overrides };
        const fields = [
          ["productId", "product"],
          ["sizeId", "size"],
          ["colorId", "color"],
        ];
        fields.forEach(([key, field]) => {
          if (
            hasOwn.call(remaining, key) &&
            remaining[key] === getNormalizedRecordValue(record, field)
          ) {
            delete remaining[key];
            changed = true;
          }
        });
        if (Object.keys(remaining).length) {
          next[rowId] = remaining;
        } else {
          delete next[rowId];
        }
      });

      return changed ? next : prev;
    });
  }, []);

  const selectedRowKeys = useMemo(
    () => Object.keys(selectedRowMap),
    [selectedRowMap],
  );

  const selectedRows = useMemo(
    () => Object.values(selectedRowMap),
    [selectedRowMap],
  );

  const resetSelections = useCallback(() => {
    setSelectedRowMap({});
  }, []);

  const clearSelectionForIds = useCallback((ids) => {
    if (!Array.isArray(ids) || !ids.length) return;
    const lookup = new Set(ids.map((value) => String(value)));
    setSelectedRowMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (lookup.has(String(key))) {
          delete next[key];
        }
      });
      return next;
    });
  }, []);

  const request = useCallback(
    async (params) => {
      const result = await baseRequest(params);
      reconcileSelectionOverrides(result?.list);
      return result;
    },
    [baseRequest, reconcileSelectionOverrides],
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
    [rowSelections],
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
          normalize(entry?.color_id) === targetColor,
      );
      if (!match) return undefined;
      const value = match?.price;
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      return value;
    },
    [productMap],
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

  const isVariantUpdateLoading = useCallback(
    (rowId) =>
      ["product", "size", "color"].some((field) =>
        Boolean(cellLoading?.[`${rowId}-${field}`]),
      ),
    [cellLoading],
  );

  const isRowActionLoading = useCallback(
    (rowId, action) => Boolean(rowActionLoading?.[`${rowId}-${action}`]),
    [rowActionLoading],
  );

  const handlePreOrderUpdate = useCallback(
    async (record, payload, fieldKey, onError) => {
      if (!record?.id) return;
      const isVariantUpdate = ["product", "size", "color"].includes(fieldKey);
      if (isVariantUpdate && variantUpdateLocksRef.current.has(record.id)) {
        return;
      }
      if (isVariantUpdate) {
        variantUpdateLocksRef.current.add(record.id);
      }
      setCellLoadingState(record.id, fieldKey, true);
      try {
        await OrdersAPI.preUpdate(record.id, payload);
        message.success(t("messages.updateSuccess"));
        try {
          await tableRef.current?.reload?.();
        } catch {
          // The variant update is already saved; keep the optimistic values
          // until a later table refresh can reconcile them.
        }
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.updateError"),
        );
        onError?.();
      } finally {
        if (isVariantUpdate) {
          variantUpdateLocksRef.current.delete(record.id);
        }
        setCellLoadingState(record.id, fieldKey, false);
      }
    },
    [message, setCellLoadingState, t],
  );

  const handleProductSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      if (variantUpdateLocksRef.current.has(record.id)) return;
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
          }),
      );
    },
    [handlePreOrderUpdate, rowSelections, setRowSelectionFields],
  );

  const handleSizeSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      if (variantUpdateLocksRef.current.has(record.id)) return;
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
        snapshot.colorId,
      );
      const payload = {
        product_id: snapshot.productId,
        size_id: nextNormalized,
        color_id: snapshot.colorId,
      };
      if (resolvedPrice !== undefined) {
        payload.price = resolvedPrice;
      }

      handlePreOrderUpdate(record, payload, "size", () =>
        setRowSelectionFields(record.id, {
          sizeId: prevSize,
        }),
      );
    },
    [
      findProductPrice,
      getSelectionSnapshot,
      handlePreOrderUpdate,
      rowSelections,
      setRowSelectionFields,
    ],
  );

  const handleColorSelect = useCallback(
    (record, nextValue) => {
      if (!record?.id) return;
      if (variantUpdateLocksRef.current.has(record.id)) return;
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
        snapshot.colorId,
      );
      const payload = {
        product_id: snapshot.productId,
        size_id: snapshot.sizeId,
        color_id: nextNormalized,
      };
      if (resolvedPrice !== undefined) {
        payload.price = resolvedPrice;
      }

      handlePreOrderUpdate(record, payload, "color", () =>
        setRowSelectionFields(record.id, {
          colorId: prevColor,
        }),
      );
    },
    [
      findProductPrice,
      getSelectionSnapshot,
      handlePreOrderUpdate,
      rowSelections,
      setRowSelectionFields,
    ],
  );

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
        if (getFirstInvalidOrderNumber(records) !== null) {
          message.error(t("messages.orderNumberWhitespaceError"));
          return;
        }
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
          error?.response?.data?.error?.message || t("messages.approveError"),
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
    ],
  );

  const handleSingleApprove = useCallback(
    (record) => {
      if (!record) return;
      approveOrders([record], { bulk: false });
    },
    [approveOrders],
  );

  const handleBulkApprove = useCallback(() => {
    if (!selectedRows?.length) return;
    approveOrders(selectedRows, { bulk: true });
  }, [approveOrders, selectedRows]);

  const cancelOrders = useCallback(
    async (records, options = {}) => {
      if (!Array.isArray(records) || !records.length) return;
      const ids = records.map((item) => item?.id).filter(Boolean);
      const isBulk = Boolean(options?.bulk);
      if (isBulk) {
        setBulkCancelling(true);
      }
      ids.forEach((id) => setRowActionLoadingState(id, "cancel", true));
      try {
        await Promise.all(ids.map((id) => OrdersAPI.preCancel(id)));
        message.success(t("messages.cancelSuccess"));
        if (isBulk) {
          resetSelections();
        } else {
          clearSelectionForIds(ids);
        }
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.cancelError"),
        );
      } finally {
        ids.forEach((id) => setRowActionLoadingState(id, "cancel", false));
        if (isBulk) {
          setBulkCancelling(false);
        }
      }
    },
    [
      clearSelectionForIds,
      message,
      resetSelections,
      setRowActionLoadingState,
      t,
    ],
  );

  const handleCancelOrder = useCallback(
    (record) => {
      if (!record) return;
      cancelOrders([record], { bulk: false });
    },
    [cancelOrders],
  );

  const handleBulkCancel = useCallback(() => {
    if (!selectedRows?.length) return;
    cancelOrders(selectedRows, { bulk: true });
  }, [cancelOrders, selectedRows]);

  const restoreOrder = useCallback(
    async (record) => {
      if (!record?.id) return;
      setRowActionLoadingState(record.id, "restore", true);
      try {
        await OrdersAPI.preRestore(record.id);
        message.success(t("messages.restoreSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.restoreError"),
        );
      } finally {
        setRowActionLoadingState(record.id, "restore", false);
      }
    },
    [message, setRowActionLoadingState, t],
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
        error?.response?.data?.error?.message || t("messages.fetchError"),
      );
    } finally {
      setPulling(false);
    }
  };

  const formatDateTime = useCallback(
    (value) => (value ? moment(value).format("LLL") : t("common.none")),
    [t],
  );

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
            <GuardedPreviewImage
              loading="lazy"
              src={value}
              alt="Item"
              openLabel={tCommonActions("open")}
              emptyText={t("common.none")}
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
      {
        title: t("items.columns.quantity"),
        dataIndex: "quantity",
        render: (value) => value ?? t("common.none"),
      },
      {
        title: t("items.columns.name"),
        dataIndex: "name",
        width: 220,
        render: (value) => {
          const name = typeof value === "string" ? value.trim() : "";
          if (!name) return t("common.none");

          return (
            <Popover content={name} trigger="hover">
              <span
                style={{
                  display: "block",
                  maxWidth: 200,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  cursor: "default",
                }}
              >
                {name}
              </span>
            </Popover>
          );
        },
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
          if (isCancelledView) {
            return record?.product?.name || t("common.none");
          }
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const selectValue = toSelectValue(normalizedProductId);
          const loading =
            variationsLoading || isVariantUpdateLoading(record.id);
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
          if (isCancelledView) {
            return record?.size?.name || t("common.none");
          }
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const normalizedSizeId = hasOwn.call(overrides || {}, "sizeId")
            ? overrides.sizeId
            : getNormalizedRecordValue(record, "size");
          const variantLoading = isVariantUpdateLoading(record.id);
          const disabled =
            normalizedProductId === null || variationsLoading || variantLoading;
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectSize")}
              options={getSizeOptions(normalizedProductId)}
              value={toSelectValue(normalizedSizeId)}
              disabled={disabled}
              loading={variationsLoading || variantLoading}
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
          if (isCancelledView) {
            return record?.color?.name || t("common.none");
          }
          const overrides = rowSelections?.[record.id];
          const normalizedProductId = hasOwn.call(overrides || {}, "productId")
            ? overrides.productId
            : getNormalizedRecordValue(record, "product");
          const normalizedColorId = hasOwn.call(overrides || {}, "colorId")
            ? overrides.colorId
            : getNormalizedRecordValue(record, "color");
          const variantLoading = isVariantUpdateLoading(record.id);
          const disabled =
            normalizedProductId === null || variationsLoading || variantLoading;
          return (
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("filters.selectColor")}
              options={getColorOptions(normalizedProductId)}
              value={toSelectValue(normalizedColorId)}
              disabled={disabled}
              loading={variationsLoading || variantLoading}
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
        title: t("columns.cancelledAt"),
        dataIndex: "deactivated_at",
        key: "deactivated_at",
        sorter: true,
        render: formatDateTime,
      },
      {
        title: t("columns.cancelledBy"),
        dataIndex: "deactivated_by",
        key: "deactivated_by",
        render: (userInfo) => {
          if (!userInfo) return t("common.none");
          const fullName = [userInfo.first_name, userInfo.last_name]
            .filter(Boolean)
            .join(" ")
            .trim();
          return fullName || userInfo.email || t("common.none");
        },
      },
      {
        title: t("columns.poolStatus"),
        key: "pool_status",
        width: 220,
        render: (_, record) => {
          const pendingCount = Number(record?.pool_pending_item_count || 0);
          const linkedOrders = Array.isArray(record?.linked_orders)
            ? record.linked_orders
            : [];
          return (
            <Space size={[4, 4]} wrap>
              <Tag color={pendingCount > 0 ? "orange" : "green"}>
                {pendingCount > 0
                  ? t("badges.pendingItems", { count: pendingCount })
                  : t("badges.complete")}
              </Tag>
              {pendingCount > 0 && linkedOrders.length > 0 ? (
                <Tag color="volcano">{t("badges.progressBlocked")}</Tag>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: t("columns.linkedOrders"),
        key: "linked_orders",
        width: 240,
        render: (_, record) => {
          const linkedOrders = Array.isArray(record?.linked_orders)
            ? record.linked_orders
            : [];
          if (!linkedOrders.length) return t("common.none");
          return (
            <Space size={[4, 4]} wrap>
              {linkedOrders.map((order) => (
                <Button
                  key={order.id}
                  size="small"
                  type="link"
                  href={
                    order?.order_number
                      ? `/dashboard/order/detail/${encodeURIComponent(order.order_number)}`
                      : undefined
                  }
                >
                  {order.order_number || order.id}
                </Button>
              ))}
            </Space>
          );
        },
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 120,
        render: (_, record) => {
          if (isCancelledView) {
            const restoreLoading = isRowActionLoading(record.id, "restore");
            return (
              <Popover content={t("actions.restore")}>
                <Popconfirm
                  title={t("actions.confirmRestoreTitle")}
                  okText={t("actions.confirmRestoreOk")}
                  okButtonProps={{ loading: restoreLoading, type: "primary" }}
                  disabled={restoreLoading}
                  onConfirm={() => restoreOrder(record)}
                >
                  <Button
                    icon={<UndoOutlined />}
                    type="primary"
                    loading={restoreLoading}
                    disabled={restoreLoading}
                  />
                </Popconfirm>
              </Popover>
            );
          }
          const approveLoading = isRowActionLoading(record.id, "approve");
          const cancelLoading = isRowActionLoading(record.id, "cancel");
          const disableActions =
            bulkApproving || bulkCancelling || approveLoading || cancelLoading;
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
                  cancelText={t("actions.confirmCancelDismiss")}
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
    ].filter((column) => {
      const columnKey = column.key || column.dataIndex;
      if (isCancelledView) {
        return !["pool_status", "linked_orders"].includes(columnKey);
      }
      return !["deactivated_at", "deactivated_by"].includes(columnKey);
    });
  }, [
    bulkApproving,
    bulkCancelling,
    getColorOptions,
    getSizeOptions,
    handleColorSelect,
    handleCancelOrder,
    handleProductSelect,
    handleSingleApprove,
    handleSizeSelect,
    isVariantUpdateLoading,
    isRowActionLoading,
    productOptions,
    restoreOrder,
    rowSelections,
    t,
    tCommonActions,
    formatDateTime,
    variationsLoading,
    isCancelledView,
  ]);

  const fetchButtonLabel = pulling
    ? t("actions.fetching")
    : remainingSec > 0
      ? t("actions.fetchCountdown", { seconds: remainingSec })
      : t("actions.fetch");

  const rowSelectionConfig = useMemo(
    () => ({
      selectedRowKeys,
      preserveSelectedRowKeys: true,
      onSelect: (record, selected) => {
        setSelectedRowMap((prev) => {
          const next = { ...prev };
          if (selected) {
            next[record.id] = record;
          } else {
            delete next[record.id];
          }
          return next;
        });
      },
      onSelectAll: (selected, _selectedRows, changeRows) => {
        setSelectedRowMap((prev) => {
          const next = { ...prev };
          (changeRows || []).forEach((row) => {
            if (!row?.id) return;
            if (selected) {
              next[row.id] = row;
            } else {
              delete next[row.id];
            }
          });
          return next;
        });
      },
    }),
    [selectedRowKeys],
  );

  const getRowClassName = useCallback(
    (record) => {
      if (isCancelledView) return "";
      const price = record?.price;
      if (price === null || price === undefined || price === "") {
        return "missing-price-row";
      }
      return "";
    },
    [isCancelledView],
  );

  const tableProps = useMemo(
    () =>
      isCancelledView
        ? {}
        : {
            rowSelection: rowSelectionConfig,
            rowClassName: getRowClassName,
          },
    [getRowClassName, isCancelledView, rowSelectionConfig],
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
        toolbarLeft={
          !isCancelledView && storeId ? (
            <ShipStationStoreStatusCard
              storeId={storeId}
              customerName={customerName}
              t={t}
            />
          ) : null
        }
        toolbarRight={
          !isCancelledView ? (
            <Space>
              <Button
                type="primary"
                loading={pulling}
                disabled={pulling || remainingSec > 0}
                onClick={onManualFetch}
              >
                {fetchButtonLabel}
              </Button>
            </Space>
          ) : null
        }
        tableProps={tableProps}
      />
      {!isCancelledView && selectedRowKeys.length ? (
        <SelectionFloatActions
          count={selectedRowKeys.length}
          selectedLabel={t("actions.selectedCount", {
            count: selectedRowKeys.length,
          })}
          approveTooltip={t("actions.approveSelected")}
          cancelTooltip={t("actions.cancelSelected")}
          confirmApproveTitle={t("actions.confirmApproveSelectedTitle")}
          confirmApproveOk={t("actions.confirmApproveOk")}
          confirmCancelTitle={t("actions.confirmCancelSelectedTitle")}
          confirmCancelOk={t("actions.confirmCancelOk")}
          confirmCancelDismiss={t("actions.confirmCancelDismiss")}
          approving={bulkApproving}
          cancelling={bulkCancelling}
          onApprove={handleBulkApprove}
          onCancel={handleBulkCancel}
        />
      ) : null}
    </RequireRole>
  );
}
