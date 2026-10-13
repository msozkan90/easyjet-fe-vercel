"use client";

import { Form, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import FormActions from "@/components/ui/FormActions";
import { useSubmitHandler } from "@/hooks/useSubmitHandler";

export default function ProductMapperForm({
  initialValues,
  onFinish,
  onCancel,
  onDirtyChange,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [submitHandler, submitting] = useSubmitHandler(onFinish);
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productMapper");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: "active",
        ...(initialValues || {}),
      }}
      onFinish={submitHandler}
      onValuesChange={() => onDirtyChange?.(true)}
    >
      <Form.Item
        name="product_id"
        label={tForm("labels.product")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.product"),
            }),
          },
        ]}
        disabled={isEdit}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.product")}
          options={products.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
          disabled={isEdit}
        />
      </Form.Item>

      <Form.Item
        name="product_mapper"
        label={tForm("labels.mapper")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.mapper"),
            }),
          },
        ]}
      >
        <Select
          mode="tags"
          tokenSeparators={[","]}
          placeholder={tForm("placeholders.mapper")}
          open={false}
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
        <FormActions
          submitText={submitButtonLabel}
          loading={submitting}
          onCancel={onCancel}
        />
      </Form.Item>
    </Form>
  );
}
