import { GenericListAPI } from "./api";
import { normalizeListAndMeta } from "./normalizeListAndMeta";

const extractList = (response) => {
  const tryNormalize = normalizeListAndMeta(response);
  if (Array.isArray(tryNormalize.list) && tryNormalize.list.length) {
    return tryNormalize.list;
  }

  const root = response?.data ?? response;
  if (Array.isArray(root)) {
    return root;
  }
  if (!root || typeof root !== "object") {
    return [];
  }

  const candidates = [
    root.list,
    root.items,
    root.results,
    root.data,
    root.payload,
    root.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
    if (
      candidate &&
      typeof candidate === "object" &&
      Array.isArray(candidate?.data) &&
      candidate.data.length
    ) {
      return candidate.data;
    }
  }

  return [];
};

const mergeOptions = (tableName, options) => {
  if (typeof tableName === "string") {
    return {
      table_name: tableName,
      ...(options || {}),
    };
  }
  return {
    ...(tableName || {}),
    ...(options || {}),
  };
};

export const fetchGenericList = async (tableName, options = {}) => {
  const payload = mergeOptions(tableName, options);
  if (!payload.table_name) {
    throw new Error("fetchGenericList requires a table_name");
  }

  const response = await GenericListAPI.list(payload);
  const list = extractList(response);
  return Array.isArray(list) ? list.filter((item) => item != null) : [];
};
