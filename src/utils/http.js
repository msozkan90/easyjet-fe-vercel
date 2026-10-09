import axios from "axios";
import { createRequestContext, reportError, setTelemetryTransport } from "./telemetry.mjs";

const serializeParamsRepeat = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v != null && v !== "") search.append(key, v);
      });
    } else {
      search.append(key, value);
    }
  });
  return search.toString();
};

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  withCredentials: true,
  // timeout: 15000,
  paramsSerializer: { serialize: serializeParamsRepeat },
});

const isBrowser = typeof window !== "undefined";

function getCookie(name) {
  if (!isBrowser) return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

// --- NEW: request interceptor -> mutating isteklerde x-csrf-token ekle
const MUTATING = new Set(["post", "put", "patch", "delete"]);
let csrfToken = "";
let csrfSeedPromise;
http.interceptors.request.use(async (config) => {
  if (isBrowser && MUTATING.has((config.method || "get").toLowerCase())) {
    if (config._telemetryReport && !csrfToken && !getCookie("csrf_token")) {
      return Promise.reject(new Error("Telemetry requires an initialized session"));
    }
    // Seed before the first write, also when the API cookie is on another domain.
    const csrf = csrfToken || getCookie("csrf_token") || await ensureCsrfSeed();
    if (csrf) {
      config.headers = {
        ...(config.headers || {}),
        "x-csrf-token": csrf,
      };
    }
  }
  if (isBrowser) {
    const base = new URL(http.defaults.baseURL, window.location.origin);
    const target = new URL(config.url || "", base.href.replace(/\/?$/, "/"));
    if (target.origin === base.origin) {
      config._telemetryContext = createRequestContext(config._telemetryContext);
      config.headers = {
        ...(config.headers || {}),
        "x-request-id": config._telemetryContext.requestId,
        traceparent: config._telemetryContext.traceparent,
      };
    }
  }
  return config;
});

// 401 yakala → refresh dene → tekrar et
let isRefreshing = false;
let subscribers = [];
const subscribeTokenRefresh = (resolve, reject) =>
  subscribers.push({ resolve, reject });
const onRefreshed = () => {
  subscribers.forEach(({ resolve }) => resolve());
  subscribers = [];
};
const onRefreshFailed = (error) => {
  subscribers.forEach(({ reject }) => reject(error));
  subscribers = [];
};

const getRequestPath = (config) => {
  const rawUrl = String(config?.url || "");
  if (!rawUrl) return "";
  try {
    const normalized = rawUrl.startsWith("http")
      ? new URL(rawUrl).pathname
      : new URL(rawUrl, "http://localhost").pathname;
    return normalized;
  } catch {
    return rawUrl;
  }
};

const isAuthRefreshPath = (path) => path === "/auth/refresh" || path.endsWith("/auth/refresh");
const isAuthLoginPath = (path) => path === "/auth/login" || path.endsWith("/auth/login");

const redirectToLogin = () => {
  if (!isBrowser) return;
  window.dispatchEvent(new Event("auth:session-expired"));

  const loginPath = "/auth/login";
  if (window.location.pathname !== loginPath) {
    window.location.replace(loginPath);
  }
};

http.interceptors.response.use(
  (res) => {
    const token = res.headers?.get?.("x-csrf-token") || res.headers?.["x-csrf-token"];
    if (token) csrfToken = token;
    if (getRequestPath(res.config).endsWith("/auth/logout")) csrfToken = "";
    return res;
  },
  async (error) => {
    const { config, response } = error || {};
    if (!config?._telemetryReport && (!response || response.status >= 500)) {
      reportError("http", {
        requestId: response?.headers?.["x-request-id"] || config?._telemetryContext?.requestId,
        traceparent: response?.headers?.traceparent || config?._telemetryContext?.traceparent,
        status: response?.status || 0,
      });
    }
    if (config?._telemetryReport) return Promise.reject(error);
    if (!response) return Promise.reject(error);
    const requestPath = getRequestPath(config);

    if (response.status === 403) {
      // This exact code is returned before any business handler executes.
      // Never retry generic authorization failures or arbitrary failed writes.
      if (isBrowser && MUTATING.has((config?.method || "get").toLowerCase()) && response.data?.error?.code === "CSRF_INVALID" && !config?._csrfRetry) {
        config._csrfRetry = true;
        await ensureCsrfSeed(true);
        return http(config);
      }
      return Promise.reject(error);
    }

    if (
      response.status === 401 &&
      !config?._retry &&
      !isAuthLoginPath(requestPath) &&
      !isAuthRefreshPath(requestPath)
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            () => resolve(http({ ...config, _retry: true })),
            reject,
          );
        });
      }
      config._retry = true;
      isRefreshing = true;
      try {
        await http.post("/auth/refresh");
        isRefreshing = false;
        onRefreshed();
        return http(config);
      } catch (e) {
        isRefreshing = false;
        onRefreshFailed(e);
        redirectToLogin();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

// --- NEW: CSRF seed helper (ilk GET'te cookie üretmek için opsiyonel)
export async function ensureCsrfSeed(force = false) {
  if (!isBrowser) return "";
  if (!force && csrfToken) return csrfToken;
  csrfSeedPromise ||= http.get("/auth/csrf").then((res) => {
    if (typeof res.data?.csrfToken !== "string" || !res.data.csrfToken) {
      throw new Error("CSRF initialization failed");
    }
    csrfToken = res.data.csrfToken;
    return csrfToken;
  }).catch((error) => {
    // Transitional compatibility: the previous backend has no seed route and
    // does not enforce CSRF. A new backend still rejects any tokenless write.
    // Never downgrade on network errors, 401/403/429/503 or malformed 200s.
    if (error.response?.status === 404) return getCookie("csrf_token");
    throw error;
  }).finally(() => { csrfSeedPromise = undefined; });
  return csrfSeedPromise;
}

setTelemetryTransport((report) => http.post("/telemetry/frontend", report, {
  _telemetryReport: true,
  timeout: 5000,
}));

export default http;
