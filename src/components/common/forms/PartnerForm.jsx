// src/components/companies/PartnerForm.jsx
"use client";

import { Form, Input, Select, InputNumber } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { useSelector } from "react-redux";

export default function PartnerForm({
  initialValues,
  onFinish,
  submitText,
  categories = [],
}) {
  const [form] = Form.useForm();
  const user = useSelector((s) => s.auth.user);
  const isShippingOwner = user?.entity?.is_shipping_owner || false;
  const tCommonForms = useTranslations("forms.common");
  const tForm = useTranslations("forms.partner");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommonForms("buttons.save");

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      <Form.Item
        name="name"
        label={tForm("labels.name")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.name"),
            }),
          },
        ]}
      >
        <Input placeholder={tForm("placeholders.name")} />
      </Form.Item>

      <Form.Item
        name="description"
        label={tForm("labels.description")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.description"),
            }),
          },
        ]}
      >
        <Input placeholder={tForm("placeholders.description")} />
      </Form.Item>

      <Form.Item
        name="categories"
        label={tForm("labels.categories")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.multiRequired", {
              field: tForm("labels.categories"),
            }),
          },
        ]}
      >
        <Select
          placeholder={tForm("placeholders.categories")}
          mode="multiple"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Form.Item>

      {isShippingOwner && (
        <Form.Item
          name="shipment_multiplier"
          label={tForm("labels.shipmentMultiplier")}
          tooltip={tForm("tooltips.shipmentMultiplier")}
        >
          <InputNumber
            className="w-full"
            min={0}
            step={0.1}
            placeholder={tForm("placeholders.shipmentMultiplier")}
          />
        </Form.Item>
      )}
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

      <Form.Item className="mb-0">
        <button
          type="submit"
          className="w-full rounded-md px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          {submitButtonLabel}
        </button>
      </Form.Item>
    </Form>
  );
}
