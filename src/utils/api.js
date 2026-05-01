// src/utils/api.js
import http from "./http";
import {
  buildMultipartRequestConfig,
  ensureFormDataPayload,
  fetchBlobFile,
  fetchBlobFilePost,
} from "./apiHelpers";

export const api = {
  get: (url, params = {}, config = {}) =>
    http.get(url, { params, ...config }).then((r) => r.data),
  getBlob: (url, params = {}, config = {}) =>
    http.get(url, { params, responseType: "blob", ...config }).then((r) => r),
  post: (url, data = {}, config = {}) =>
    http.post(url, data, config).then((r) => r.data),
  put: (url, data = {}, config = {}) =>
    http.put(url, data, config).then((r) => r.data),
  postMultipart: (url, data = {}, config = {}) =>
    http
      .post(url, data, buildMultipartRequestConfig(config))
      .then((r) => r.data),
  putMultipart: (url, data = {}, config = {}) =>
    http
      .put(url, data, buildMultipartRequestConfig(config))
      .then((r) => r.data),
  del: (url, params = {}, config = {}) =>
    http.delete(url, { params, ...config }).then((r) => r.data),
};

const sanitizeFilters = (filters) => {
  if (!filters || typeof filters !== "object") return undefined;
  const entries = Object.entries(filters).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );
  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
};

const buildExportPayload = (params = {}) => {
  const payload = { ...(params || {}) };
  const normalizedFilters = sanitizeFilters(payload.filters);
  if (normalizedFilters) {
    payload.filters = normalizedFilters;
  } else {
    delete payload.filters;
  }
  return payload;
};

export const GenericListAPI = {
  list: (params, maybeFilters) => {
    const payload =
      typeof params === "string"
        ? {
            table_name: params,
            filters: sanitizeFilters(maybeFilters),
          }
        : {
            ...(params || {}),
            table_name: params?.table_name,
          };

    if (!payload?.table_name) {
      throw new Error("GenericListAPI.list requires a table_name");
    }

    const normalizedFilters = sanitizeFilters(payload.filters);
    if (normalizedFilters) {
      payload.filters = normalizedFilters;
    } else {
      delete payload.filters;
    }

    return api.post("/generic-list", payload);
  },
};

