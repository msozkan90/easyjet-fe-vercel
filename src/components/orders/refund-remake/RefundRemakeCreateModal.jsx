"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Checkbox,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { fileToDataUrl } from "@/utils/fileToDataUrl";

const MAX_IMAGE_COUNT = 10;
const MAX_IMAGE_SIZE_MB = 8;
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp";
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const normalizeUploadEvent = (event) => {
  if (Array.isArray(event)) return event;
  return event?.fileList || [];
};

const formatPriceDisplay = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function RefundRemakeCreateModal({
  open,
  submitting = false,
  orderId,
  orderNumber,
  orderItems = [],
  responsibleEntityOptions = [],
  onCancel,
  onSubmit,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const [form] = Form.useForm();
  const [itemSelections, setItemSelections] = useState({});

  useEffect(() => {
    if (!open) return;
    const initial = {};
    (orderItems || []).forEach((item) => {
      if (!item?.orderItemId) return;
      initial[item.orderItemId] = {
        checked: true,
        quantity: item?.initialQuantity || 1,
        maxQuantity: item?.maxQuantity || 1,
      };
    });
    setItemSelections(initial);
    form.setFieldsValue({
      request_type: "refund",
      responsible_entity_id: responsibleEntityOptions?.[0]?.value,
      description: "",
      images: [],
    });
  }, [form, open, orderItems, responsibleEntityOptions]);

  const updateItemSelection = useCallback((orderItemId, patch) => {
    setItemSelections((prev) => ({
      ...prev,
      [orderItemId]: { ...(prev?.[orderItemId] || {}), ...patch },
    }));
  }, []);

  const tableColumns = useMemo(
    () => [
      {
        title: t("create.columns.select"),
        dataIndex: "orderItemId",
        width: 70,
        render: (orderItemId) => (
          <Checkbox
            checked={Boolean(itemSelections?.[orderItemId]?.checked)}
            onChange={(event) =>
              updateItemSelection(orderItemId, { checked: event?.target?.checked })
            }
          />
        ),
      },
      {
        title: t("create.columns.image"),
        dataIndex: "imageUrl",
        width: 78,
        render: (value) =>
          value ? (
            <Image
              src={value}
              alt="order-item"
              width={44}
              height={44}
              style={{ borderRadius: 8, objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#8c8c8c", fontSize: 12 }}>{t("common.none")}</span>
          ),
      },
      {
        title: t("create.columns.item"),
        dataIndex: "productName",
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <span>{record?.productName || t("common.none")}</span>
            <span style={{ color: "#8c8c8c", fontSize: 12 }}>
              {record?.sku || record?.orderItemId}
            </span>
          </Space>
        ),
      },
      {
        title: t("create.columns.options"),
        dataIndex: "options",
        width: 230,
        render: (options) => {
          if (!Array.isArray(options) || options.length === 0) {
            return <span style={{ color: "#8c8c8c" }}>{t("common.none")}</span>;
          }
          return (
            <Space direction="vertical" size={0}>
              {options.map((option, index) => {
                const name = option?.name ?? t("common.none");
                const value = option?.value ?? t("common.none");
                const key = `${name}-${value}-${index}`;
                const displayText = `${name}: ${value}`;
                return (
                  <Tooltip title={displayText} key={key}>
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: 190,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{name}: </span>
                      {value}
                    </span>
                  </Tooltip>
                );
              })}
            </Space>
          );
        },
      },
      {
        title: t("create.columns.maxQuantity"),
        dataIndex: "maxQuantity",
        width: 140,
      },
      {
        title: t("create.columns.quantity"),
        dataIndex: "quantity",
        width: 160,
        render: (_, record) => (
          <InputNumber
            min={1}
            max={record?.maxQuantity || 1}
            precision={0}
            style={{ width: "100%" }}
            value={itemSelections?.[record.orderItemId]?.quantity}
            onChange={(value) =>
              updateItemSelection(record.orderItemId, {
                quantity: Number.parseInt(value || 1, 10) || 1,
              })
            }
          />
        ),
      },
      {
        title: t("create.columns.price"),
        dataIndex: "price",
        width: 130,
        render: (_, record) => formatPriceDisplay(record?.initialPrice),
      },
    ],
    [itemSelections, t, updateItemSelection]
  );

  const handleConfirm = useCallback(async () => {
    if (!orderId) {
      message.error(t("messages.missingOrderId"));
      return;
    }

    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const selectedEntries = Object.entries(itemSelections || {}).filter(
      ([, selection]) => Boolean(selection?.checked)
    );
    if (!selectedEntries.length) {
      message.error(t("messages.selectAtLeastOneItem"));
      return;
    }

    const order_items = {};
    for (const [orderItemId, selection] of selectedEntries) {
      const maxQuantity = Number(selection?.maxQuantity) || 0;
      const quantity = Number.parseInt(selection?.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > maxQuantity) {
        message.error(
          t("messages.invalidQuantity", {
            orderItemId,
            maxQuantity: maxQuantity || 0,
          })
        );
        return;
      }
      order_items[orderItemId] = { quantity };
    }

    const uploadList = extractUploadFileList(values?.images);
    if (uploadList.length > MAX_IMAGE_COUNT) {
      message.error(t("messages.tooManyImages", { max: MAX_IMAGE_COUNT }));
      return;
    }

    let images = [];
    if (uploadList.length) {
      try {
        images = (
          await Promise.all(
            uploadList.map(async (file) => {
              if (!file?.originFileObj) return null;
              return fileToDataUrl(file.originFileObj);
            })
          )
        ).filter(Boolean);
      } catch {
        message.error(t("messages.imageConversionError"));
        return;
      }
    }

    const payload = {
      order_id: orderId,
      order_items,
      responsible_entity_id: values.responsible_entity_id,
      request_type: String(values.request_type || "refund").toLowerCase(),
      description: String(values.description || "").trim(),
    };
    if (images.length) {
      payload.images = images;
    }

    await onSubmit?.(payload);
  }, [form, itemSelections, message, onSubmit, orderId, t]);

  const validateImageFile = useCallback(
    (file) => {
      const isValidType = ACCEPTED_TYPES.has(file?.type);
      if (!isValidType) {
        message.error(t("messages.imageTypeError"));
        return Upload.LIST_IGNORE;
      }
      const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
      if (file?.size > maxBytes) {
        message.error(t("messages.imageSizeError", { maxMb: MAX_IMAGE_SIZE_MB }));
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    [message, t]
  );

  const validateImagesRequired = useCallback(
    async (_, value) => {
      const uploadList = extractUploadFileList(value);
      if (uploadList.length > 0) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(t("validation.imagesRequired")));
    },
    [t]
  );

  return (
    <Modal
      open={open}
      title={t("create.title")}
      width={980}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText={t("create.actions.submit")}
      confirmLoading={submitting}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message={t("create.orderMeta", { orderNumber: orderNumber || orderId })}
        />
        <Form form={form} layout="vertical">
          <Space wrap style={{ width: "100%" }}>
            <Form.Item
              name="request_type"
              label={t("create.fields.requestType")}
              rules={[{ required: true, message: t("validation.requestTypeRequired") }]}
            >
              <Select
                style={{ minWidth: 180 }}
                options={[
                  { value: "refund", label: t("requestType.refund") },
                  { value: "remake", label: t("requestType.remake") },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="responsible_entity_id"
              label={t("create.fields.responsibleEntity")}
              rules={[{ required: true, message: t("validation.responsibleEntityRequired") }]}
            >
              <Select
                style={{ minWidth: 360 }}
                options={responsibleEntityOptions}
                optionFilterProp="label"
                showSearch
              />
            </Form.Item>
          </Space>
          <Form.Item
            name="description"
            label={t("create.fields.description")}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("validation.descriptionRequired"),
              },
              { max: 1000, message: t("validation.descriptionMax") },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={1000}
              placeholder={t("create.placeholders.description")}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="images"
            label={t("create.fields.images")}
            valuePropName="fileList"
            getValueFromEvent={normalizeUploadEvent}
            rules={[{ validator: validateImagesRequired }]}
          >
            <Upload
              className="refund-remake-create-upload"
              multiple
              listType="picture-card"
              maxCount={MAX_IMAGE_COUNT}
              accept={ACCEPT_ATTR}
              beforeUpload={validateImageFile}
              showUploadList={{
                showPreviewIcon: false,
                showRemoveIcon: true,
                showDownloadIcon: false,
              }}
            >
              <Space>
                <UploadOutlined />
                {t("create.actions.upload")}
              </Space>
            </Upload>
          </Form.Item>
        </Form>

        <Table
          rowKey="orderItemId"
          size="small"
          pagination={false}
          columns={tableColumns}
          dataSource={orderItems}
          locale={{ emptyText: t("messages.noOrderItems") }}
          scroll={{ x: true }}
        />
      </Space>
      <style jsx global>{`
        .refund-remake-create-upload .ant-upload-list-item-name {
          display: none !important;
        }
      `}</style>
    </Modal>
  );
}
