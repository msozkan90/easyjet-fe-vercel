// src/app/providers.jsx
"use client";

import { Provider, useDispatch } from "react-redux";
import { store } from "../redux/store";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import "@ant-design/v5-patch-for-react-19";
import { useEffect, useMemo } from "react";
import { AuthAPI, CategoriesAPI } from "@/utils/api";
import { logoutLocal, setUser } from "@/redux/features/authSlice";
import { resetBalance } from "@/redux/features/balanceSlice";
import { TransferDesignUploadQueueProvider } from "@/components/transfer-orders/TransferDesignUploadQueueProvider";
import { OrdersPdfDesignUploadQueueProvider } from "@/components/orders-pdf/OrdersPdfDesignUploadQueueProvider";
import { OrderDesignUploadQueueProvider } from "@/components/orders/OrderDesignUploadQueueProvider";
import { DownloadQueueProvider } from "@/components/downloads/DownloadQueueProvider";
import {
  resetCategories,
  setCategoriesError,
  setCategoriesLoading,
  setListWithSubCategories,
} from "@/redux/features/categoriesSlice";
import { ensureCsrfSeed } from "@/utils/http";
import { installErrorMonitoring } from "@/utils/telemetry.mjs";
import { RoleEnum } from "@/utils/consts";
import { getAntdTheme } from "@/theme/tokens";
import { ThemeModeProvider, useThemeMode } from "@/theme/ThemeModeProvider";
import { useLocaleInfo } from "@/i18n/use-translations";
import trTR from "antd/locale/tr_TR";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import moment from "moment";
import "moment/locale/tr";

function ErrorMonitoring() {
  useEffect(() => installErrorMonitoring(), []);
  return null;
}

function AuthBootstrap() {
  const dispatch = useDispatch();

  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch(logoutLocal());
      dispatch(resetBalance());
      dispatch(resetCategories());
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      try {
        await ensureCsrfSeed();
        const me = await AuthAPI.me();
        dispatch(setUser(me));
        const roleName = me?.data?.role?.name;
        if (
          roleName === RoleEnum.COMPANY_COMPLETED_WORKER ||
          roleName === RoleEnum.CUSTOMER_ADMIN
        ) {
          try {
            dispatch(setCategoriesLoading());
            const categories = await CategoriesAPI.listWithSubCategories();
            dispatch(setListWithSubCategories(categories));
          } catch (error) {
            dispatch(
              setCategoriesError(
                error?.response?.data?.message ||
                  error?.message ||
                  "Categories load failed",
              ),
            );
          }
        } else {
          dispatch(resetCategories());
        }
      } catch {
        // Oturum yoksa sessiz geç
      }
    })();
  }, [dispatch]);

  return null;
}

const ANTD_LOCALES = { tr: trTR, en: enUS };

// Date libraries are module-level singletons, so they follow the UI locale
// before children render.
function applyDateLocale(locale) {
  // Server renders are shared between requests; only switch in the browser.
  if (typeof window === "undefined") return;
  const next = locale === "tr" ? "tr" : "en";
  if (dayjs.locale() !== next) dayjs.locale(next);
  if (moment.locale() !== next) moment.locale(next);
}

function ThemedConfigProvider({ locale, children }) {
  const { mode } = useThemeMode();
  const antdTheme = useMemo(() => getAntdTheme(theme, mode), [mode]);
  return (
    <ConfigProvider theme={antdTheme} locale={ANTD_LOCALES[locale] || enUS}>
      {children}
    </ConfigProvider>
  );
}

export function Providers({ children }) {
  const { locale } = useLocaleInfo();
  applyDateLocale(locale);

  return (
    <Provider store={store}>
      <ThemeModeProvider>
        <ThemedConfigProvider locale={locale}>
          <AntdApp>
            <TransferDesignUploadQueueProvider>
              <OrderDesignUploadQueueProvider>
                <OrdersPdfDesignUploadQueueProvider>
                  <DownloadQueueProvider>
                    <AuthBootstrap />
                    <ErrorMonitoring />
                    {children}
                  </DownloadQueueProvider>
                </OrdersPdfDesignUploadQueueProvider>
              </OrderDesignUploadQueueProvider>
            </TransferDesignUploadQueueProvider>
          </AntdApp>
        </ThemedConfigProvider>
      </ThemeModeProvider>
    </Provider>
  );
}
