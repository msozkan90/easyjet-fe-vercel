// src/utils/apiHelpers.js
import http from "./http";
import { multipartConfig, buildFileUploadFormData } from "./formDataHelpers";

export const buildMultipartRequestConfig = (config = {}) => ({
  ...multipartConfig,
  ...config,
  headers: {
    ...multipartConfig.headers,
    ...(config.headers || {}),
  },
});

const isFormDataInstance = (value) =>
  typeof FormData !== "undefined" && value instanceof FormData;

export const ensureFormDataPayload = (value, options) =>
  isFormDataInstance(value) ? value : buildFileUploadFormData(value, options);

export const getFilenameFromDisposition = (disposition = "") => {
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = disposition.match(/filename="?([^\";]+)"?/i);
  return plainMatch?.[1] || "";
};

export const normalizeBlobResponse = (
  response,
  fallbackFilename = "download"
) => {
  const blob =
    response?.data instanceof Blob
      ? response.data
      : new Blob([response?.data || ""]);
  const disposition =
    response?.headers?.["content-disposition"] ||
    response?.headers?.["Content-Disposition"];
  const filename = getFilenameFromDisposition(disposition) || fallbackFilename;
  return { blob, filename, disposition };
};

export const saveBlobAsFile = (blob, filename = "download") => {
  if (typeof window === "undefined" || !blob) return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const fetchBlobFile = async (
  url,
  { params = {}, config = {}, fallbackFilename = "download" } = {}
) => {
  const response = await http.get(url, {
    params,
    responseType: "blob",
    ...config,
  });
  const normalized = normalizeBlobResponse(response, fallbackFilename);
  return { ...normalized, response };
};

export const fetchBlobFilePost = async (
  url,
  { data = {}, config = {}, fallbackFilename = "download" } = {}
) => {
  const response = await http.post(url, data, {
    responseType: "blob",
    ...config,
  });
  const normalized = normalizeBlobResponse(response, fallbackFilename);
  return { ...normalized, response };
};
