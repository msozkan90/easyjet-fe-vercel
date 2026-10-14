// Helpers shared by the order and transfer order report pages.
import dayjs from "dayjs";

export const ALL_ENTITIES_VALUE = "__all_entities__";

export const createDefaultRange = () => [dayjs().subtract(29, "day"), dayjs()];

export const extractPayload = (response) => response?.data ?? response ?? {};

export const normalizeCategoryList = (response) => {
  const payload = extractPayload(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const formatCount = (value) => Number(value || 0).toLocaleString();

export const isTransferCategory = (category) => {
  const name = String(category?.name || "")
    .trim()
    .toLowerCase();
  return name === "transfer" || name === "transfers";
};

export const getTextValue = (value) => String(value || "").toLowerCase();
