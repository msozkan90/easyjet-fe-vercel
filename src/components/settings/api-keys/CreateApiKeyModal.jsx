"use client";

import { useEffect, useState } from "react";
import { App as AntdApp, Checkbox, Form, Input, Modal, Radio, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";

const EXPIRY_OPTIONS = [30, 90, 180, 365];

// Accepts IPv4/IPv6 addresses and CIDR ranges; the backend validates them again.
const looksLikeIpOrCidr = (value) =>
  /^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(value) && /[.:]/.test(value);

const errorMessage = (error, fallback) =>
  error?.response?.data?.error?.message || fallback;

export default function CreateApiKeyModal({ open, access, onClose, onCreated }) {
  const t = useTranslations("dashboard.settings.apiKeys");
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      environment: "test",
      scopes: access?.available_scopes ?? [],
      expires_in_days: null,
      ip_allowlist: [],
    });
  }, [access, form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const resp = await ApiKeysAPI.create({
        name: values.name.trim(),
        environment: values.environment,
        scopes: values.scopes,
        expires_in_days: values.expires_in_days ?? null,
        ip_allowlist: values.ip_allowlist ?? [],
      });
      onCreated?.(resp?.data);
    } catch (error) {
      message.error(errorMessage(error, t("messages.createError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("create.title")}
      okText={t("create.submit")}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" requiredMark="optional" className="mt-2">
        <Form.Item
          name="name"
          label={t("fields.name")}
          extra={t("create.nameHelp")}
          rules={[{ required: true, whitespace: true, max: 100 }]}
        >
          <Input placeholder={t("create.namePlaceholder")} maxLength={100} />
        </Form.Item>

        <Form.Item name="environment" label={t("fields.environment")}>
          <Radio.Group>
            <Radio value="test">{t("environment.test")}</Radio>
            <Radio value="live" disabled={!access?.live_enabled}>
              {t("environment.live")}
            </Radio>
          </Radio.Group>
        </Form.Item>
        {!access?.live_enabled ? (
          <p className="-mt-4 mb-4 text-[13px] text-text-secondary">{t("create.liveLocked")}</p>
        ) : null}

        <Form.Item
          name="scopes"
          label={t("fields.scopes")}
          rules={[{ required: true, type: "array", min: 1, message: t("create.scopesRequired") }]}
        >
          <Checkbox.Group className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(access?.available_scopes ?? []).map((scope) => (
              <Checkbox key={scope} value={scope}>
                <span className="flex flex-col">
                  <span className="ej-mono text-[13px]">{scope}</span>
                  <span className="text-xs text-text-secondary">{t(`scopes.${scope}`)}</span>
                </span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </Form.Item>

        <Form.Item name="expires_in_days" label={t("fields.expiresAt")}>
          <Select
            options={[
              { value: null, label: t("create.noExpiry") },
              ...EXPIRY_OPTIONS.map((days) => ({
                value: days,
                label: t("create.expiresInDays", { days }),
              })),
            ]}
          />
        </Form.Item>

        <Form.Item
          name="ip_allowlist"
          label={t("fields.ipAllowlist")}
          extra={t("create.ipHelp")}
          rules={[
            {
              validator: (_, values = []) =>
                values.every((value) => looksLikeIpOrCidr(String(value).trim()))
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("create.ipInvalid"))),
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[",", " "]} open={false} placeholder="203.0.113.10, 10.0.0.0/24" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
