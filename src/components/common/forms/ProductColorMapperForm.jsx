"use client";

import { useEffect, useMemo, useState } from "react";
import { Form, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";
import FormActions from "@/components/ui/FormActions";
import { useSubmitHandler } from "@/hooks/useSubmitHandler";

export default function ProductColorMapperForm({
  initialValues,
  onFinish,
  onCancel,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [submitHandler, submitting] = useSubmitHandler(onFinish);
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productColorMapper");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  const [colorOptions, setColorOptions] = useState([]);
  const [colorLoading, setColorLoading] = useState(false);

  const initialProductId =
    initialValues?.product_id ?? initialValues?.product?.id;
  const productId = Form.useWatch("product_id", form) ?? initialProductId;

  useEffect(() => {
    if (!productId) {
      setColorOptions([]);
      if (!isEdit) {
        form.setFieldsValue({ color_id: undefined });
      }
      return;
    }

    let alive = true;

    const loadColors = async () => {
      setColorLoading(true);
      try {
        const response = await fetchGenericList("product_color", {
          filters: { product_id: productId },
        });
        if (!alive) return;
        const next = Array.isArray(response)
          ? response.filter((item) => item && typeof item === "object")
          : [];
        setColorOptions(next);

        const currentColorId =
          form.getFieldValue("color_id") ??
          initialValues?.color_id ??
          initialValues?.color?.id;
        const hasCurrent = next.some((item) => item?.id === currentColorId);
        if (!hasCurrent) {
          form.setFieldsValue({ color_id: undefined });
        }
      } catch {
        if (alive) {
          setColorOptions([]);
          form.setFieldsValue({ color_id: undefined });
        }
      } finally {
        if (alive) {
          setColorLoading(false);
        }
      }
    };

    loadColors();

    return () => {
      alive = false;
    };
  }, [productId, form, initialValues, isEdit]);

  const colorSelectOptions = useMemo(
    () =>
      colorOptions.map((color) => ({
        value: color.id,
        label: color.name,
      })),
    [colorOptions]
  );

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: "active",
        ...(initialValues || {}),
      }}
      onFinish={submitHandler}
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
        name="color_id"
        label={tForm("labels.color")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.color"),
            }),
          },
        ]}
        disabled={isEdit || !productId}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.color")}
          options={colorSelectOptions}
          loading={colorLoading}
          disabled={isEdit || !productId}
        />
      </Form.Item>

      <Form.Item
        name="color_mapper"
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
