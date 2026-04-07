"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Form, Popconfirm, Popover, Space } from "antd";
import { EditOutlined, FileSearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import { TransferOrdersAPI } from "@/utils/api";
import TransferOrdersStatusListPage from "../TransferOrdersStatusListPage";

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
};

export default function CancelTransferOrdersPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const tableRef = useRef(null);
  const [editForm] = Form.useForm();
  const [rowActionLoading, setRowActionLoading] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingDetail, setEditingDetail] = useState(null);

  const setRowActionLoadingState = useCallback((rowId, action, nextState) => {
    if (!rowId || !action) return;
    const key = `${rowId}-${action}`;
    setRowActionLoading((prev) => {
      if (!nextState) {
        if (!prev?.[key]) return prev;
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      if (prev?.[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

  const isRowActionLoading = useCallback(
    (rowId, action) => Boolean(rowActionLoading?.[`${rowId}-${action}`]),
    [rowActionLoading],
  );

  const setAddressFormValues = useCallback(
    (orderData = {}) => {
      editForm.setFieldsValue({
        bill_to_name: orderData?.bill_to_name || "",
        ship_to_street1: orderData?.ship_to_street1 || "",
        ship_to_street2: orderData?.ship_to_street2 || "",
        ship_to_city: orderData?.ship_to_city || "",
        ship_to_state: orderData?.ship_to_state || "",
        ship_to_postal_code: orderData?.ship_to_postal_code || "",
        ship_to_country: orderData?.ship_to_country || "",
      });
    },
    [editForm],
  );

  const handleEditModalClose = useCallback(() => {
    setEditModalOpen(false);
    setEditingRecord(null);
    setEditingDetail(null);
    setEditModalLoading(false);
    editForm.resetFields();
  }, [editForm]);

  const handleOpenAddressEditor = useCallback(
    async (record) => {
      const orderNumber = record?.order_number;
      if (!orderNumber) return;
      setEditingRecord(record);
      setEditModalOpen(true);
      setEditModalLoading(true);
      try {
        const response = await TransferOrdersAPI.detail(orderNumber);
        const detail = response?.data;
        setEditingDetail(detail);
        setAddressFormValues(detail || {});
      } catch (error) {
        message.error(error?.response?.data?.error?.message || t("messages.addressLoadError"));
        handleEditModalClose();
      } finally {
        setEditModalLoading(false);
      }
    },
    [handleEditModalClose, message, setAddressFormValues, t],
  );

  const handleAddressSave = useCallback(async () => {
    const transferOrderId = editingDetail?.id ?? editingRecord?.transfer_order_id;
    if (!transferOrderId) return;
    let values;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const payload = {
      bill_to_name: toNullableString(values.bill_to_name),
      ship_to_street1: toNullableString(values.ship_to_street1),
      ship_to_street2: toNullableString(values.ship_to_street2),
      ship_to_city: toNullableString(values.ship_to_city),
      ship_to_state: toNullableString(values.ship_to_state),
      ship_to_postal_code: toNullableString(values.ship_to_postal_code),
      ship_to_country: toNullableString(values.ship_to_country),
    };
    setEditModalSaving(true);
    try {
      await TransferOrdersAPI.update(transferOrderId, payload);
      message.success(t("messages.addressUpdateSuccess"));
      handleEditModalClose();
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.addressUpdateError"));
    } finally {
      setEditModalSaving(false);
    }
  }, [editForm, editingDetail, editingRecord, handleEditModalClose, message, t]);

  const handleStatusUpdate = useCallback(
    async (record, status) => {
      if (!record?.id || !status) return;
      setRowActionLoadingState(record.id, status, true);
      try {
        await TransferOrdersAPI.updateItem(record.id, { status });
        message.success(t("messages.statusUpdateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(error?.response?.data?.error?.message || t("messages.statusUpdateError"));
      } finally {
        setRowActionLoadingState(record.id, status, false);
      }
    },
    [message, setRowActionLoadingState, t],
  );

  const editingOrder = useMemo(() => editingDetail ?? editingRecord ?? null, [editingDetail, editingRecord]);

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 150,
        render: (_, record) => {
          const isParentRow = Boolean(record?.__hasChildren) && !record?.__isChild;
          const rowId = record?.id;
          const newOrderLoading = isRowActionLoading(rowId, "newOrder");
          const canUpdateItem = !isParentRow && Boolean(rowId);
          const disableActions = !canUpdateItem || newOrderLoading;
          const canEditRecord = Boolean(record?.transfer_order_id);
          const orderNumber = record?.order_number;
          return (
            <Space wrap>
              <Popover content={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  type="default"
                  disabled={!orderNumber}
                  href={orderNumber ? `/dashboard/transfer-orders/orders/${orderNumber}` : ""}
                />
              </Popover>
              <Popover content={t("actions.editAddress")}>
                <Button
                  icon={<EditOutlined />}
                  type="default"
                  disabled={!canEditRecord}
                  onClick={() => handleOpenAddressEditor(record)}
                />
              </Popover>
              <Popover content={t("actions.newOrder")}>
                <Popconfirm
                  title={t("actions.confirmNewOrderTitle")}
                  okText={t("actions.confirmNewOrderOk")}
                  okButtonProps={{ type: "primary", loading: newOrderLoading }}
                  disabled={disableActions}
                  onConfirm={() => handleStatusUpdate(record, "newOrder")}
                >
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    loading={newOrderLoading}
                    disabled={disableActions}
                  />
                </Popconfirm>
              </Popover>
            </Space>
          );
        },
      },
    ],
    [handleOpenAddressEditor, handleStatusUpdate, isRowActionLoading, t],
  );

  return (
    <>
      <TransferOrdersStatusListPage
        listApiFn={TransferOrdersAPI.cancelItemsList}
        allowedStatuses={["cancel"]}
        initialFilters={{ status: ["cancel"] }}
        columnsBuilder={columnsBuilder}
        tableRefExternal={tableRef}
      />
      <AddressEditorModal
        open={editModalOpen}
        loading={editModalLoading}
        saving={editModalSaving}
        onCancel={handleEditModalClose}
        onSave={handleAddressSave}
        editForm={editForm}
        editingOrder={editingOrder}
        onAddressSelect={() => {}}
        orderDateLabel={editingOrder?.order_date ? new Date(editingOrder.order_date).toLocaleString() : "-"}
        zIndex={1500}
      />
    </>
  );
}
