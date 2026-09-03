"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Image,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  LinkOutlined,
  ProfileOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { GuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import { useTranslations } from "@/i18n/use-translations";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { fileToDataUrl } from "@/utils/fileToDataUrl";
import { OriginalDesignButton } from "@/components/common/media/DesignThumbnailImage";

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

const normalizeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return rawOptions
      .map((entry) => ({
        name: entry?.name ?? entry?.key ?? "",
        value: entry?.value,
      }))
      .filter((entry) => entry.name || entry.value);
  }
  if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions).map(([name, value]) => ({
      name,
      value: value == null ? "" : String(value),
    }));
  }
  return [];
};

const isExternalUrl = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const renderOptionsSummary = (options, fallback) => (
  <div className="order-options-popover">
    {options.map((option, index) => (
      <div
        key={`${option?.name || "option"}-${index}`}
        className="order-option-row"
      >
        <span className="order-option-label">{option?.name || fallback}</span>
        {isExternalUrl(option?.value || "") ? (
          <a
            href={option.value}
            target="_blank"
            rel="noreferrer"
            className="order-option-link"
          >
            <LinkOutlined />
            <span>{option?.name || fallback}</span>
          </a>
        ) : (
          <span className="order-option-value">{option?.value || fallback}</span>
        )}
      </div>
    ))}
  </div>
);

