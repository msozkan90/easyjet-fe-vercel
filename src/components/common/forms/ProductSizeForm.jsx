"use client";

import { Form, Input, Select, Button } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";

export default function ProductSizeForm({
  initialValues,
  onFinish,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productSize");
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
        ...(isEdit ? {} : { nameList: [""] }),
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
      ) : (
        <Form.List
          name="nameList"
          rules={[
            {
              validator: (_, value) => {
                const cleaned = (value || [])
                  .map((item) => (typeof item === "string" ? item.trim() : ""))
                  .filter(Boolean);
                if (!cleaned.length) {
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
                <div key={key} className="flex gap-2 items-end mb-3">
                  <Form.Item
                    {...restField}
                    name={name}
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
                  onClick={() => add("")}
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
