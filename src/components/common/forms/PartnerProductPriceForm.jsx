"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
} from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { ProductPricesAPI } from "@/utils/api";
import { formatPrice, pickBasePrice, toNumeric } from "@/utils/priceHelpers";

const deriveBasePrice = (source) => {
  if (!source || typeof source !== "object") {
    return toNumeric(source);
  }
  if (Object.prototype.hasOwnProperty.call(source, "base_price")) {
    const numeric = toNumeric(source.base_price);
    if (numeric !== undefined) return numeric;
  }
  if (Object.prototype.hasOwnProperty.call(source, "price")) {
    const numeric = toNumeric(source.price);
    if (numeric !== undefined) return numeric;
  }
  return pickBasePrice(source);
};

const buildCombinationKey = (partnerId, productId, sizeId, colorId) =>
  [
    partnerId ?? "none",
    productId ?? "none",
    sizeId ?? "none",
    colorId ?? "none",
  ].join(":");

const cleanFilters = (filters) => {
  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value !== undefined
  );
  return Object.fromEntries(entries);
};

export default function PartnerProductPriceForm({
  partnerId,
  initialValues,
  onFinish,
  submitText,
  products = [],
  customers = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.partnerProductPrice");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  const [sizeOptions, setSizeOptions] = useState([]);
  const [colorOptions, setColorOptions] = useState([]);
  const [sizeLoading, setSizeLoading] = useState(false);
  const [colorLoading, setColorLoading] = useState(false);

  const initialProductId =
    initialValues?.product_id ?? initialValues?.product?.id;
  const initialSizeId = initialValues?.size_id ?? initialValues?.size?.id;
  const initialColorId = initialValues?.color_id ?? initialValues?.color?.id;

  const derivedInitialBasePrice = useMemo(
    () => deriveBasePrice(initialValues),
    [initialValues]
  );

  const [basePrice, setBasePrice] = useState(derivedInitialBasePrice);
  const [basePriceLoading, setBasePriceLoading] = useState(false);
  const [basePriceError, setBasePriceError] = useState(null);
  const lastBaseKeyRef = useRef(null);
  const skipInitialFetchRef = useRef(
    Boolean(isEdit && derivedInitialBasePrice !== undefined)
  );

  const watchedProductId = Form.useWatch("product_id", form);
  const watchedSizeId = Form.useWatch("size_id", form);
  const watchedColorId = Form.useWatch("color_id", form);

  const effectiveProductId = watchedProductId ?? initialProductId;
  const effectiveSizeId = watchedSizeId ?? initialSizeId;
  const effectiveColorId = watchedColorId ?? initialColorId;

  useEffect(() => {
    form.setFieldsValue(initialValues || {});
  }, [form, initialValues]);

  useEffect(() => {
    if (derivedInitialBasePrice !== undefined) {
      setBasePrice(derivedInitialBasePrice);
      setBasePriceError(null);
    } else if (!initialValues) {
      setBasePrice(undefined);
      setBasePriceError(null);
    }
  }, [derivedInitialBasePrice, initialValues]);

  useEffect(() => {
    skipInitialFetchRef.current = Boolean(
      isEdit && derivedInitialBasePrice !== undefined
    );
  }, [derivedInitialBasePrice, isEdit]);

  useEffect(() => {
    if (!effectiveProductId) {
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
    const fetchDependentLists = async () => {
      setSizeLoading(true);
      setColorLoading(true);
      try {
        const [sizesResponse, colorsResponse] = await Promise.all([
          fetchGenericList("product_size", {
            filters: { product_id: effectiveProductId },
          }),
          fetchGenericList("product_color", {
            filters: { product_id: effectiveProductId },
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
            .filter((id) => id !== null && id !== undefined)
        );
        if (!currentSizeId || !availableSizeIds.has(currentSizeId)) {
          if (initialSizeId && availableSizeIds.has(initialSizeId)) {
            updates.size_id = initialSizeId;
          } else {
            updates.size_id = undefined;
          }
        }

        const currentColorId = form.getFieldValue("color_id");
        const availableColorIds = new Set(
          nextColors
            .map((item) => item?.id)
            .filter((id) => id !== null && id !== undefined)
        );
        if (!currentColorId || !availableColorIds.has(currentColorId)) {
          if (initialColorId && availableColorIds.has(initialColorId)) {
            updates.color_id = initialColorId;
          } else {
            updates.color_id = undefined;
          }
        }

        if (Object.keys(updates).length) {
          form.setFieldsValue(updates);
        }
      } catch {
        if (alive) {
          message.error(tForm("messages.dependentListsError"));
        }
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
  }, [effectiveProductId, form, initialColorId, initialSizeId, message, tForm]);

  const fetchBasePrice = useCallback(
    async (productId, sizeId, colorId) => {
      if (!partnerId || !productId) {
        setBasePrice(undefined);
        setBasePriceError(null);
        return;
      }

      const requestKey = buildCombinationKey(
        partnerId,
        productId,
        sizeId,
        colorId
      );

      if (lastBaseKeyRef.current === requestKey) {
        return;
      }
      lastBaseKeyRef.current = requestKey;

      if (skipInitialFetchRef.current) {
        skipInitialFetchRef.current = false;
        return;
      }

      setBasePriceLoading(true);
      setBasePriceError(null);

      try {
        const filters = cleanFilters({
          partner_id: partnerId,
          product_id: productId,
          size_id: sizeId,
          color_id: colorId,
          customer_id: null,
        });

        const response = await ProductPricesAPI.assigned({
          pagination: { page: 1, pageSize: 2 },
          filters,
        });

        const normalized = normalizeListAndMeta(response);
        const record =
          normalized?.list.length === 1 ? normalized?.list?.[0] : null;

        const nextBasePrice =
          deriveBasePrice(record) ??
          deriveBasePrice(response?.data) ??
          deriveBasePrice(response);

        if (nextBasePrice === undefined) {
          setBasePrice(undefined);
          setBasePriceError(tForm("messages.basePriceNotFound"));
        } else {
          setBasePrice(nextBasePrice);
        }
      } catch (error) {
        setBasePriceError(
          error?.response?.data?.error?.message ||
            tForm("messages.basePriceLoadError")
        );
        setBasePrice(undefined);
      } finally {
        setBasePriceLoading(false);
      }
    },
    [partnerId, tForm]
  );

  useEffect(() => {
    if (!partnerId) {
      setBasePrice(undefined);
      setBasePriceError(tForm("messages.partnerMissing"));
      return;
    }

    if (!effectiveProductId) {
      setBasePrice(undefined);
      setBasePriceError(null);
      return;
    }

    fetchBasePrice(effectiveProductId, effectiveSizeId, effectiveColorId);
  }, [
    effectiveColorId,
    effectiveProductId,
    effectiveSizeId,
    fetchBasePrice,
    partnerId,
    tForm,
  ]);

  const handleFinish = useCallback(
    (values) => {
      const payload = {
        ...values,
        partner_id: partnerId,
        base_price: basePrice,
      };
      onFinish?.(payload);
    },
    [basePrice, onFinish, partnerId]
  );

  const priceValidator = useMemo(
    () => ({
      validator(_, value) {
        if (value === undefined || value === null) {
          return Promise.reject(
            new Error(
              tCommon("validation.required", {
                field: tForm("labels.price"),
              })
            )
          );
        }
        if (basePrice === undefined) {
          return Promise.resolve();
        }
        const numericValue = toNumeric(value);
        if (numericValue === undefined) {
          return Promise.reject(new Error(tForm("validation.invalidPrice")));
        }
        if (numericValue < basePrice) {
          return Promise.reject(
            new Error(
              tForm("validation.priceTooLow", {
                price: formatPrice(basePrice),
              })
            )
          );
        }
        return Promise.resolve();
      },
    }),
    [basePrice, tCommon, tForm]
  );

  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={handleFinish}
      initialValues={initialValues}
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
        name="customer_id"
        label={tForm("labels.customer")}
        rules={[
          {
            required: true,
            message: tCommon("validation.required", {
              field: tForm("labels.customer"),
            }),
          },
        ]}
        disabled={isEdit}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder={tForm("placeholders.customer")}
          options={customers.map((customer) => ({
            value: customer.id,
            label: customer.name,
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
          disabled={!effectiveProductId || isEdit}
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
          disabled={!effectiveProductId || isEdit}
        />
      </Form.Item>

      <Form.Item label={tForm("labels.basePrice")}>
        <Typography.Text strong>
          {basePriceLoading
            ? tForm("labels.loadingBasePrice")
            : formatPrice(basePrice)}
        </Typography.Text>
      </Form.Item>

      {basePriceError ? (
        <Alert
          type="warning"
          message={basePriceError}
          showIcon
          className="mb-4"
        />
      ) : null}

      <Form.Item
        name="price"
        label={tForm("labels.price")}
        rules={[priceValidator]}
      >
        <InputNumber
          min={basePrice ?? 0}
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