export default function RefundRemakeCreateModal({
  open,
  submitting = false,
  orderId,
  orderNumber,
  orderItems = [],
  responsibleEntityOptions = [],
  onCancel,
  onSubmit,
  orderFieldName = "order_id",
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const tCommonActions = useTranslations("common.actions");
  const [form] = Form.useForm();
  const [itemSelections, setItemSelections] = useState({});
  const { confirmIfDirty, unsavedChangesModalContextHolder } =
    useUnsavedChangesPrompt();

  useEffect(() => {
    if (!open) return;
    const initial = {};
    (orderItems || []).forEach((item) => {
      if (!item?.orderItemId) return;
      initial[item.orderItemId] = {
        checked: true,
        quantity: item?.initialQuantity || 1,
        maxQuantity: item?.maxQuantity || 1,
        groupSelections: Object.fromEntries(
          (item?.designGroups || []).map((group, index) => [
            group.groupKey,
            { checked: index === 0, quantity: 1 },
          ]),
        ),
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

  const updateGroupSelection = useCallback((orderItemId, groupKey, patch) => {
    setItemSelections((prev) => {
      const item = prev?.[orderItemId] || {};
      return {
        ...prev,
        [orderItemId]: {
          ...item,
          groupSelections: {
            ...(item.groupSelections || {}),
            [groupKey]: {
              ...(item.groupSelections?.[groupKey] || {}),
              ...patch,
            },
          },
        },
      };
    });
  }, []);

  const getSelectedGroupQuantity = useCallback(
    (orderItemId) =>
      Object.values(itemSelections?.[orderItemId]?.groupSelections || {}).reduce(
        (sum, group) =>
          group?.checked ? sum + (Number.parseInt(group?.quantity, 10) || 0) : sum,
        0,
      ),
    [itemSelections],
  );

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
            <GuardedPreviewImage
              src={value}
              alt="order-item"
              width={44}
              height={44}
              openLabel={tCommonActions("open")}
              emptyText={t("common.none")}
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
        render: (value) => {
          const options = normalizeOptions(value);
          if (!options.length) return t("values.noOptions");

          return (
            <Popover
              trigger="hover"
              placement="rightTop"
              content={renderOptionsSummary(options, t("common.none"))}
            >
              <button type="button" className="order-options-trigger">
                <ProfileOutlined />
                <span>{t("create.columns.options")}</span>
                <span className="order-options-count">{options.length}</span>
              </button>
            </Popover>
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
        render: (_, record) =>
          record?.designGroups?.length ? (
            <Tag color="blue">
              {getSelectedGroupQuantity(record.orderItemId)} / {record?.maxQuantity || 1}
            </Tag>
          ) : (
            <InputNumber
              min={1}
              max={record?.maxQuantity || 1}
              precision={0}
              disabled={!itemSelections?.[record.orderItemId]?.checked}
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
    [getSelectedGroupQuantity, itemSelections, t, tCommonActions, updateItemSelection]
  );

  const renderDesignGroups = useCallback(
    (record) => {
      const itemSelection = itemSelections?.[record.orderItemId] || {};
      return (
        <div className="refund-remake-design-groups">
          {(record?.designGroups || []).map((group, index) => {
            const selection = itemSelection?.groupSelections?.[group.groupKey] || {};
            const selected = Boolean(selection.checked) && Boolean(itemSelection.checked);
            return (
              <Card
                key={group.groupKey}
                size="small"
                title={
                  <Checkbox
                    checked={selected}
                    disabled={!itemSelection.checked}
                    onChange={(event) =>
                      updateGroupSelection(record.orderItemId, group.groupKey, {
                        checked: event.target.checked,
                        quantity: selection.quantity || 1,
                      })
                    }
                  >
                    {group.isLegacy
                      ? t("create.groups.legacy")
                      : t("create.groups.number", { number: index + 1 })}
                  </Checkbox>
                }
                extra={
                  <Tag color="blue">
                    {t("create.groups.available", {
                      quantity: group.availableQuantity,
                    })}
                  </Tag>
                }
              >
                <div className="refund-remake-design-group-content">
                  <Space wrap align="start">
                    {(group.positions || []).map((position) => (
                      <Space key={position.id} direction="vertical" size={2}>
                        {position.previewUrl ? (
                          <Image
                            src={position.previewUrl}
                            alt={position.name}
                            width={64}
                            height={64}
                            preview={{ src: position.previewUrl }}
                            style={{ objectFit: "contain", borderRadius: 6 }}
                          />
                        ) : (
                          <div className="refund-remake-design-placeholder">
                            {t("create.groups.previewUnavailable")}
                          </div>
                        )}
                        <Typography.Text>{position.name}</Typography.Text>
                        <OriginalDesignButton url={position.originalUrl} block />
                      </Space>
                    ))}
                  </Space>
                  <Space direction="vertical" size={4}>
                    <Typography.Text>{t("create.groups.quantity")}</Typography.Text>
                    <InputNumber
                      min={1}
                      max={group.availableQuantity}
                      precision={0}
                      disabled={!selected}
                      value={selected ? selection.quantity : null}
                      onChange={(value) =>
                        updateGroupSelection(record.orderItemId, group.groupKey, {
                          quantity: Number.parseInt(value || 1, 10) || 1,
                        })
                      }
                      style={{ width: 160 }}
                    />
                  </Space>
                </div>
              </Card>
            );
          })}
        </div>
      );
    },
    [itemSelections, t, updateGroupSelection],
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
      const item = orderItems.find((entry) => entry.orderItemId === orderItemId);
      const designGroups = Array.isArray(item?.designGroups) ? item.designGroups : [];
      const selectedDesignGroups = designGroups.flatMap((group) => {
        const groupSelection = selection?.groupSelections?.[group.groupKey];
        if (!groupSelection?.checked) return [];
        const quantity = Number.parseInt(groupSelection?.quantity, 10);
        if (
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          quantity > Number(group.availableQuantity || 0)
        ) {
          return [{ invalid: true, group }];
        }
        return [{
          group_key: group.groupKey,
          design_group_id: group.designGroupId,
          quantity,
        }];
      });
      if (designGroups.length && !selectedDesignGroups.length) {
        message.error(t("messages.selectAtLeastOneDesignGroup", { orderItemId }));
        return;
      }
      const invalidGroup = selectedDesignGroups.find((group) => group.invalid);
      if (invalidGroup) {
        message.error(
          t("messages.invalidDesignGroupQuantity", {
            group: invalidGroup.group?.groupKey,
            maxQuantity: invalidGroup.group?.availableQuantity || 0,
          }),
        );
        return;
      }
      const quantity = designGroups.length
        ? selectedDesignGroups.reduce((sum, group) => sum + group.quantity, 0)
        : Number.parseInt(selection?.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > maxQuantity) {
        message.error(
          t("messages.invalidQuantity", {
            orderItemId,
            maxQuantity: maxQuantity || 0,
          })
        );
        return;
      }
      order_items[orderItemId] = {
        quantity,
        ...(designGroups.length ? { design_groups: selectedDesignGroups } : {}),
      };
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
      [orderFieldName]: orderId,
      order_items,
      responsible_entity_id: values.responsible_entity_id,
      request_type: String(values.request_type || "refund").toLowerCase(),
      description: String(values.description || "").trim(),
    };
    if (images.length) {
      payload.images = images;
    }

    await onSubmit?.(payload);
  }, [form, itemSelections, message, onSubmit, orderId, orderItems, t]);

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
    <>
      {unsavedChangesModalContextHolder}
      <Modal
      open={open}
      title={t("create.title")}
      width={980}
      onCancel={() =>
        confirmIfDirty({
          isDirty: form.isFieldsTouched(true),
          onDiscard: onCancel,
        })
      }
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
          expandable={{
            expandedRowRender: renderDesignGroups,
            rowExpandable: (record) => Boolean(record?.designGroups?.length),
            defaultExpandAllRows: true,
          }}
        />
      </Space>
      <style jsx global>{`
        .refund-remake-create-upload .ant-upload-list-item-name {
          display: none !important;
        }
        .refund-remake-design-groups {
          display: grid;
          gap: 12px;
          padding: 4px 0;
        }
        .refund-remake-design-group-content {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px;
          gap: 20px;
          align-items: start;
        }
        .refund-remake-design-placeholder {
          width: 64px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          color: #8c8c8c;
          font-size: 11px;
          text-align: center;
        }
        @media (max-width: 720px) {
          .refund-remake-design-group-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      </Modal>
    </>
  );
}
