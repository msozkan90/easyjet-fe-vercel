import { normalizeListAndMeta } from "./normalizeListAndMeta";

export const REFUND_REMAKE_TYPE_VALUES = ["refund", "remake"];
export const REFUND_REMAKE_STATUS_VALUES = ["pending", "completed", "canceled"];

const isNil = (value) => value === undefined || value === null;

const asFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toPositiveInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const cleanObject = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (isNil(value)) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );

const normalizeSortField = (field) => {
  const allowed = new Set(["created_at", "updated_at", "status", "request_type"]);
  if (!field || !allowed.has(field)) {
    return "created_at";
  }
  return field;
};

const normalizeSortDirection = (dir) => (dir === "asc" ? "asc" : "desc");

export const buildRefundRemakeListPayload = ({
  page = 1,
  pageSize = 10,
  sort,
  filters,
} = {}) => {
  const orderBy = Array.isArray(sort)
    ? sort
    : [
        {
          field: normalizeSortField(sort?.orderBy),
          dir: normalizeSortDirection(sort?.orderDir),
        },
      ];

  const normalizedOrderBy = orderBy
    .map((item) => ({
      field: normalizeSortField(item?.field || item?.orderBy),
      dir: normalizeSortDirection(item?.dir || item?.orderDir),
    }))
    .filter((item) => item.field);

  return {
    filters: cleanObject({
      order_id: filters?.order_id,
      request_type: filters?.request_type,
      status: filters?.status,
    }),
    pagination: {
      page: toPositiveInteger(page, 1),
      pageSize: toPositiveInteger(pageSize, 10),
      orderBy: normalizedOrderBy.length
        ? normalizedOrderBy
        : [{ field: "created_at", dir: "desc" }],
    },
  };
};

export const normalizeRefundRemakeListResponse = (resp) =>
  normalizeListAndMeta(resp);

export const extractRefundRemakeEntityFromResponse = (resp) => {
  if (!resp) return null;
  if (resp?.data && !Array.isArray(resp.data)) {
    const nested = resp.data?.data;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested;
    }
    return resp.data;
  }
  if (resp?.payload && typeof resp.payload === "object") {
    return resp.payload;
  }
  return resp;
};

const normalizeSingleRequestItem = (rawItem = {}, keyHint) => {
  const key =
    rawItem?.order_item_id ||
    rawItem?.order_item_uuid ||
    rawItem?.id ||
    rawItem?.uuid ||
    keyHint;
  const quantity = toPositiveInteger(rawItem?.quantity, 0);
  const maxQuantity = toPositiveInteger(
    rawItem?.max_quantity || rawItem?.available_quantity || rawItem?.maxQuantity,
    quantity || 1
  );
  const initialPrice = asFiniteNumber(rawItem?.price ?? rawItem?.unit_price);
  const lineTotal = asFiniteNumber(rawItem?.line_total ?? rawItem?.total_price);
  const imageUrl =
    rawItem?.image_url ||
    rawItem?.image?.url ||
    rawItem?.image?.image_url ||
    rawItem?.product?.image_url ||
    rawItem?.product?.images?.[0]?.image_url ||
    rawItem?.product?.images?.[0]?.url ||
    "";
  const options = Array.isArray(rawItem?.options)
    ? rawItem.options
    : Array.isArray(rawItem?.selected_options)
    ? rawItem.selected_options
    : [];
  return {
    key: key ? String(key) : "",
    orderItemId: key ? String(key) : "",
    quantity,
    maxQuantity,
    price: initialPrice,
    lineTotal,
    imageUrl,
    options,
    sku: rawItem?.sku || rawItem?.order_item?.sku || rawItem?.item?.sku || "",
    productName:
      rawItem?.product_name ||
      rawItem?.item_name ||
      rawItem?.product?.name ||
      rawItem?.name ||
      "",
  };
};

export const normalizeRefundRemakeItems = (detail) => {
  const source =
    detail?.order_items ??
    detail?.items ??
    detail?.request_items ??
    detail?.refund_remake_items;

  if (Array.isArray(source)) {
    return source
      .map((item) => normalizeSingleRequestItem(item))
      .filter((item) => item.orderItemId || item.sku || item.productName);
  }

  if (source && typeof source === "object") {
    return Object.entries(source)
      .map(([key, item]) => normalizeSingleRequestItem(item, key))
      .filter((item) => item.orderItemId || item.sku || item.productName);
  }

  return [];
};

export const normalizeRefundRemakeImages = (detail) => {
  const source = detail?.images ?? detail?.image_urls ?? detail?.image_url ?? [];
  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === "string") return { url: item, sortOrder: 0 };
        if (!item || typeof item !== "object") return null;
        const url = item?.image_url || item?.url || item?.src;
        if (!url) return null;
        return {
          url,
          sortOrder: Number.isFinite(Number(item?.sort_order))
            ? Number(item.sort_order)
            : 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => item.url);
  }
  if (typeof source === "string" && source.trim()) {
    return [source];
  }
  if (source && typeof source === "object") {
    const singleUrl = source?.image_url || source?.url || source?.src;
    return singleUrl ? [singleUrl] : [];
  }
  return [];
};

const toCandidateOrderItem = (record = {}) => {
  const id = record?.id || record?.order_item_id || record?.uuid;
  if (!id) return null;
  const maxQuantity = toPositiveInteger(record?.quantity, 0);
  if (!maxQuantity) return null;
  const price = asFiniteNumber(record?.price ?? record?.unit_price);
  const imageUrl =
    record?.image_url ||
    record?.image?.url ||
    record?.image?.image_url ||
    record?.preview_image_url ||
    record?.product?.image_url ||
    record?.product?.images?.[0]?.image_url ||
    record?.product?.images?.[0]?.url ||
    "";
  return {
    orderItemId: String(id),
    sku: record?.sku || "",
    productName: record?.product?.name || record?.name || "",
    imageUrl,
    options: Array.isArray(record?.options) ? record.options : [],
    maxQuantity,
    initialQuantity: 1,
    initialPrice: price,
  };
};

export const collectRequestableOrderItemsFromRow = (row) => {
  const source = [row, ...(Array.isArray(row?.children) ? row.children : [])];
  const unique = new Map();
  source.forEach((item) => {
    const candidate = toCandidateOrderItem(item);
    if (!candidate) return;
    if (unique.has(candidate.orderItemId)) return;
    unique.set(candidate.orderItemId, candidate);
  });
  return Array.from(unique.values());
};
