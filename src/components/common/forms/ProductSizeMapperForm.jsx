"use client";

import { useEffect, useMemo, useState } from "react";
import { Form, Input, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";

export default function ProductSizeMapperForm({
  initialValues,
  onFinish,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productSizeMapper");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  const [sizeOptions, setSizeOptions] = useState([]);
  const [sizeLoading, setSizeLoading] = useState(false);

  const initialProductId =
    initialValues?.product_id ?? initialValues?.product?.id;
  const productId = Form.useWatch("product_id", form) ?? initialProductId;

  useEffect(() => {
    if (!productId) {
      setSizeOptions([]);
      if (!isEdit) {
        form.setFieldsValue({ size_id: undefined });
      }
      return;
    }

    let alive = true;

    const loadSizes = async () => {
      setSizeLoading(true);
      try {
        const response = await fetchGenericList("product_size", {
          filters: { product_id: productId },
        });
        if (!alive) return;
        const next = Array.isArray(response)
          ? response.filter((item) => item && typeof item === "object")
          : [];
        setSizeOptions(next);

        const currentSizeId =
          form.getFieldValue("size_id") ??
          initialValues?.size_id ??
          initialValues?.size?.id;
        const hasCurrent = next.some((item) => item?.id === currentSizeId);
        if (!hasCurrent) {
          form.setFieldsValue({ size_id: undefined });
        }
      } catch {
        if (alive) {
          setSizeOptions([]);
          form.setFieldsValue({ size_id: undefined });
        }
      } finally {
        if (alive) {
          setSizeLoading(false);
        }
      }
    };

    loadSizes();

    return () => {
      alive = false;
    };
  }, [productId, form, initialValues, isEdit]);

  const sizeSelectOptions = useMemo(
    () =>
      sizeOptions.map((size) => ({
        value: size.id,
        label: size.name,
      })),
    [sizeOptions]
  );

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: "active",
        ...(initialValues || {}),
      }}
      onFinish={onFinish}
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
        name="size_id"
        label={tForm("labels.size")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.size"),
            }),
          },
        ]}
        disabled={isEdit || !productId}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.size")}
          options={sizeSelectOptions}
          loading={sizeLoading}
          disabled={isEdit || !productId}
        />
      </Form.Item>

      <Form.Item
        name="size_mapper"
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
        <Input placeholder={tForm("placeholders.mapper")} />
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
