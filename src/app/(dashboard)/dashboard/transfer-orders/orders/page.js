"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Form, Popconfirm, Popover, Space } from "antd";
import {
  ClockCircleOutlined,
  CloseOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/i18n/use-translations";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import { TransferOrdersAPI } from "@/utils/api";
import TransferOrdersStatusListPage from "./TransferOrdersStatusListPage";
import { useTransferDesignUploadQueue } from "@/components/transfer-orders/TransferDesignUploadQueueProvider";

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
};

export default function TransferOrdersPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const router = useRouter();
  const { enqueueUploads, tasks: uploadTasks } = useTransferDesignUploadQueue();
  const searchParams = useSearchParams();
  const tableRef = useRef(null);
  const designUploadInputRef = useRef(null);
  const [editForm] = Form.useForm();
  const [rowActionLoading, setRowActionLoading] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingDetail, setEditingDetail] = useState(null);
  const [designUploadTarget, setDesignUploadTarget] = useState(null);
  const handledSuccessUploadIdsRef = useRef(new Set());

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
      setEditingDetail(null);
      try {
        const response = await TransferOrdersAPI.detail(orderNumber);
        const detail = response?.data;
        setEditingDetail(detail);
        setAddressFormValues(detail || {});
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.addressLoadError"),
        );
        handleEditModalClose();
      } finally {
        setEditModalLoading(false);
      }
    },
    [handleEditModalClose, message, setAddressFormValues, t],
  );

  const handleAddressSave = useCallback(async () => {
    const transferOrderId = editingDetail?.id ?? editingRecord?.transfer_order_id;
    if (!transferOrderId) {
      message.error(t("messages.addressMissingOrder"));
      return;
    }
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
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.addressUpdateError"),
      );
    } finally {
      setEditModalSaving(false);
    }
  }, [editForm, editingDetail, editingRecord, handleEditModalClose, message, t]);

  const handleStatusUpdate = useCallback(
    async (record, status) => {
      if (!record?.id || !status) return;
      const actionKey = status === "cancel" ? "cancel" : status;
      setRowActionLoadingState(record.id, actionKey, true);
      try {
        await TransferOrdersAPI.updateItem(record.id, { status });
        message.success(t("messages.statusUpdateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.statusUpdateError"),
        );
      } finally {
        setRowActionLoadingState(record.id, actionKey, false);
      }
    },
    [message, setRowActionLoadingState, t],
  );

  const editingOrder = useMemo(
    () => editingDetail ?? editingRecord ?? null,
    [editingDetail, editingRecord],
  );

  const subCategoryId = useMemo(() => {
    const raw = searchParams?.get("subCategoryId");
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed || undefined;
  }, [searchParams]);

  const fixedFilters = useMemo(
    () => (subCategoryId ? { sub_category_id: subCategoryId } : undefined),
    [subCategoryId],
  );

  const handleOpenDesignUpload = useCallback(
    (record) => {
      if (!subCategoryId) {
        message.error("Sub category is required for design upload.");
        return;
      }
      const transferOrderId = record?.transfer_order_id;
      if (!transferOrderId) return;
      setDesignUploadTarget({
        orderId: transferOrderId,
        orderNumber: record?.order_number || "-",
      });
      designUploadInputRef.current?.click?.();
    },
    [message, subCategoryId],
  );

  const handleDesignUploadInputChange = useCallback(
    (event) => {
      const files = event?.target?.files ? Array.from(event.target.files) : [];
      const target = designUploadTarget;
      event.target.value = "";
      if (!target || !subCategoryId || !files.length) return;
      enqueueUploads({
        orderId: target.orderId,
        orderNumber: target.orderNumber,
        subCategoryId,
        files,
      });
      setDesignUploadTarget(null);
    },
    [designUploadTarget, enqueueUploads, subCategoryId],
  );

  useEffect(() => {
    if (!subCategoryId) return;
    let hasNewSuccess = false;
    for (const task of uploadTasks || []) {
      if (task?.status !== "success") continue;
      if (String(task?.subCategoryId || "") !== String(subCategoryId)) continue;
      if (handledSuccessUploadIdsRef.current.has(task.id)) continue;
      handledSuccessUploadIdsRef.current.add(task.id);
      hasNewSuccess = true;
    }
    if (hasNewSuccess) {
      tableRef.current?.reload?.();
    }
  }, [subCategoryId, uploadTasks]);

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 220,
        render: (_, record) => {
          const isParentRow = Boolean(record?.__hasChildren) && !record?.__isChild;
          const rowId = record?.id;
          const cancelLoading = isRowActionLoading(rowId, "cancel");
          const waitingLoading = isRowActionLoading(rowId, "waitingForDesign");
          const newOrderLoading = isRowActionLoading(rowId, "newOrder");
          const canUpdateItem = !isParentRow && Boolean(rowId);
          const disableActions =
            !canUpdateItem || cancelLoading || waitingLoading || newOrderLoading;
          const showWaitingAction = canUpdateItem && record?.status === "newOrder";
          const showNewOrderAction = canUpdateItem && record?.status === "waitingForDesign";
          const canEditRecord = Boolean(record?.transfer_order_id);
          const canUploadDesign = Boolean(isParentRow && record?.transfer_order_id && subCategoryId);
          const orderNumber = record?.order_number;
          const canViewDetail = Boolean(orderNumber);
          const detailHref = canViewDetail
            ? `/dashboard/transfer-orders/orders/${encodeURIComponent(orderNumber)}`
            : "";

          return (
            <Space wrap>
              <Popover content={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  type="default"
                  disabled={!canViewDetail}
                  onClick={() => {
                    if (!canViewDetail) return;
                    router.push(detailHref);
                  }}
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
              {isParentRow ? (
                <Popover content={t("actions.designUpload")}>
                  <Button
                    icon={<UploadOutlined />}
                    type="default"
                    disabled={!canUploadDesign}
                    onClick={() => handleOpenDesignUpload(record)}
                  />
                </Popover>
              ) : null}
              <Popover content={t("actions.cancel")}>
                <Popconfirm
                  title={t("actions.confirmCancelTitle")}
                  okText={t("actions.confirmCancelOk")}
                  okButtonProps={{ danger: true, loading: cancelLoading }}
                  disabled={disableActions}
                  onConfirm={() => handleStatusUpdate(record, "cancel")}
                >
                  <Button
                    icon={<CloseOutlined />}
                    type="primary"
                    danger
                    loading={cancelLoading}
                    disabled={disableActions}
                  />
                </Popconfirm>
              </Popover>
              {showWaitingAction ? (
                <Popover content={t("actions.waitingForDesign")}>
                  <Popconfirm
                    title={t("actions.confirmWaitingTitle")}
                    okText={t("actions.confirmWaitingOk")}
                    okButtonProps={{ type: "primary", loading: waitingLoading }}
                    disabled={disableActions}
                    onConfirm={() =>
                      handleStatusUpdate(record, "waitingForDesign")
                    }
                  >
                    <Button
                      icon={<ClockCircleOutlined />}
                      type="primary"
                      color="orange"
                      variant="solid"
                      loading={waitingLoading}
                      disabled={disableActions}
                    />
                  </Popconfirm>
                </Popover>
              ) : null}
              {showNewOrderAction ? (
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
              ) : null}
            </Space>
          );
        },
      },
    ],
    [
      handleOpenDesignUpload,
      handleOpenAddressEditor,
      handleStatusUpdate,
      isRowActionLoading,
      router,
      subCategoryId,
      t,
    ],
  );

  return (
    <>
      <input
        ref={designUploadInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif"
        style={{ display: "none" }}
        onChange={handleDesignUploadInputChange}
      />
      <TransferOrdersStatusListPage
        key={subCategoryId ? `transfer-orders-sub-${subCategoryId}` : "transfer-orders-all"}
        listApiFn={TransferOrdersAPI.pendingItemsList}
        allowedStatuses={["newOrder", "waitingForDesign"]}
        initialFilters={{ status: ["newOrder", "waitingForDesign"] }}
        fixedFilters={fixedFilters}
        showOptionsInsteadOfSku
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
        orderDateLabel={
          editingOrder?.order_date
            ? new Date(editingOrder.order_date).toLocaleString()
            : "-"
        }
        zIndex={1500}
      />
    </>
  );
}