export const AuthAPI = {
  login: (payload) => api.post("/auth/login", payload),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

export const WalletAPI = {
  getBalance: () => api.get("/wallet"),
};

export const TransactionsAPI = {
  list: (payload) => api.post("/transactions/list", payload),
};

export const FundingAccountsAPI = {
  list: (params = {}) => api.get("/funding-accounts", params),
  create: (payload) => api.post("/funding-accounts", payload),
  update: (id, payload) => api.put(`/funding-accounts/${id}`, payload),
  delete: (id) => api.del(`/funding-accounts/${id}`),
};

export const WalletTopupsAPI = {
  create: (payload, config = {}) =>
    api.postMultipart("/wallet/topups", payload, config),
  list: (payload) => api.post("/wallet/topups/list", payload),
  getById: (id) => api.get(`/wallet/topups/${id}`),
  cancel: (id, payload = {}) =>
    api.post(`/wallet/topups/${id}/cancel`, payload),
  approve: (id, payload = {}) =>
    api.post(`/wallet/topups/${id}/approve`, payload),
  reject: (id, payload) => api.post(`/wallet/topups/${id}/reject`, payload),
};

export const OrdersAPI = {
  //pre-order pool
  preList: (query) => api.post("/order-pools/list", query),
  preUpdate: (id, data) => api.put(`/order-pools/${id}`, data),
  preCancel: (id) => api.del(`/order-pools/${id}`),
  transferPreList: (query) => api.post("/transfer-order-pools/list", query),
  transferPreUpdate: (id, data) => api.put(`/transfer-order-pools/${id}`, data),
  transferPreCancel: (id) => api.del(`/transfer-order-pools/${id}`),
  transferManualFetch: (data = {}) =>
    api.post("/transfer-order-pools/orders/manual", data),

  // order list
  create: (data) => api.post("/orders", data),
  itemsList: (data) => api.post("/orders/items/list", data),
  pendingItemsList: (data) => api.post("/orders/items/pending/list", data),
  productionItemsList: (data) =>
    api.post("/orders/items/production/list", data),
  completedItemsList: (data) => api.post("/orders/items/completed/list", data),
  completedItems: (data) => api.post("/orders/items/completed/", data),
  workerCompletedItemsList: (data) =>
    api.post("/orders/items/worker/completed/list", data),
  shippedItemsList: (data) => api.post("/orders/items/shipped/list", data),
  workerShippedItemsList: (data) =>
    api.post("/orders/items/worker/shipped/list", data),
  shippedItems: (data) => api.post("/orders/items/shipped/", data),
  affiliatedProductionItemsList: (data) =>
    api.post("/orders/items/affilated/production/list", data),
  affiliatedCompletedItemsList: (data) =>
    api.post("/orders/items/affilated/completed/list", data),
  affiliatedShippedItemsList: (data) =>
    api.post("/orders/items/affilated/shipped/list", data),
  cancelItemsList: (data) => api.post("/orders/items/cancel/list", data),
  update: (data) => api.put(`/orders/items`, data),
  updateOrder: (id, data) => api.put(`/orders/update/${id}`, data),
  remove: (id) => api.del(`/orders/${id}`),

  //order Details
  details: (id) => api.get(`/orders/items/${id}`),
  orderDetail: (orderNumber) => api.get(`/orders/${orderNumber}`),
  saveDesign: (formData) => api.putMultipart("/orders/items", formData),
  deleteDesign: (id) => api.del(`/orders/items/designs/${id}`),
  sendToProduction: (data) => api.post("/orders/production", data),

  DownloadPdf: (payload, config = {}) =>
    fetchBlobFilePost("/orders/download/pdf", {
      data: payload,
      config,
      fallbackFilename: "orders.pdf",
    }),

  // Label
  voidLabel: (data) => api.post("/orders/labels/void", data),
};

export const TransferOrdersAPI = {
  create: (data) => api.post("/transfer-orders", data),
  createManual: (data) => api.post("/transfer-orders/manual", data),
  list: (payload) => api.post("/transfer-orders/list", payload),
  detail: (orderNumber) =>
    api.get(`/transfer-orders/${encodeURIComponent(orderNumber)}`),
  update: (id, data) => api.put(`/transfer-orders/${id}`, data),
  remove: (id) => api.del(`/transfer-orders/${id}`),
  itemsList: (payload) => api.post("/transfer-orders/items/list", payload),
  pendingItemsList: (payload) =>
    api.post("/transfer-orders/items/pending/list", payload),
  productionItemsList: (payload) =>
    api.post("/transfer-orders/items/production/list", payload),
  affilatedProductionItemsList: (payload) =>
    api.post("/transfer-orders/items/affilated/production/list", payload),
  workerCompletedItemsList: (payload) =>
    api.post("/transfer-orders/items/worker/completed/list", payload),
  workerShippedItemsList: (payload) =>
    api.post("/transfer-orders/items/worker/shipped/list", payload),
  shipWorkerItems: (payload) =>
    api.post("/transfer-orders/items/worker/shipped", payload),
  workerShippingQuoteRates: (payload) =>
    api.post("/transfer-orders/items/worker/shipped/rates/quote", payload),
  updateWorkerShippingAddress: (payload) =>
    api.post("/transfer-orders/items/worker/shipped/address", payload),
  createWorkerShipmentLabel: (payload) =>
    api.post("/transfer-orders/items/worker/shipped/label", payload),
  voidWorkerShipmentLabel: (payload) =>
    api.post("/transfer-orders/items/worker/shipped/label/void", payload),
  markWorkerItemsPrinted: (payload) =>
    api.post("/transfer-orders/items/completed-worker/printed", payload),
  workerCompletedDownloadUrl: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      search.set(String(key), String(value));
    });
    const base = String(http?.defaults?.baseURL || "").replace(/\/$/, "");
    const query = search.toString();
    return `${base}/transfer-orders/items/worker/completed/download${query ? `?${query}` : ""}`;
  },
  cancelItemsList: (payload) =>
    api.post("/transfer-orders/items/cancel/list", payload),
  paymentPendingList: (payload) =>
    api.post("/transfer-orders/payments/pending/list", payload),
  customerPaymentProcessingList: (payload) =>
    api.post("/transfer-orders/payments/customer/processing/list", payload),
  customerPaymentReceipt: (payload, config = {}) =>
    fetchBlobFilePost("/transfer-orders/payments/customer/processing/receipt", {
      data: payload,
      config,
      fallbackFilename: "transfer-payment-receipt.pdf",
    }),
  createPaymentRequest: (payload) =>
    api.post("/transfer-orders/payments/request", payload),
  sendToProduction: (payload, config = {}) =>
    api.postMultipart("/transfer-orders/production", payload, config),
  uploadDesigns: (payload, config = {}) =>
    api.postMultipart("/transfer-orders/designs", payload, config),
  uploadDesignProgress: (uploadId) =>
    api.get(
      `/transfer-orders/designs/progress/${encodeURIComponent(uploadId)}`,
    ),
  deleteDesign: (id) =>
    api.del(`/transfer-orders/designs/${encodeURIComponent(id)}`),
  updateItem: (id, data) => api.put(`/transfer-orders/items/${id}`, data),
  removeItem: (id) => api.del(`/transfer-orders/items/${id}`),
};

