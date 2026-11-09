"use client";

import { Form, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import FormActions from "@/components/ui/FormActions";
import { useSubmitHandler } from "@/hooks/useSubmitHandler";

export default function ProductPrintTypeMapperForm({
  initialValues,
  onFinish,
  onCancel,
  onDirtyChange,
  submitText,
  subCategoryOptions = [],
  isEdit = false,
}) {
  const [submitHandler, submitting] = useSubmitHandler(onFinish);
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productPrintTypeMapper");
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
      onFinish={(values) =>
        submitHandler(
          isEdit
            ? { print_type_mapper: values.print_type_mapper, status: values.status }
            : values,
        )
      }
      onValuesChange={() => onDirtyChange?.(true)}
    >
      <Form.Item
        name="sub_category_id"
        label={tForm("labels.subCategory")}
        extra={tForm("hints.subCategory")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.subCategory"),
            }),
          },
        ]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.subCategory")}
          options={subCategoryOptions}
          disabled={isEdit}
        />
      </Form.Item>

      <Form.Item
        name="print_type_mapper"
        label={tForm("labels.mapper")}
        extra={tForm("hints.mapper")}
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
