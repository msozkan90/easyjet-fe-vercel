import axios from "axios";

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
http.interceptors.request.use((config) => {
  if (isBrowser && MUTATING.has((config.method || "get").toLowerCase())) {
    const csrf = getCookie("csrf_token");
    if (csrf) {
      config.headers = {
        ...(config.headers || {}),
        "x-csrf-token": csrf,
      };
    }
  }
  return config;
});

// 401 yakala → refresh dene → tekrar et
let isRefreshing = false;
let subscribers = [];
const subscribeTokenRefresh = (cb) => subscribers.push(cb);
const onRefreshed = () => {
  subscribers.forEach((cb) => cb());
  subscribers = [];
};

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error || {};
    if (!response) return Promise.reject(error);

    if (response.status === 403) {
      return Promise.reject(error);
    }

    if (response.status === 401 && !config._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(() =>
            resolve(http({ ...config, _retry: true }))
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
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

// --- NEW: CSRF seed helper (ilk GET'te cookie üretmek için opsiyonel)
export async function ensureCsrfSeed() {
  try {
    // Backend GET isteklerinde csrf cookie’si yoksa üretir
    // (ör: /auth/me 401 dönebilir; /health daha risksiz)
    await http.get("/health").catch(() => {});
  } catch {}
}

export default http;
