"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Form,
  Result,
  Select,
  Typography,
} from "antd";
import Link from "next/link";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import { CustomizationMappersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { hasAnyRole } from "@/utils/rbac";

const DEFAULT_MAPPER = "personalization";

const normalizeMapperNames = (values) => {
  const normalized = new Set([DEFAULT_MAPPER]);
  (Array.isArray(values) ? values : []).forEach((value) => {
    const mapper = String(value || "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (mapper) {
      normalized.add(mapper === "personalisation" ? DEFAULT_MAPPER : mapper);
    }
  });
  return Array.from(normalized);
};

export default function CustomizationMapperPage() {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const t = useTranslations("dashboard.customizationMapper");
  const tForbidden = useTranslations("rbac.forbidden");
  const user = useSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasTransferOrderCategory = new Set(
    (user?.user_categories || [])
      .map((category) => {
        if (!category) return null;
        if (typeof category === "string") return category.trim().toLowerCase();
        return String(category?.name || "")
          .trim()
          .toLowerCase();
      })
      .filter(Boolean),
  );
  const showCustomerProductMapperMenu =
    hasAnyRole(user, ["customerAdmin"]) &&
    !hasTransferOrderCategory.has("transfer") &&
    !hasTransferOrderCategory.has("transfers");

  const loadMappers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await CustomizationMappersAPI.get();
      const payload = response?.data ?? response;
      form.setFieldsValue({
        customization_mapper: normalizeMapperNames(
          payload?.customization_mapper,
        ),
      });
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [form, message, t]);

  useEffect(() => {
    if (showCustomerProductMapperMenu) {
      loadMappers();
    } else {
      setLoading(false);
    }
  }, [loadMappers, showCustomerProductMapperMenu]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const customizationMapper = normalizeMapperNames(
        values?.customization_mapper,
      );
      const response = await CustomizationMappersAPI.update({
        customization_mapper: customizationMapper,
      });
      const payload = response?.data ?? response;
      form.setFieldsValue({
        customization_mapper: normalizeMapperNames(
          payload?.customization_mapper,
        ),
      });
      message.success(t("messages.saveSuccess"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      {showCustomerProductMapperMenu ? (
        <div className="mx-auto w-full max-w-3xl">
          <Card loading={loading} title={t("title")}>
            <Typography.Paragraph type="secondary">
              {t("description")}
            </Typography.Paragraph>
            <Form
              form={form}
              layout="vertical"
              initialValues={{ customization_mapper: [DEFAULT_MAPPER] }}
              onFinish={onFinish}
            >
              <Form.Item
                name="customization_mapper"
                label={t("labels.mapper")}
                extra={t("help")}
                rules={[
                  { required: true, message: t("validation.required") },
                  {
                    validator: (_, values) => {
                      const mapperNames = normalizeMapperNames(values);
                      if (mapperNames.length > 50) {
                        return Promise.reject(
                          new Error(t("validation.maxCount")),
                        );
                      }
                      if (mapperNames.some((value) => value.length > 200)) {
                        return Promise.reject(
                          new Error(t("validation.maxLength")),
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Select
                  mode="tags"
                  tokenSeparators={[","]}
                  maxCount={50}
                  open={false}
                  placeholder={t("placeholder")}
                  options={[
                    {
                      value: DEFAULT_MAPPER,
                      label: DEFAULT_MAPPER,
                      disabled: true,
                    },
                  ]}
                  onChange={(values) => {
                    form.setFieldValue(
                      "customization_mapper",
                      normalizeMapperNames(values),
                    );
                  }}
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t("actions.save")}
              </Button>
            </Form>
          </Card>
        </div>
      ) : (
        <Result
          status="403"
          title="403"
          subTitle={tForbidden("subtitle")}
          extra={
            <Button type="primary">
              <Link href="/dashboard">{tForbidden("backToDashboard")}</Link>
            </Button>
          }
        />
      )}
    </RequireRole>
  );
}
