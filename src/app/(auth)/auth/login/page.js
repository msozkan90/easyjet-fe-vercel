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

export default function LoginPage() {
  const { message } = AntdApp.useApp();
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
      message.success("Hoş geldiniz!");
      router.push("/dashboard");
    } catch (e) {
      dispatch(setAuthError(e?.response?.data?.message || "Giriş başarısız"));
      message.error("Kullanıcı adı veya şifre hatalı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row
      align="middle"
      justify="center"
      style={{ minHeight: "100vh", background: "#f5f7fa" }}
    >
      <Col xs={22} sm={18} md={12} lg={8}>
        <Card>
          <Typography.Title
            level={3}
            style={{ textAlign: "center", marginBottom: 8 }}
          >
            Giriş Yap
          </Typography.Title>
          <Typography.Paragraph
            style={{ textAlign: "center", color: "#667085", marginBottom: 24 }}
          >
            Siparişlerinizi yönetin, takip edin.
          </Typography.Paragraph>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              name="email"
              label="Kullanıcı Adı"
              rules={[{ required: true }]}
            >
              <Input placeholder="kullanici@ornek.com" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Şifre"
              rules={[{ required: true }]}
            >
              <Input.Password placeholder="••••••••" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Giriş Yap
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
