"use client";

import { Form, Input, Select, Button, ColorPicker } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";

const HEX_COLOR_REGEX = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const normalizeHex = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || !HEX_COLOR_REGEX.test(trimmed)) return undefined;
  const withoutHash = trimmed.replace(/^#/, "");
  return `#${withoutHash}`.toUpperCase();
};

function HexColorPicker({ value, onChange, ...props }) {
  return (
    <ColorPicker
      value={normalizeHex(value)}
      format="hex"
      allowClear
      showText
      disabledAlpha
      onChange={(color, hex) => {
        const nextValue =
          normalizeHex(hex) ||
          (typeof color?.toHexString === "function"
            ? normalizeHex(color.toHexString())
            : undefined);
        onChange?.(nextValue);
      }}
      onClear={() => onChange?.(undefined)}
      {...props}
    />
  );
}

export default function ProductColorForm({
  initialValues,
  onFinish,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productColor");
  const tActions = useTranslations("common.actions");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        status: "active",
        ...(initialValues || {}),
        ...(isEdit ? {} : { colorList: [{ name: "", hex_code: undefined }] }),
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

      {isEdit ? (
        <>
          <Form.Item
            name="name"
            label={tForm("labels.name")}
            rules={[
              {
                required: true,
                message: tCommon("validation.required", {
                  field: tForm("labels.name"),
                }),
              },
            ]}
          >
            <Input placeholder={tForm("placeholders.name")} />
          </Form.Item>
          <Form.Item name="hex_code" label={tForm("labels.hex")}>
            <HexColorPicker style={{ width: "100%" }} />
          </Form.Item>
        </>
      ) : (
        <Form.List
          name="colorList"
          rules={[
            {
              validator: (_, value) => {
                const entries = Array.isArray(value) ? value : [];
                const hasValidEntry = entries.some((entry) => {
                  const name =
                    typeof entry?.name === "string" ? entry.name.trim() : "";
                  return !!name;
                });
                if (!hasValidEntry) {
                  return Promise.reject(
                    tCommon("validation.required", {
                      field: tForm("labels.name"),
                    })
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }, index) => (
                <div key={key} className="flex flex-wrap gap-2 items-end mb-3">
                  <Form.Item
                    {...restField}
                    name={[name, "name"]}
                    label={index === 0 ? tForm("labels.name") : undefined}
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value || !value.trim()) {
                            return Promise.reject(
                              tCommon("validation.required", {
                                field: tForm("labels.name"),
                              })
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                    className="flex-1 mb-0"
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder={tForm("placeholders.name")} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, "hex_code"]}
                    label={index === 0 ? tForm("labels.hex") : undefined}
                    className="mb-0"
                    style={{ marginBottom: 0, minWidth: "8rem" }}
                  >
                    <HexColorPicker style={{ width: 120 }} />
                  </Form.Item>
                  {fields.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      aria-label={tActions("delete")}
                      onClick={() => remove(name)}
                    />
                  )}
                </div>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ name: "", hex_code: undefined })}
                >
                  {tActions("add")}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      )}

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
