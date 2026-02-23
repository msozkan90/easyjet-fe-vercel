"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Form,
  Input,
  Button,
  Typography,
  Card,
  App as AntdApp,
  Row,
  Col,
} from "antd";
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
  const router = useRouter();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      dispatch(setAuthLoading());
      await AuthAPI.login(values); // http-only cookie set
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
      message.success(t("messages.welcome"));
      router.push("/dashboard");
    } catch (e) {
      dispatch(setAuthError(e?.response?.data?.message || t("messages.loginFailed")));
      message.error(t("messages.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row
      align="middle"
      justify="center"
      style={{
        minHeight: "100vh",
        background: "#f5f7fa",
        padding: "56px 16px 16px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
        }}
      >
        <LanguageSwitcher size="small" textColor="#344054" />
      </div>
      <Col xs={22} sm={18} md={12} lg={8}>
        <Card>
          <Typography.Title
            level={3}
            style={{ textAlign: "center", marginBottom: 8 }}
          >
            {t("title")}
          </Typography.Title>
          <Typography.Paragraph
            style={{ textAlign: "center", color: "#667085", marginBottom: 24 }}
          >
            {t("subtitle")}
          </Typography.Paragraph>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="email"
              label={t("fields.email.label")}
              rules={[{ required: true, message: t("validation.emailRequired") }]}
            >
              <Input placeholder={t("fields.email.placeholder")} />
            </Form.Item>
            <Form.Item
              name="password"
              label={t("fields.password.label")}
              rules={[
                { required: true, message: t("validation.passwordRequired") },
              ]}
            >
              <Input.Password placeholder={t("fields.password.placeholder")} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              {t("actions.submit")}
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
