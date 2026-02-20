"use client";

import { Form, Input, Select, Button, Space } from "antd";
import { useEffect } from "react";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

/**
 * Props:
 * - mode: "create" | "edit"
 * - customers: [{id, name}]
 * - initialValues
 * - onSubmit(values)
 * - onCancel()
 */
export default function CustomerAdminForm({
  mode = "create",
  customers = [],
  initialValues,
  onSubmit,
  onCancel,
}) {
  const [form] = Form.useForm();
  const tCommonForms = useTranslations("forms.common");
  const tForm = useTranslations("forms.customerAdmin");
  const tStatus = useTranslations("common.status");
  const tRoles = useTranslations("forms.common.roles");

  useEffect(() => {
    form.setFieldsValue(initialValues || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const handleFinish = async () => {
    const values = await form.validateFields();
    await onSubmit?.(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      preserve={false}
      initialValues={initialValues}
    >
      <Form.Item
        name="first_name"
        label={tForm("labels.firstName")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.firstName"),
            }),
          },
        ]}
      >
        <Input />
      </Form.Item>

      <Form.Item
        name="last_name"
        label={tForm("labels.lastName")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.lastName"),
            }),
          },
        ]}
      >
        <Input />
      </Form.Item>
      <Form.Item
        name="email"
        label={tForm("labels.email")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.email"),
            }),
          },
          { type: "email", message: tCommonForms("validation.email") },
        ]}
      >
        <Input disabled={mode === "edit"} type="email" />
      </Form.Item>

      {mode === "create" && (
        <Form.Item
          name="password"
          label={tForm("labels.password")}
          rules={[
            {
              required: true,
              message: tCommonForms("validation.required", {
                field: tForm("labels.password"),
              }),
            },
          ]}
        >
          <Input.Password />
        </Form.Item>
      )}

      <Form.Item name="mobile_phone" label={tForm("labels.mobile")}>
        <Input />
      </Form.Item>

      {mode === "create" && (
        <Form.Item
          name="customer_id"
          label={tForm("labels.customer")}
          rules={[
            {
              required: true,
              message: tCommonForms("validation.required", {
                field: tForm("labels.customer"),
              }),
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={tCommonForms("placeholders.selectCustomer")}
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
      )}

      {mode === "edit" && (
        <Form.Item
          name="status"
          label={tForm("labels.status")}
          rules={[
            {
              required: true,
              message: tCommonForms("validation.required", {
                field: tForm("labels.status"),
              }),
            },
          ]}
        >
          <Select
            placeholder={tCommonForms("placeholders.selectStatus")}
            options={[
              { value: "active", label: tStatus("active") },
              { value: "inactive", label: tStatus("inactive") },
            ]}
          />
        </Form.Item>
      )}

      <Form.Item name="role_code" label={tForm("labels.role")}>
        <Select
          disabled
          options={[
            { value: RoleEnum.CUSTOMER_ADMIN, label: tRoles("customerAdmin") },
          ]}
        />
      </Form.Item>

      <Space style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>{tCommonForms("buttons.cancel")}</Button>
        <Button type="primary" onClick={handleFinish}>
          {tCommonForms("buttons.save")}
        </Button>
      </Space>
    </Form>
  );
}
