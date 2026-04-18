"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import moment from "moment";
import { App as AntdApp, Button, Form, Popconfirm, Popover, Space } from "antd";
import {
  CheckCircleFilled,
  CloseCircleOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  EditOutlined,
  UploadOutlined,
  PlusOutlined,
  DollarOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import ShippingRatesModal from "@/components/modals/ShippingRatesModal";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import OrdersStatusListPage from "../OrdersStatusListPage";

const PENDING_STATUSES = ["newOrder", "waitingForDesign"];

const formatAmount = (value, fallback) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
};

export default function PendingOrdersPage() {
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
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [shippingModalRecord, setShippingModalRecord] = useState(null);

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
    [rowActionLoading]
  );

  const hasDesignAsset = useCallback((record) => {
    if (!record) return false;
    if (record.hasImage !== undefined) {
      return Boolean(record.hasImage);
    }
    if (record.has_image !== undefined) {
      return Boolean(record.has_image);
    }
    return Array.isArray(record?.designs) && record.designs.length > 0;
  }, []);

  const shouldShowShippingRates = useCallback(
    (record) => {
      if (!record || record.__isChild) return false;
      const orderId = record?.order?.id ?? record?.order_id;
      if (!orderId) return false;
      const relatedItems = [
        record,
        ...(Array.isArray(record.children) ? record.children : []),
      ];
      if (!relatedItems.length) return false;
      return relatedItems.every((item) => hasDesignAsset(item));
    },
    [hasDesignAsset]
  );

  const handleShippingModalClose = useCallback(() => {
    setShippingModalOpen(false);
    setShippingModalRecord(null);
  }, []);

  const handleShippingSendSuccess = useCallback(() => {
    handleShippingModalClose();
    tableRef.current?.reload?.();
  }, [handleShippingModalClose, tableRef]);

  const handleOpenShippingModal = useCallback((record) => {
    if (!record) return;
    setShippingModalRecord(record);
    setShippingModalOpen(true);
  }, []);

  const setAddressFormValues = useCallback(
    (orderData = {}) => {
      editForm.setFieldsValue({
        bill_to_name: orderData?.bill_to_name || "",
        ship_to_street1: orderData?.ship_to_street1 || "",
        ship_to_street2: orderData?.ship_to_street2 || "",
        ship_to_street3: orderData?.ship_to_street3 || "",
        ship_to_city: orderData?.ship_to_city || "",
        ship_to_state: orderData?.ship_to_state || "",
        ship_to_postal_code: orderData?.ship_to_postal_code || "",
        ship_to_country: orderData?.ship_to_country || "",
      });
    },
    [editForm]
  );

  const handleEditModalClose = useCallback(() => {
    setEditModalOpen(false);
    setEditingRecord(null);
    setEditingDetail(null);
    setEditModalLoading(false);
    editForm.resetFields();
  }, [editForm]);

  const handleAddressSelect = useCallback(
    (payload) => {
      if (!payload) return;
      const updates = {};
      if (payload.street1 !== undefined) {
        updates.ship_to_street1 = payload.street1;
      }
      if (payload.street2 !== undefined) {
        updates.ship_to_street2 = payload.street2;
      }
      if (payload.street3 !== undefined) {
        updates.ship_to_street3 = payload.street3;
      }
      if (payload.city !== undefined) {
        updates.ship_to_city = payload.city;
      }
      if (payload.state !== undefined) {
        updates.ship_to_state = payload.state;
      }
      if (payload.postalCode !== undefined) {
        updates.ship_to_postal_code = payload.postalCode;
      }
      if (payload.country !== undefined) {
        updates.ship_to_country = payload.country;
      }
      if (Object.keys(updates).length) {
        editForm.setFieldsValue(updates);
      }
    },
    [editForm]
  );

  const handleOpenAddressEditor = useCallback(
    async (record) => {
      if (
        !record?.id &&
        (record?.status !== "newOrder" || record?.status !== "waitingForDesign")
      )
        return;
      setEditingRecord(record);
      setEditModalOpen(true);
      setEditModalLoading(true);
      setEditingDetail(null);
      setAddressFormValues(record?.order || {});
      try {
        const response = await OrdersAPI.details(record.id);
        const detail = response?.data;
        setEditingDetail(detail);
        if (detail?.order) {
          setAddressFormValues(detail.order);
        }
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.addressLoadError")
        );
        handleEditModalClose();
      } finally {
        setEditModalLoading(false);
      }
    },
    [handleEditModalClose, message, setAddressFormValues, t]
  );

  const handleAddressSave = useCallback(async () => {
    const orderId = editingDetail?.order?.id ?? editingRecord?.order?.id;
    if (!orderId) {
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
      ship_to_street3: toNullableString(values.ship_to_street3),
      ship_to_city: toNullableString(values.ship_to_city),
      ship_to_state: toNullableString(values.ship_to_state),
      ship_to_postal_code: toNullableString(values.ship_to_postal_code),
      ship_to_country: toNullableString(values.ship_to_country),
    };
    setEditModalSaving(true);
    try {
      await OrdersAPI.updateOrder(orderId, payload);
      setShippingModalRecord((prev) => {
        if (!prev) return prev;
        const prevOrderId = prev?.order?.id ?? prev?.order_id;
        if (prevOrderId !== orderId) return prev;
        const nextOrder = {
          ...(prev.order || {}),
          bill_to_name: payload.bill_to_name,
          ship_to_street1: payload.ship_to_street1,
          ship_to_street2: payload.ship_to_street2,
          ship_to_street3: payload.ship_to_street3,
          ship_to_city: payload.ship_to_city,
          ship_to_state: payload.ship_to_state,
          ship_to_postal_code: payload.ship_to_postal_code,
          ship_to_country: payload.ship_to_country,
        };
        return { ...prev, order: nextOrder };
      });
      message.success(t("messages.addressUpdateSuccess"));
      handleEditModalClose();
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.addressUpdateError")
      );
    } finally {
      setEditModalSaving(false);
    }
  }, [
    editForm,
    editingDetail,
    editingRecord,
    handleEditModalClose,
    message,
    setShippingModalRecord,
    tableRef,
    t,
  ]);

  const handleStatusUpdate = useCallback(
    async (record, status) => {
      if (!record?.id || !status) return;
      const actionKey = status === "cancel" ? "cancel" : status;
      setRowActionLoadingState(record.id, actionKey, true);
      try {
        await OrdersAPI.update({
          items: [
            {
              id: record.id,
              status,
            },
          ],
        });
        message.success(t("messages.statusUpdateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.statusUpdateError")
        );
      } finally {
        setRowActionLoadingState(record.id, actionKey, false);
      }
    },
    [message, setRowActionLoadingState, t]
  );

  const editingOrder = useMemo(
    () => editingDetail?.order ?? editingRecord?.order ?? null,
    [editingDetail, editingRecord]
  );

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.hasDesign"),
        dataIndex: "hasImage",
        render: (value) =>
          value ? (
            <CheckCircleFilled
              style={{ color: "green", fontWeight: "bold", fontSize: "28px" }}
            />
          ) : (
            <CloseCircleOutlined
              style={{ color: "red", fontWeight: "bold", fontSize: "28px" }}
            />
          ),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 190,
        render: (_, record) => {
          const rowId = record?.id;
          const cancelLoading = isRowActionLoading(rowId, "cancel");
          const waitingLoading = isRowActionLoading(rowId, "waitingForDesign");
          const newOrderLoading = isRowActionLoading(rowId, "newOrder");
          const disableActions = !rowId || cancelLoading || waitingLoading;
          const showWaitingAction = record?.status === "newOrder";
          const showNewOrderAction = record?.status === "waitingForDesign";
          const allowedDesignStatuses = new Set(PENDING_STATUSES);
          const canShowDesignAction =
            allowedDesignStatuses.has(record?.status) &&
            Boolean(record?.order?.id) &&
            Boolean(rowId);
          const canEditRecord =
            (record?.status === "newOrder" ||
              record?.status === "waitingForDesign") &&
            Boolean(record?.order?.id);
          const orderNumber =
            record?.order?.order_number || record?.order_number;
          const canViewDetail = !record?.__isChild && Boolean(orderNumber);
          const hasDesignImage =
            record?.hasImage ??
            record?.has_image ??
            Boolean(record?.designs?.length);
          let designPageHref = "";
          if (canShowDesignAction) {
            designPageHref = `/dashboard/orders/design/${rowId}`;
          }
          const detailHref = canViewDetail
            ? `/dashboard/order/detail/${orderNumber}`
            : "";
          const showShippingRatesAction =
            record?.status === "newOrder" && shouldShowShippingRates(record);
          return (
            <Space wrap>
              <Popover content={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  type="default"
                  disabled={!canViewDetail}
                  href={detailHref}
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
              {canShowDesignAction ? (
                <Popover
                  content={
                    hasDesignImage
                      ? t("actions.designUpdate")
                      : t("actions.designUpload")
                  }
                >
                  <Button
                    icon={<UploadOutlined />}
                    type="default"
                    variant="solid"
                    style={{
                      backgroundColor: hasDesignImage ? "#808080" : "#1677ff",
                      color: "#fff",
                      borderColor: hasDesignImage ? "#808080" : "#1677ff",
                    }}
                    href={designPageHref}
                    target="_blank"
                    rel="noreferrer"
                  />
                </Popover>
              ) : null}
              {showShippingRatesAction ? (
                <Popover content={t("actions.shippingRates")}>
                  <Button
                    icon={<DollarOutlined />}
                    type="default"
                    onClick={() => handleOpenShippingModal(record)}
                  />
                </Popover>
              ) : null}
              <Popover content={t("actions.cancel")}>
                <Popconfirm
                  title={t("actions.confirmCancelTitle")}
                  okText={t("actions.confirmCancelOk")}
                  okButtonProps={{
                    danger: true,
                    loading: cancelLoading,
                  }}
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
                    okButtonProps={{
                      type: "primary",
                      loading: waitingLoading,
                    }}
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
                    okButtonProps={{
                      type: "primary",
                      loading: newOrderLoading,
                    }}
                    disabled={disableActions}
                    onConfirm={() => handleStatusUpdate(record, "newOrder")}
                  >
                    <Button
                      icon={<PlusOutlined />}
                      type="primary"
                      color="primary"
                      variant="solid"
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
      handleOpenAddressEditor,
      handleOpenShippingModal,
      handleStatusUpdate,
      isRowActionLoading,
      shouldShowShippingRates,
      t,
    ]
  );

  const formatDateTime = useCallback(
    (value) => (value ? moment(value).format("LLL") : t("common.none")),
    [t]
  );

  return (
    <>
      <OrdersStatusListPage
        listApiFn={OrdersAPI.pendingItemsList}
        allowedStatuses={PENDING_STATUSES}
        enableStatusFilter
        columnsBuilder={columnsBuilder}
        tableRefExternal={tableRef}
      />
      <ShippingRatesModal
        open={shippingModalOpen}
        record={shippingModalRecord}
        onClose={handleShippingModalClose}
        onSendSuccess={handleShippingSendSuccess}
        formatAmount={formatAmount}
        onEditAddress={handleOpenAddressEditor}
      />
      <AddressEditorModal
        open={editModalOpen}
        loading={editModalLoading}
        saving={editModalSaving}
        onCancel={handleEditModalClose}
        onSave={handleAddressSave}
        editForm={editForm}
        editingOrder={editingOrder}
        onAddressSelect={handleAddressSelect}
        orderDateLabel={formatDateTime(editingOrder?.order_date)}
        zIndex={1500}
      />
    </>
  );
}