export const RefundRemakeRequestsAPI = {
  list: (payload) => api.post("/refund-remake-requests/list", payload),
  details: (id) => api.get(`/refund-remake-requests/${id}`),
  create: (payload) => api.post("/refund-remake-requests", payload),
  updateStatus: (id, payload) =>
    api.post(`/refund-remake-requests/${id}/status`, payload),
};

export const NestShipperAPI = {
  quoteRates: (payload) => api.post("/nestshipper/rates/quote", payload),
};

// --- NEW: Companies
export const CompaniesAPI = {
  list: (data) => api.post("/companies/list", data),
  create: (data) => api.post("/companies", data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  updateShippingStatus: (data) => api.put(`/companies/shipping/status`, data),
  remove: (id) => api.del(`/companies/${id}`),
};

// --- NEW: Company Admins
export const CompanyAdminsAPI = {
  list: (query) => api.post(`/users/list`, query),
  create: (data) => api.post(`/users`, data),
  update: (userId, data) => api.put(`/users/${userId}`, data),
  remove: (userId) => api.del(`/users/${userId}`),
};

// --- NEW: Partners
export const PartnersAPI = {
  list: (query) => api.post("/partners/list", query),
  create: (data) => api.post("/partners", data),
  update: (id, data) => api.put(`/partners/${id}`, data),
  remove: (id) => api.del(`/partners/${id}`),
};

// --- NEW: Partner Admins
export const PartnerAdminsAPI = {
  list: (query) => api.post(`/users/list`, query),
  create: (data) => api.post(`/users`, data),
  update: (userId, data) => api.put(`/users/${userId}`, data),
  remove: (userId) => api.del(`/users/${userId}`),
};

// --- NEW: Customers
export const CustomersAPI = {
  list: (query) => api.post("/customers/list", query),
  create: (data) => api.post("/customers", data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  remove: (id) => api.del(`/customers/${id}`),
};

// --- NEW: Customer Admins
export const CustomerAdminsAPI = {
  list: (query) => api.post(`/users/list`, query),
  create: (data) => api.post(`/users`, data),
  update: (userId, data) => api.put(`/users/${userId}`, data),
  remove: (userId) => api.del(`/users/${userId}`),
};

// --- NEW: Products & Variations
export const ProductsAPI = {
  list: (query) => api.post("/products/list", query),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  remove: (id) => api.del(`/products/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/products/export", {
      data: payload,
      config,
      fallbackFilename: `products-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/products/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const TransferProductsAPI = {
  list: (query) => api.post("/transfer-products/list", query),
  create: (data) => api.post("/transfer-products", data),
  update: (id, data) => api.put(`/transfer-products/${id}`, data),
  remove: (id) => api.del(`/transfer-products/${id}`),
};

export const TransferProductPricesAPI = {
  list: (query) => api.post("/transfer-product-prices/list", query),
  create: (data) => api.post("/transfer-product-prices", data),
  update: (id, data) => api.put(`/transfer-product-prices/${id}`, data),
  remove: (id) => api.del(`/transfer-product-prices/${id}`),
};

export const ProductSizesAPI = {
  list: (query) => api.post("/product-sizes/list", query),
  create: (data) => api.post("/product-sizes", data),
  update: (id, data) => api.put(`/product-sizes/${id}`, data),
  remove: (id) => api.del(`/product-sizes/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-sizes/export", {
      data: payload,
      config,
      fallbackFilename: `product-sizes-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/product-sizes/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const ProductColorsAPI = {
  list: (query) => api.post("/product-colors/list", query),
  create: (data) => api.post("/product-colors", data),
  update: (id, data) => api.put(`/product-colors/${id}`, data),
  remove: (id) => api.del(`/product-colors/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-colors/export", {
      data: payload,
      config,
      fallbackFilename: `product-colors-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/product-colors/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const ProductPositionsAPI = {
  list: (query) => api.post("/product-positions/list", query),
  create: (data, config) => api.post("/product-positions", data, config),
  update: (id, data, config) =>
    api.put(`/product-positions/${id}`, data, config),
  remove: (id) => api.del(`/product-positions/${id}`),
};

export const ProductAdditionalPricesAPI = {
  list: (query) => api.post("/product-additional-prices/list", query),
  create: (data) => api.post("/product-additional-prices", data),
  update: (id, data) => api.put(`/product-additional-prices/${id}`, data),
  remove: (id) => api.del(`/product-additional-prices/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-additional-prices/export", {
      data: payload,
      config,
      fallbackFilename: `product-additional-prices-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/product-additional-prices/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const ProductStockAPI = {
  list: (query) => api.post("/product-stocks/list", query),
  create: (data) => api.post("/product-stocks", data),
  update: (id, data) => api.put(`/product-stocks/${id}`, data),
  addStock: (id, data) => api.post(`/product-stocks/${id}/add-stock`, data),
  remove: (id) => api.del(`/product-stocks/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-stocks/export", {
      data: payload,
      config,
      fallbackFilename: `product-stocks-template.${format}`,
    });
  },
  downloadTemplate: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-stocks/export-template", {
      data: payload,
      config,
      fallbackFilename: `product-prices-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/product-stocks/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const ProductPricesAPI = {
  list: (query) => api.post("/product-prices/list", query),
  assigned: (query) => api.post("/product-prices/assigned", query),
  create: (data) => api.post("/product-prices", data),
  update: (id, data) => api.put(`/product-prices/${id}`, data),
  remove: (id) => api.del(`/product-prices/${id}`),
  downloadExists: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-prices/export", {
      data: payload,
      config,
      fallbackFilename: `product-prices-template.${format}`,
    });
  },
  downloadTemplate: (params = {}, config = {}) => {
    const payload = buildExportPayload(params);
    const format = payload?.format || "csv";
    return fetchBlobFilePost("/product-prices/export-template", {
      data: payload,
      config,
      fallbackFilename: `product-prices-template.${format}`,
    });
  },
  import: (fileOrFormData, options = {}) => {
    const payload = ensureFormDataPayload(fileOrFormData, {
      fieldName: options.fieldName,
      additionalFields: options.additionalFields,
    });
    return api.postMultipart(
      `/product-prices/import`,
      payload,
      options.config || options.multipartConfig,
    );
  },
};

export const ProductMappersAPI = {
  list: (query) => api.post("/product-mappers/list", query),
  create: (data) => api.post("/product-mappers", data),
  update: (id, data) => api.put(`/product-mappers/${id}`, data),
  remove: (id) => api.del(`/product-mappers/${id}`),
};

export const ProductVariationAPI = {
  list: () => api.get("/product-mappers/customer/products"),
};

export const ProductSizeMappersAPI = {
  list: (query) => api.post("/size-mappers/list", query),
  create: (data) => api.post("/size-mappers", data),
  update: (id, data) => api.put(`/size-mappers/${id}`, data),
  remove: (id) => api.del(`/size-mappers/${id}`),
};

export const ProductColorMappersAPI = {
  list: (query) => api.post("/color-mappers/list", query),
  create: (data) => api.post("/color-mappers", data),
  update: (id, data) => api.put(`/color-mappers/${id}`, data),
  remove: (id) => api.del(`/color-mappers/${id}`),
};

export const CategoriesAPI = {
  list: () => api.get("/categories/list"),
  listWithSubCategories: () => api.get("/categories/list-with-sub-categories"),
};

export const SubCategoriesAPI = {
  list: (data) => api.post("/sub-categories/list", data),
  create: (data) => api.post("/sub-categories", data),
  update: (id, data) => api.put(`/sub-categories/${id}`, data),
  remove: (id) => api.del(`/sub-categories/${id}`),
};

export const ProfileAPI = {
  update: (id, data) => api.put(`/users/${id}`, data),
  changePassword: (data) => api.post(`/users/me/change-password`, data),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return http
      .post("/users/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export const EntityPermissionsAPI = {
  companyList: (query) => api.post("entity-permissions/company/list", query),
  getCompanyPermissions: (id) => api.get(`entity-permissions/company/${id}`),
  updateCompanyPermissions: (id, data) =>
    api.put(`entity-permissions/company/${id}`, data),

  partnerList: (query) => api.post("entity-permissions/partner/list", query),
  getPartnerPermissions: (id) => api.get(`entity-permissions/partner/${id}`),
  updatePartnerPermissions: (id, data) =>
    api.put(`entity-permissions/partner/${id}`, data),

  customerList: (query) => api.post("entity-permissions/customer/list", query),
  getCustomerPermissions: (id) => api.get(`entity-permissions/customer/${id}`),
  updateCustomerPermissions: (id, data) =>
    api.put(`entity-permissions/customer/${id}`, data),
};

export const ShipStationAPI = {
  // auth scope’a göre aktif credential
  get: () => api.get("/shipstation/credentials"),

  //manu
  // oluştur
  create: (data) => api.post("/shipstation/credentials", data),
  // data: { api_key: string, api_secret: string, label?: string }

  // GÜNCELLE
  update: (id, data) => api.put(`/shipstation/credentials/${id}`, data),
  // data (update): { api_key?: string, api_secret?: string, label?: string, status?: "active"|"inactive" }

  storeList: () => api.get("/shipstation/store/list"),

  keyCheck: (data) => api.post("/shipstation/key/check", data),
  manualOrderGet: (data) => api.post(`/shipstation/orders/manual`, data),
  listApiSources: () => api.get("/shipstation/api-source/list"),
  quoteRates: (payload) => api.post("/shipstation/rates/quote", payload),
};

export const NotificationRulesAPI = {
  list: (payload) => api.post("/notifications/list", payload),
  create: (payload) => api.post("/notifications", payload),
  update: (id, payload) => api.put(`/notifications/${id}`, payload),
  remove: (id) => api.del(`/notifications/${id}`),
  listRecipientUsers: () => api.get("/notifications/recipient-users"),
};
