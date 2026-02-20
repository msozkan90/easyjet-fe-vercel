"use client";

import { Form, Input, Select, Button, Space } from "antd";
import { useEffect } from "react";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

/**
 * Props:
 * - mode: "create" | "edit"
 * - categories: [{id, name}]
 * - initialValues
 * - onSubmit(values)
 * - onCancel()
 */
export default function CompanyUserForm({
  mode = "create",
  categories = [],
  initialValues,
  onSubmit,
  onCancel,
}) {
  const [form] = Form.useForm();
  const tCommonForms = useTranslations("forms.common");
  const tForm = useTranslations("forms.companyUser");
  const tStatus = useTranslations("common.status");
  const tRoles = useTranslations("forms.common.roles");
  const watchedRole = Form.useWatch("role_code", form);

  useEffect(() => {
    form.setFieldsValue(initialValues || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    if (watchedRole === RoleEnum.COMPANY_ADMIN) {
      form.setFieldsValue({ categories: [] });
    }
  }, [form, watchedRole]);

  const handleFinish = async () => {
    const values = await form.validateFields();
    await onSubmit?.(values);
  };

  const roleOptions = [
    { value: RoleEnum.COMPANY_ADMIN, label: tRoles("companyAdmin") },
    {
      value: RoleEnum.COMPANY_SHIPMENT_WORKER,
      label: tRoles("companyShipmentWorker"),
    },
    {
      value: RoleEnum.COMPANY_COMPLETED_WORKER,
      label: tRoles("companyCompletedWorker"),
    },
  ];

  const showCategories =
    watchedRole && watchedRole !== RoleEnum.COMPANY_ADMIN;

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
        <Input type="email" disabled={mode === "edit"} />
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

      <Form.Item
        name="role_code"
        label={tForm("labels.role")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.role"),
            }),
          },
        ]}
      >
        <Select disabled={mode === "edit"} options={roleOptions} />
      </Form.Item>

      {showCategories && (
        <Form.Item name="categories" label={tForm("labels.categories")}>
          <Select
            mode="multiple"
            placeholder={tCommonForms("placeholders.selectCategories")}
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        </Form.Item>
      )}

      <Space style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>{tCommonForms("buttons.cancel")}</Button>
        <Button type="primary" onClick={handleFinish}>
          {tCommonForms("buttons.save")}
        </Button>
      </Space>
    </Form>
  );
}
