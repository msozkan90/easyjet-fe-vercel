"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Alert, Form, Input, Button, App as AntdApp } from "antd";
import { AuthAPI, CategoriesAPI } from "@/utils/api";
import { useDispatch } from "react-redux";
import {
  setAuthLoading,
  setUser,
  setAuthError,
} from "@/redux/features/authSlice";
import {
  resetCategories,
  setCategoriesError,
  setCategoriesLoading,
  setListWithSubCategories,
} from "@/redux/features/categoriesSlice";
import { RoleEnum } from "@/utils/consts";
import { useTranslations } from "@/i18n/use-translations";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";

export default function LoginPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("auth.login");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      setErrorText("");
      dispatch(setAuthLoading());
      await AuthAPI.login(values); // http-only cookie set
      const me = await AuthAPI.me();
      dispatch(setUser(me));
      const roleName = me?.data?.role?.name;
      if (roleName === RoleEnum.COMPANY_COMPLETED_WORKER || roleName === RoleEnum.CUSTOMER_ADMIN) {
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
      message.success(t("messages.welcome"));
      router.push("/dashboard");
    } catch (e) {
      dispatch(
        setAuthError(
          e?.response?.data?.error?.message ||
            e?.response?.data?.message ||
            t("messages.loginFailed"),
        ),
      );
      setErrorText(t("messages.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-wrap bg-surface">
      <section className="relative flex flex-[1_1_420px] flex-col gap-12 overflow-hidden bg-ink-900 px-6 py-5 text-white md:px-14 md:py-12">
        <Image
          src="/white_text_logo.png"
          alt="EasyJet"
          width={168}
          height={39}
          priority
          className="relative h-auto w-[168px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 bottom-[19rem] hidden h-28 w-[520px] -skew-y-[27deg] bg-ink-800 md:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 bottom-40 hidden h-28 w-[520px] -skew-y-[27deg] bg-brand-500 opacity-90 md:block"
        />
        <div className="relative hidden max-w-md flex-col gap-4 md:my-auto md:flex">
          <h1 className="m-0 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            {t("brand.headline")}
          </h1>
          <p className="m-0 text-base leading-relaxed text-ink-200">
            {t("brand.body")}
          </p>
        </div>
      </section>

      <section className="flex flex-[1_1_480px] flex-col p-6 md:p-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="flex w-full max-w-[380px] flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-[26px] font-semibold leading-9 tracking-tight text-text">
                {t("title")}
              </h2>
              <p className="m-0 text-text-secondary">{t("subtitle")}</p>
            </div>

            {errorText ? (
              <Alert type="error" showIcon message={errorText} role="alert" />
            ) : null}

            <Form
              layout="vertical"
              onFinish={onFinish}
              requiredMark={false}
              size="large"
            >
              <Form.Item
                name="email"
                label={t("fields.email.label")}
                rules={[
                  { required: true, message: t("validation.emailRequired") },
                ]}
              >
                <Input
                  type="email"
                  autoComplete="username"
                  placeholder={t("fields.email.placeholder")}
                />
              </Form.Item>
              <Form.Item
                name="password"
                label={t("fields.password.label")}
                rules={[
                  { required: true, message: t("validation.passwordRequired") },
                ]}
              >
                <Input.Password
                  autoComplete="current-password"
                  placeholder={t("fields.password.placeholder")}
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {t("actions.submit")}
              </Button>
            </Form>
          </div>
        </div>
        <div className="text-center text-xs text-ink-400">
          © {new Date().getFullYear()} EasyJet
        </div>
      </section>
    </div>
  );
}
