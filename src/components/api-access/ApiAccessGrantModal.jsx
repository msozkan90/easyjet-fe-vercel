"use client";

import { useEffect, useState } from "react";
import { Alert, App as AntdApp, Form, Input, InputNumber, Modal, Select, Switch } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";

const DEFAULT_GRANT = {
  enabled: true,
  live_enabled: false,
  rate_limit_tier: "standard",
  max_keys: 5,
  notes: "",
};

export default function ApiAccessGrantModal({ customer, onClose, onSaved }) {
  const t = useTranslations("dashboard.apiAccess");
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const enabled = Form.useWatch("enabled", form);

  useEffect(() => {
    if (!customer) return;
    form.setFieldsValue({ ...DEFAULT_GRANT, ...(customer.grant ?? {}) });
  }, [customer, form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await ApiKeysAPI.adminUpsertGrant(customer.id, {
        enabled: values.enabled,
        live_enabled: values.enabled && values.live_enabled,
        rate_limit_tier: values.rate_limit_tier,
        max_keys: values.max_keys,
        notes: values.notes?.trim() || null,
      });
      message.success(t("messages.saveSuccess"));
      onSaved?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(customer)}
      title={t("modal.title", { name: customer?.name ?? "" })}
      okText={t("actions.save")}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" className="mt-2">
        <Form.Item
          name="enabled"
          label={t("fields.enabled")}
          extra={t("modal.enabledHelp")}
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="live_enabled"
          label={t("fields.liveEnabled")}
          extra={t("modal.liveHelp")}
          valuePropName="checked"
        >
          <Switch disabled={!enabled} />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item name="rate_limit_tier" label={t("fields.tier")}>
            <Select
              options={[
                { value: "standard", label: t("tiers.standard") },
                { value: "high", label: t("tiers.high") },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="max_keys"
            label={t("fields.maxKeys")}
            rules={[{ required: true, type: "number", min: 1, max: 50 }]}
          >
            <InputNumber min={1} max={50} precision={0} className="w-full" />
          </Form.Item>
        </div>
        <Form.Item name="notes" label={t("fields.notes")}>
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        {customer?.grant?.enabled && enabled === false ? (
          <Alert type="warning" showIcon message={t("modal.disableWarning")} />
        ) : null}
      </Form>
    </Modal>
  );
}
