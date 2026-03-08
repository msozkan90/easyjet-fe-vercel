"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import CrudTable from "@/components/common/table/CrudTable";
import { NotificationRulesAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import { translateOrFallback } from "@/components/settings/settings.helpers";

const extractList = (resp) => {
  const payload = resp?.data ?? resp;
  const list =
    payload?.items ?? payload?.data?.data ?? payload?.data ?? payload ?? [];
  return Array.isArray(list) ? list : [];
};

const toEntityContext = (user) => {
  const rawType =
    user?.entity?.entity_type || user?.entity_type || user?.entityType || "";
  const type = String(rawType).toLowerCase();
  const id =
    user?.entity?.id ||
    user?.entity?.uuid ||
    user?.entity_id ||
    user?.entity?.entity_id ||
    user?.entity?.company_id ||
    user?.entity?.partner_id ||
    user?.entity?.customer_id ||
    null;

  if (!id) return null;
  if (!["company", "partner", "customer"].includes(type)) return null;

  return { entity_type: type, entity_id: id };
};

const toRecipientOption = (item) => {
  const id = item?.id || item?.user_id || item?.value;
  const label =
    item?.name ||
    `${item?.first_name || ""} ${item?.last_name || ""}`.trim() ||
    item?.display_name ||
    item?.email ||
    item?.label ||
    String(id || "-");

  return { value: id, label };
};

export default function NotificationSettingsTable({ tSettings }) {
  const { message } = AntdApp.useApp();
  const user = useSelector((state) => state.auth.user);
  const tCommonActions = useTranslations("common.actions");
  const tCommonStatus = useTranslations("common.status");

  const tableRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [form] = Form.useForm();

  const entityContext = useMemo(() => toEntityContext(user), [user]);

  const title = translateOrFallback(
    tSettings,
    "notification.title",
    "Notification Settings"
  );

  const typeOptions = useMemo(
    () => [
      { value: "STOCK_THRESHOLD_NOTIFICATION", label: "Stock Notification" },
    ],
    []
  );

  const channelOptions = useMemo(
    () => [
      { value: "email", label: "Email" },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      {
        value: "active",
        label: translateOrFallback(tCommonStatus, "active", "Active"),
      },
      {
        value: "inactive",
        label: translateOrFallback(tCommonStatus, "inactive", "Inactive"),
      },
    ],
    [tCommonStatus]
  );

  const request = useMemo(
    () =>
      makeListRequest(
        NotificationRulesAPI.list,
        {
          defaultSort: [{ field: "created_at", direction: "desc" }],
          filterMap: {},
        },
        normalizeListAndMeta
      ),
    []
  );

  const loadRecipientUsers = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const resp = await NotificationRulesAPI.listRecipientUsers();
      const options = extractList(resp)
        .map(toRecipientOption)
        .filter((item) => !!item.value);
      setRecipientOptions(options);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          translateOrFallback(
            tSettings,
            "notification.messages.loadRecipientsError",
            "Recipient users could not be loaded."
          )
      );
      setRecipientOptions([]);
    } finally {
      setLoadingRecipients(false);
    }
  }, [message, tSettings]);

  useEffect(() => {
    loadRecipientUsers();
  }, [loadRecipientUsers]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setEditingRow(null);
    form.resetFields();
  }, [form]);

  const handleCreateClick = useCallback(() => {
    if (!entityContext) {
      message.error(
        translateOrFallback(
          tSettings,
          "notification.messages.entityContextMissing",
          "Entity information is missing for notification creation."
        )
      );
      return;
    }

    setEditingRow(null);
    form.resetFields();
    form.setFieldsValue({
      notification_type: "STOCK_THRESHOLD_NOTIFICATION",
      channel: "email",
      status: "active",
      recipient_user_ids: [],
      check_interval_minutes: undefined,
    });
    setOpen(true);
  }, [entityContext, form, message, tSettings]);

  const handleEditClick = useCallback(
    (record) => {
      const recipientUserIds = Array.isArray(record?.recipients)
        ? record.recipients
            .map((item) => item?.user_id || item?.user?.id)
            .filter(Boolean)
        : Array.isArray(record?.recipient_user_ids)
        ? record.recipient_user_ids
        : [];

      setEditingRow(record);
      form.setFieldsValue({
        notification_type: record?.notification_type,
        channel: record?.channel || "email",
        recipient_user_ids: recipientUserIds,
        check_interval_minutes: record?.check_interval_minutes,
        status: record?.status || "active",
      });
      setOpen(true);
    },
    [form]
  );

  const handleDelete = useCallback(
    async (record) => {
      try {
        await NotificationRulesAPI.remove(record.id);
        message.success(
          translateOrFallback(
            tSettings,
            "notification.messages.deleteSuccess",
            "Notification rule deleted."
          )
        );
        tableRef.current?.reload();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            translateOrFallback(
              tSettings,
              "notification.messages.deleteError",
              "Notification rule could not be deleted."
            )
        );
      }
    },
    [message, tSettings]
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingRow) {
        const payload = {
          channel: values.channel || undefined,
          recipient_user_ids: values.recipient_user_ids,
          check_interval_minutes: values.check_interval_minutes || undefined,
          status: values.status || undefined,
        };

        await NotificationRulesAPI.update(editingRow.id, payload);
        message.success(
          translateOrFallback(
            tSettings,
            "notification.messages.updateSuccess",
            "Notification rule updated."
          )
        );
      } else {
        if (!entityContext) {
          message.error(
            translateOrFallback(
              tSettings,
              "notification.messages.entityContextMissing",
              "Entity information is missing for notification creation."
            )
          );
          return;
        }

        const payload = {
          notification_type: values.notification_type,
          channel: values.channel || undefined,
          entity_type: entityContext.entity_type,
          entity_id: entityContext.entity_id,
          recipient_user_ids: values.recipient_user_ids,
          check_interval_minutes: values.check_interval_minutes || undefined,
          status: values.status || undefined,
        };

        await NotificationRulesAPI.create(payload);
        message.success(
          translateOrFallback(
            tSettings,
            "notification.messages.createSuccess",
            "Notification rule created."
          )
        );
      }

      closeModal();
      tableRef.current?.setPage(1);
      tableRef.current?.reload();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.error?.message ||
          translateOrFallback(
            tSettings,
            "notification.messages.operationFailed",
            "Notification operation failed."
          )
      );
    } finally {
      setSubmitting(false);
    }
  }, [closeModal, editingRow, entityContext, form, message, tSettings]);

  const columns = useMemo(
    () => [
      {
        title: translateOrFallback(tSettings, "notification.table.type", "Type"),
        dataIndex: "notification_type",
        key: "notification_type",
        filter: {
          type: "select",
          placeholder: translateOrFallback(
            tSettings,
            "notification.filters.type",
            "Select type"
          ),
          options: typeOptions,
        },
        render: (value) =>
          typeOptions.find((item) => item.value === value)?.label || value || "-",
      },
      {
        title: translateOrFallback(tSettings, "notification.table.channel", "Channel"),
        dataIndex: "channel",
        key: "channel",
        filter: {
          type: "select",
          placeholder: translateOrFallback(
            tSettings,
            "notification.filters.channel",
            "Select channel"
          ),
          options: channelOptions,
        },
        render: (value) => <Tag color="geekblue">{value || "-"}</Tag>,
      },
      {
        title: translateOrFallback(
          tSettings,
          "notification.table.recipients",
          "Recipients"
        ),
        dataIndex: "recipient_user_ids",
        key: "recipient_user_ids",
        render: (value, record) => {
          const recipients = Array.isArray(record?.recipients)
            ? record.recipients
                .map((item) =>
                  `${item?.user?.first_name || ""} ${item?.user?.last_name || ""}`.trim() ||
                  item?.user?.email ||
                  item?.name
                )
                .filter(Boolean)
            : [];

          if (recipients.length > 0) {
            return recipients.join(", ");
          }

          if (Array.isArray(value) && value.length > 0) {
            return `${value.length}`;
          }

          return "-";
        },
      },
      {
        title: translateOrFallback(tSettings, "notification.table.status", "Status"),
        dataIndex: "status",
        key: "status",
        filter: {
          type: "select",
          placeholder: translateOrFallback(
            tSettings,
            "notification.filters.status",
            "Select status"
          ),
          options: statusOptions,
        },
        render: (value) => {
          const normalized = String(value || "").toLowerCase();
          return normalized === "active" ? (
            <Tag color="green">{translateOrFallback(tCommonStatus, "active", "Active")}</Tag>
          ) : (
            <Tag color="red">
              {translateOrFallback(tCommonStatus, "inactive", "Inactive")}
            </Tag>
          );
        },
      },
      {
        title: translateOrFallback(
          tSettings,
          "notification.table.createdAt",
          "Created At"
        ),
        dataIndex: "created_at",
        key: "created_at",
        sorter: true,
        render: (value) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-"),
      },
      {
        title: translateOrFallback(
          tSettings,
          "notification.table.actions",
          "Actions"
        ),
        key: "actions",
        width: 220,
        render: (_, record) => (
          <Space>
            <Button icon={<EditOutlined />} onClick={() => handleEditClick(record)}>
              {translateOrFallback(tCommonActions, "edit", "Edit")}
            </Button>
            <Popconfirm
              title={translateOrFallback(
                tSettings,
                "notification.actions.confirmDelete",
                "Delete this notification rule?"
              )}
              okText={translateOrFallback(tCommonActions, "delete", "Delete")}
              cancelText={translateOrFallback(tCommonActions, "cancel", "Cancel")}
              onConfirm={() => handleDelete(record)}
            >
              <Button icon={<DeleteOutlined />} danger>
                {translateOrFallback(tCommonActions, "delete", "Delete")}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      channelOptions,
      handleDelete,
      handleEditClick,
      statusOptions,
      tCommonActions,
      tCommonStatus,
      tSettings,
      typeOptions,
    ]
  );

  return (
    <>
      <CrudTable
        ref={tableRef}
        rowKey="id"
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          notification_type: undefined,
          channel: undefined,
          status: undefined,
        }}
        toolbarRight={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClick}>
            {translateOrFallback(tSettings, "notification.actions.create", "Create")}
          </Button>
        }
        tableProps={{ locale: { emptyText: title }, scroll: { x: true } }}
      />

      <Modal
        title={
          editingRow
            ? translateOrFallback(
                tSettings,
                "notification.modal.editTitle",
                "Edit Notification Rule"
              )
            : translateOrFallback(
                tSettings,
                "notification.modal.createTitle",
                "Create Notification Rule"
              )
        }
        open={open}
        onCancel={closeModal}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={translateOrFallback(
              tSettings,
              "notification.fields.type",
              "Notification Type"
            )}
            name="notification_type"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select
              options={typeOptions}
              disabled={!!editingRow}
              placeholder={translateOrFallback(
                tSettings,
                "notification.placeholders.type",
                "Select notification type"
              )}
            />
          </Form.Item>

          <Form.Item
            label={translateOrFallback(tSettings, "notification.fields.channel", "Channel")}
            name="channel"
          >
            <Select
              options={channelOptions}
              placeholder={translateOrFallback(
                tSettings,
                "notification.placeholders.channel",
                "Select channel"
              )}
            />
          </Form.Item>

          <Form.Item
            label={translateOrFallback(
              tSettings,
              "notification.fields.recipients",
              "Recipient Users"
            )}
            name="recipient_user_ids"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              loading={loadingRecipients}
              options={recipientOptions}
              placeholder={translateOrFallback(
                tSettings,
                "notification.placeholders.recipients",
                "Select recipient users"
              )}
            />
          </Form.Item>

          <Form.Item
            label={translateOrFallback(
              tSettings,
              "notification.fields.checkInterval",
              "Check Interval (minutes)"
            )}
            name="check_interval_minutes"
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label={translateOrFallback(tSettings, "notification.fields.status", "Status")}
            name="status"
          >
            <Select options={statusOptions} />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingRow
                ? translateOrFallback(tCommonActions, "save", "Save")
                : translateOrFallback(tCommonActions, "add", "Add")}
            </Button>
            <Button onClick={closeModal}>
              {translateOrFallback(tCommonActions, "cancel", "Cancel")}
            </Button>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
