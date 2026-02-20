"use client";

import { useEffect, useMemo, useState } from "react";
import { App as AntdApp, Form, Input, Modal, Select, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import DesignAreaSelector from "@/components/common/forms/DesignAreaSelector";

const getBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const normFile = (event) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

export default function ProductPositionForm({
  initialValues,
  onFinish,
  submitText,
  products = [],
  isEdit = false,
}) {
  const [form] = Form.useForm();
  const { message } = AntdApp.useApp();
  const tCommon = useTranslations("forms.common");
  const tForm = useTranslations("forms.productPosition");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommon("buttons.save");
  const [preview, setPreview] = useState({
    open: false,
    image: "",
    title: "",
  });

  const transformedInitialValues = useMemo(() => {
    if (!initialValues) {
      return { status: "active" };
    }

    const { image_url, image, ...rest } = initialValues;
    const existingFileList = Array.isArray(image) ? image : undefined;

    return {
      status: "active",
      ...rest,
      ...(existingFileList
        ? { image: existingFileList }
        : image_url
        ? {
            image: [
              {
                uid: "-1",
                name: image_url.split("/").pop() || "image",
                status: "done",
                url: image_url,
              },
            ],
          }
        : {}),
    };
  }, [initialValues]);

  useEffect(() => {
    form.setFieldsValue(transformedInitialValues);
  }, [form, transformedInitialValues]);

  const handlePreview = async (file) => {
    if (!file.url && !file.preview) {
      try {
        file.preview = await getBase64(file.originFileObj);
      } catch {
        file.preview = "";
      }
    }
    setPreview({
      open: true,
      image: file.url || file.preview,
      title: file.name || tForm("labels.image"),
    });
  };

  const handlePreviewCancel = () => {
    setPreview((prev) => ({ ...prev, open: false }));
  };

  const uploadButton = (
    <button
      type="button"
      className="flex flex-col items-center justify-center text-blue-600 hover:text-blue-700"
    >
      <PlusOutlined />
      <span className="mt-1 text-xs font-medium">
        {tForm("buttons.selectImage")}
      </span>
    </button>
  );

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={transformedInitialValues}
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

        <Form.Item
          name="image"
          label={tForm("labels.image")}
          valuePropName="fileList"
          getValueFromEvent={normFile}
          rules={[
            {
              validator: (_, value) => {
                const list = extractUploadFileList(value);
                if (!list.length) {
                  return Promise.reject(
                    tCommon("validation.required", {
                      field: tForm("labels.image"),
                    })
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Upload
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            listType="picture-card"
            maxCount={1}
            progress
            onPreview={handlePreview}
            customRequest={({ onSuccess }) => onSuccess?.("ok")}
            beforeUpload={(file) => {
              const isSupportedType = [
                "image/png",
                "image/jpeg",
                "image/jpg",
                "image/webp",
                "image/svg+xml",
              ].includes(file.type);
              if (!isSupportedType) {
                message.error(tForm("messages.invalidImageType"));
                return Upload.LIST_IGNORE;
              }

              const isUnderLimit = file.size / 1024 / 1024 < 5;
              if (!isUnderLimit) {
                message.error(tForm("messages.invalidImageSize"));
                return Upload.LIST_IGNORE;
              }
              return true;
            }}
          >
            {uploadButton}
          </Upload>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(previous, current) =>
            previous.image !== current.image ||
            previous.design_area !== current.design_area
          }
        >
          {({ getFieldValue, setFieldsValue }) => {
            const imageValue = getFieldValue("image");
            const designAreaValue = getFieldValue("design_area");
            const hasImageSelected =
              extractUploadFileList(imageValue).length > 0;
            return (
              <Form.Item
                name="design_area"
                label={tForm("labels.designArea")}
                rules={[
                  {
                    validator: (_, area) => {
                      if (!hasImageSelected) {
                        return Promise.resolve();
                      }
                      if (!area) {
                        return Promise.reject(
                          tCommon("validation.required", {
                            field: tForm("labels.designArea"),
                          })
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <DesignAreaSelector
                  fileList={imageValue}
                  initialImageUrl={initialValues?.image_url}
                  value={designAreaValue}
                  onChange={(next) =>
                    setFieldsValue({ design_area: next || undefined })
                  }
                  disabled={!hasImageSelected}
                />
              </Form.Item>
            );
          }}
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

      <Modal
        open={preview.open}
        title={preview.title}
        footer={null}
        onCancel={handlePreviewCancel}
      >
        {preview.image ? (
          <img
            alt={preview.title}
            src={preview.image}
            style={{ width: "100%" }}
          />
        ) : null}
      </Modal>
    </>
  );
}
