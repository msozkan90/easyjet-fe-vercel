// src/app/providers.jsx
"use client";

import { Provider, useDispatch } from "react-redux";
import { store } from "../redux/store";
import { ConfigProvider, theme } from "antd";
import "@ant-design/v5-patch-for-react-19";
import { useEffect } from "react";
import { AuthAPI, CategoriesAPI } from "@/utils/api";
import { setUser } from "@/redux/features/authSlice";
import {
  resetCategories,
  setCategoriesError,
  setCategoriesLoading,
  setListWithSubCategories,
} from "@/redux/features/categoriesSlice";
import { ensureCsrfSeed } from "@/utils/http";
import { RoleEnum } from "@/utils/consts";

function AuthBootstrap() {
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      try {
        await ensureCsrfSeed();
        const me = await AuthAPI.me();
        dispatch(setUser(me));
        const roleName = me?.data?.role?.name;
        if (roleName === RoleEnum.COMPANY_COMPLETED_WORKER) {
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

export function Providers({ children }) {
  return (
    <Provider store={store}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: { borderRadius: 8 },
        }}
      >
        <AuthBootstrap />
        {children}
      </ConfigProvider>
    </Provider>
  );
}
