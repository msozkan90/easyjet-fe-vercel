"use client";

import { useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space } from "antd";
import { CustomerGroupsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

export default function CustomerGroupsModal({ onClose, onChanged }) {
  const t = useTranslations("dashboard.customerGroups");
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([CustomerGroupsAPI.list(), CustomerGroupsAPI.filterOptions()])
      .then(([groupResponse, customerResponse]) => {
        if (!active) return;
        setGroups(groupResponse.data);
        setCustomers(customerResponse.data);
        setReady(true);
      })
      .catch(() => { if (active) message.error(t("loadError")); });
    return () => { active = false; };
  }, [message, t]);

  function selectGroup(id) {
    setSelected(id || null);
    form.setFieldsValue({
      name: groups.find((group) => group.id === id)?.name || "",
      customer_ids: id ? customers.filter((row) => row.customer_group_id === id).map((row) => row.id) : [],
    });
  }

  async function save(values) {
    setSaving(true);
    try {
      const payload = { ...values, customer_ids: values.customer_ids || [] };
      if (selected) await CustomerGroupsAPI.update(selected, payload);
      else await CustomerGroupsAPI.create(payload);
      message.success(t("saved"));
      onChanged();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await CustomerGroupsAPI.remove(selected);
      message.success(t("removed"));
      onChanged();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("removeError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("title")} open onCancel={onClose} footer={null} closable={!saving} maskClosable={!saving} keyboard={!saving}>
      <Form form={form} layout="vertical" onFinish={save} disabled={!ready || saving}>
        <Form.Item label={t("groupFilter")}>
          <Select value={selected || "new"} onChange={(id) => selectGroup(id === "new" ? null : id)}
            showSearch optionFilterProp="label"
            options={[{ value: "new", label: t("create") }, ...groups.map((group) => ({ value: group.id, label: group.name }))]}
          />
        </Form.Item>
        <Form.Item name="name" label={t("name")} rules={[{ required: true, whitespace: true, max: 120 }]}>
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="customer_ids" label={t("members")}>
          <Select mode="multiple" showSearch optionFilterProp="label"
            options={customers
              .filter((row) => !row.customer_group_id || row.customer_group_id === selected)
              .map((row) => ({ value: row.id, label: row.name }))}
          />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>{t("save")}</Button>
          {selected && (
            <Popconfirm title={t("removeConfirm")} onConfirm={remove}>
              <Button danger>{t("remove")}</Button>
            </Popconfirm>
          )}
        </Space>
      </Form>
    </Modal>
  );
}
