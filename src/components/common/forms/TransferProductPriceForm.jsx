"use client";

import { useEffect } from "react";
import { Form, InputNumber, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";

export default function TransferProductPriceForm({
  initialValues,
  onFinish,
  submitText,
  transferProducts = [],
  customers = [],
  partners = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.transferProductPrice");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");
  const watchedCustomerId = Form.useWatch("customer_id", form);
  const watchedPartnerId = Form.useWatch("partner_id", form);
  const isCustomerSelectionDisabled = isEdit || Boolean(watchedPartnerId);
  const isPartnerSelectionDisabled = isEdit || Boolean(watchedCustomerId);

  useEffect(() => {
    if (watchedCustomerId && form.getFieldValue("partner_id")) {
      form.setFieldsValue({ partner_id: undefined });
    }
  }, [form, watchedCustomerId]);

  useEffect(() => {
    if (watchedPartnerId && form.getFieldValue("customer_id")) {
      form.setFieldsValue({ customer_id: undefined });
    }
  }, [form, watchedPartnerId]);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ status: "active", ...(initialValues || {}) }}
      onFinish={onFinish}
    >
      <Form.Item
        name="transfer_product_id"
        label={tForm("labels.transferProduct")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.transferProduct"),
            }),
          },
        ]}
        disabled={isEdit}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.transferProduct")}
          options={transferProducts.map((transferProduct) => ({
            value: transferProduct.id,
            label: transferProduct.name,
          }))}
          disabled={isEdit}
        />
      </Form.Item>

      <Form.Item
        name="customer_id"
        label={tForm("labels.customer")}
        dependencies={["partner_id"]}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (value || getFieldValue("partner_id")) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(tForm("validation.customerOrPartner")),
              );
            },
          }),
        ]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={tForm("placeholders.customer")}
          options={customers.map((customer) => ({
            value: customer.id,
            label: customer.name,
          }))}
          disabled={isCustomerSelectionDisabled}
        />
      </Form.Item>

      <Form.Item
        name="partner_id"
        label={tForm("labels.partner")}
        dependencies={["customer_id"]}
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (value || getFieldValue("customer_id")) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(tForm("validation.customerOrPartner")),
              );
            },
          }),
        ]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={tForm("placeholders.partner")}
          options={partners.map((partner) => ({
            value: partner.id,
            label: partner.name,
          }))}
          disabled={isPartnerSelectionDisabled}
        />
      </Form.Item>

      <Form.Item
        name="price"
        label={tForm("labels.price")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.price"),
            }),
          },
        ]}
      >
        <InputNumber
          min={0}
          style={{ width: "100%" }}
          placeholder={tForm("placeholders.price")}
        />
      </Form.Item>

      <Form.Item
        name="status"
        label={tForm("labels.status")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.status"),
            }),
          },
        ]}
      >
        <Select
          placeholder={tCommon("placeholders.selectStatus")}
          options={[
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ]}
        />
      </Form.Item>

      <Form.Item className="mb-0">
        <button
          type="submit"
          className="w-full rounded-md px-4 py-2 bg-blue-600 text-white transition hover:bg-blue-700"
        >
          {submitButtonLabel}
        </button>
      </Form.Item>
    </Form>
  );
}
