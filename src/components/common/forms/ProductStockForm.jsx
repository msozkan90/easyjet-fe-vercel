"use client";

import { useEffect, useRef, useState } from "react";
import { Form, InputNumber, Select } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";

const DEFAULT_OPTION_NAMES = new Set(["standart", "standard"]);

const isDefaultOptionName = (value) =>
  typeof value === "string" &&
  DEFAULT_OPTION_NAMES.has(value.trim().toLowerCase());

export default function ProductStockForm({
  initialValues,
  onFinish,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productStock");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");
  const quantityRules = isEdit
    ? []
    : [
        {
          required: true,
          message: tCommon("validation.required", {
            field: tForm("labels.quantity"),
          }),
        },
      ];
  const unitPriceRules = isEdit
    ? []
    : [
        {
          required: true,
          message: tCommon("validation.required", {
            field: tForm("labels.unit_price"),
          }),
        },
      ];

  const [sizeOptions, setSizeOptions] = useState([]);
  const [colorOptions, setColorOptions] = useState([]);
  const [sizeLoading, setSizeLoading] = useState(false);
  const [colorLoading, setColorLoading] = useState(false);
  const previousProductIdRef = useRef();
  const watchedProductId = Form.useWatch("product_id", form);
  const initialProductId =
    initialValues?.product_id ?? initialValues?.product?.id;
  const productId = watchedProductId ?? initialProductId;

  useEffect(() => {
    if (!productId) {
      previousProductIdRef.current = undefined;
      setSizeOptions([]);
      setColorOptions([]);
      setSizeLoading(false);
      setColorLoading(false);
      form.setFieldsValue({
        size_id: undefined,
        color_id: undefined,
      });
      return;
    }

    let alive = true;
    const hasProductChanged =
      previousProductIdRef.current &&
      previousProductIdRef.current !== productId;

    previousProductIdRef.current = productId;

    if (hasProductChanged) {
      form.setFieldsValue({
        size_id: undefined,
        color_id: undefined,
      });
    }

    const fetchDependentLists = async () => {
      setSizeLoading(true);
      setColorLoading(true);
      try {
        const [sizesResponse, colorsResponse] = await Promise.all([
          fetchGenericList("product_size", {
            filters: { product_id: productId },
          }),
          fetchGenericList("product_color", {
            filters: { product_id: productId },
          }),
        ]);

        if (!alive) return;

        const nextSizes = Array.isArray(sizesResponse)
          ? sizesResponse.filter((item) => item && typeof item === "object")
          : [];
        const nextColors = Array.isArray(colorsResponse)
          ? colorsResponse.filter((item) => item && typeof item === "object")
          : [];

        setSizeOptions(nextSizes);
        setColorOptions(nextColors);

        const updates = {};

        const currentSizeId = form.getFieldValue("size_id");
        const availableSizeIds = new Set(
          nextSizes
            .map((item) => item?.id)
            .filter((id) => id !== null && id !== undefined),
        );
        if (!currentSizeId || !availableSizeIds.has(currentSizeId)) {
          const defaultSize = nextSizes.find(
            (item) => isDefaultOptionName(item?.name),
          );
          if (defaultSize?.id !== undefined) {
            updates.size_id = defaultSize.id;
          } else if (currentSizeId && !availableSizeIds.has(currentSizeId)) {
            updates.size_id = undefined;
          }
        }

        const currentColorId = form.getFieldValue("color_id");
        const availableColorIds = new Set(
          nextColors
            .map((item) => item?.id)
            .filter((id) => id !== null && id !== undefined),
        );
        if (!currentColorId || !availableColorIds.has(currentColorId)) {
          const defaultColor = nextColors.find(
            (item) => isDefaultOptionName(item?.name),
          );
          if (defaultColor?.id !== undefined) {
            updates.color_id = defaultColor.id;
          } else if (currentColorId && !availableColorIds.has(currentColorId)) {
            updates.color_id = undefined;
          }
        }

        if (Object.keys(updates).length) {
          form.setFieldsValue(updates);
        }
      } catch (error) {
        if (!alive) return;
        console.error("Failed to load product sizes/colors", error);
        setSizeOptions([]);
        setColorOptions([]);
        form.setFieldsValue({
          size_id: undefined,
          color_id: undefined,
        });
      } finally {
        if (alive) {
          setSizeLoading(false);
          setColorLoading(false);
        }
      }
    };

    fetchDependentLists();

    return () => {
      alive = false;
    };
  }, [productId, form]);

  const mergedInitialValues = {
    ...(initialValues || {}),
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={mergedInitialValues}
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
        disabled={isEdit}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.size")}
          options={sizeOptions.map((size) => ({
            value: size.id,
            label: size.name,
          }))}
          loading={sizeLoading}
          disabled={!productId || isEdit}
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
        disabled={isEdit}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.color")}
          options={colorOptions.map((color) => ({
            value: color.id,
            label: color.name,
          }))}
          loading={colorLoading}
          disabled={!productId || isEdit}
        />
      </Form.Item>
      <Form.Item
        name="stock_alert_threshold"
        label={tForm("labels.stock_alert_threshold")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.stock_alert_threshold"),
            }),
          },
        ]}
      >
        <InputNumber
          min={0}
          step={1}
          precision={0}
          style={{ width: "100%" }}
          placeholder={tForm("placeholders.stock_alert_threshold")}
        />
      </Form.Item>
      <Form.Item
        name="quantity"
        label={tForm("labels.quantity")}
        rules={quantityRules}
      >
        <InputNumber
          min={0}
          step={1}
          precision={0}
          style={{ width: "100%" }}
          placeholder={tForm("placeholders.quantity")}
        />
      </Form.Item>

      <Form.Item
        name="unit_price"
        label={tForm("labels.unit_price")}
        rules={unitPriceRules}
      >
        <InputNumber
          min={0.01}
          step={0.01}
          style={{ width: "100%" }}
          placeholder={tForm("placeholders.unit_price")}
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
