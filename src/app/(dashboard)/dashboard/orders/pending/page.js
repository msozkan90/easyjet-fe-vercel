"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { useSelector } from "react-redux";
import { App as AntdApp, Button, Form } from "antd";
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
  RetweetOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import StatusTag from "@/components/ui/StatusTag";
import RowActions from "@/components/ui/RowActions";
import { palette } from "@/theme/tokens";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import ShippingRatesModal from "@/components/modals/ShippingRatesModal";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import OrderDesignModal from "@/components/modals/OrderDesignModal";
import OrderItemRematchModal from "@/components/modals/OrderItemRematchModal";
import ManualOrderModal from "@/components/modals/ManualOrderModal";
import OrdersStatusListPage from "../OrdersStatusListPage";
import { useOrderDesignUploadQueue } from "@/components/orders/OrderDesignUploadQueueProvider";
import { hasAnyRole } from "@/utils/rbac";

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
  const { message, modal } = AntdApp.useApp();
  const user = useSelector((state) => state.auth.user);
  const { tasks: designUploadTasks } = useOrderDesignUploadQueue();
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
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [designModalRecord, setDesignModalRecord] = useState(null);
  const [rematchRecord, setRematchRecord] = useState(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const handledDesignUploadIdsRef = useRef(new Set());
  const isCustomerAdmin = hasAnyRole(user, ["customerAdmin"]);

  useEffect(() => {
    let hasNewSuccess = false;
    for (const task of designUploadTasks || []) {
      if (task?.status !== "success") continue;
      if (handledDesignUploadIdsRef.current.has(task.id)) continue;
      handledDesignUploadIdsRef.current.add(task.id);
      hasNewSuccess = true;
    }
    if (hasNewSuccess) {
      tableRef.current?.reload?.();
    }
  }, [designUploadTasks]);

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
    [hasDesignAsset],
  );

  const handleShippingModalClose = useCallback(() => {
    setShippingModalOpen(false);
    setShippingModalRecord(null);
  }, []);

  const handleShippingSendSuccess = useCallback(() => {
    handleShippingModalClose();
    tableRef.current?.reload?.();
  }, [handleShippingModalClose, tableRef]);

  const handleOpenShippingModal = useCallback(
    (record) => {
      if (!record) return;
      const pendingPoolItems = Number(
        record?.pool_completion_summary?.pending_items || 0,
      );
      if (pendingPoolItems > 0) {
        message.warning(
          t("messages.poolIncomplete", { count: pendingPoolItems }),
        );
        return;
      }
      setShippingModalRecord(record);
      setShippingModalOpen(true);
    },
    [message, t],
  );

  const handleOpenDesignModal = useCallback((record) => {
    if (!record?.id) return;
    setDesignModalRecord(record);
    setDesignModalOpen(true);
  }, []);

  const handleDesignModalClose = useCallback(() => {
    setDesignModalOpen(false);
    setDesignModalRecord(null);
  }, []);

  const handleDesignSaved = useCallback(
    (result) => {
      handleDesignModalClose();
      if (!result?.queued) {
        tableRef.current?.reload?.();
      }
    },
    [handleDesignModalClose],
  );

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
    [editForm],
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
    [editForm],
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
          t("messages.addressUpdateError"),
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
            t("messages.statusUpdateError"),
        );
      } finally {
        setRowActionLoadingState(record.id, actionKey, false);
      }
    },
    [message, setRowActionLoadingState, t],
  );

  const handleRematchSaved = useCallback(() => {
    setRematchRecord(null);
    tableRef.current?.reload?.();
  }, []);

  const editingOrder = useMemo(
    () => editingDetail?.order ?? editingRecord?.order ?? null,
    [editingDetail, editingRecord],
  );

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.poolStatus"),
        key: "pool_status",
        width: 190,
        render: (_, record) => {
          if (record?.__isChild) return null;
          const pendingPoolItems = Number(
            record?.pool_completion_summary?.pending_items || 0,
          );
          return pendingPoolItems > 0 ? (
            <StatusTag tone="waiting">
              {t("pool.pendingItems", { count: pendingPoolItems })}
            </StatusTag>
          ) : (
            <StatusTag tone="success">{t("pool.complete")}</StatusTag>
          );
        },
      },
      {
        title: t("columns.hasDesign"),
        dataIndex: "hasImage",
        align: "center",
        render: (value) =>
          value ? (
            <CheckCircleFilled
              role="img"
              aria-label={t("columns.hasDesign")}
              style={{ color: palette.success, fontSize: 20 }}
            />
          ) : (
            <CloseCircleOutlined
              role="img"
              aria-label={t("columns.hasDesign")}
              style={{ color: palette.danger, fontSize: 20 }}
            />
          ),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 210,
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
          const canRematch =
            isCustomerAdmin &&
            record?.status === "newOrder" &&
            !hasDesignImage &&
            Boolean(rowId);
          const detailHref = canViewDetail
            ? `/dashboard/order/detail/${orderNumber}`
            : "";
          const showShippingRatesAction =
            record?.status === "newOrder" && shouldShowShippingRates(record);
          const pendingPoolItems = Number(
            record?.pool_completion_summary?.pending_items || 0,
          );
          const productionBlocked = pendingPoolItems > 0;
          const designLabel = hasDesignImage
            ? t("actions.designUpdate")
            : t("actions.designUpload");
          const shippingLabel = productionBlocked
            ? t("messages.poolIncomplete", { count: pendingPoolItems })
            : t("actions.shippingRates");
          const confirmStatusUpdate = (status, title, okText, danger) =>
            modal.confirm({
              title,
              okText,
              okButtonProps: { danger },
              onOk: () => handleStatusUpdate(record, status),
            });

          // One contextual action stays visible; the rest live in the menu.
          let primary = null;
          if (canShowDesignAction && !hasDesignImage) {
            primary = {
              key: "design",
              label: designLabel,
              icon: <UploadOutlined />,
              onClick: () => handleOpenDesignModal(record),
            };
          } else if (showShippingRatesAction) {
            primary = {
              key: "shipping",
              label: t("actions.shippingRates"),
              icon: <DollarOutlined />,
              disabled: productionBlocked,
              onClick: () => handleOpenShippingModal(record),
            };
          } else if (canViewDetail) {
            primary = {
              key: "detail",
              label: t("actions.viewDetail"),
              icon: <FileSearchOutlined />,
              href: detailHref,
            };
          }

          const menuItems = [
            primary?.key !== "detail" && {
              key: "detail",
              icon: <FileSearchOutlined />,
              disabled: !canViewDetail,
              label: canViewDetail ? (
                <Link href={detailHref}>{t("actions.viewDetail")}</Link>
              ) : (
                t("actions.viewDetail")
              ),
            },
            {
              key: "address",
              icon: <EditOutlined />,
              disabled: !canEditRecord,
              label: t("actions.editAddress"),
              onClick: () => handleOpenAddressEditor(record),
            },
            canRematch && {
              key: "rematch",
              icon: <RetweetOutlined />,
              label: t("actions.rematch"),
              onClick: () => setRematchRecord(record),
            },
            canShowDesignAction &&
              primary?.key !== "design" && {
                key: "design",
                icon: <UploadOutlined />,
                label: designLabel,
                onClick: () => handleOpenDesignModal(record),
              },
            showShippingRatesAction &&
              primary?.key !== "shipping" && {
                key: "shipping",
                icon: <DollarOutlined />,
                disabled: productionBlocked,
                label: shippingLabel,
                onClick: () => handleOpenShippingModal(record),
              },
            (showWaitingAction || showNewOrderAction) && { type: "divider" },
            showWaitingAction && {
              key: "waiting",
              icon: <ClockCircleOutlined />,
              disabled: disableActions,
              label: t("actions.waitingForDesign"),
              onClick: () =>
                confirmStatusUpdate(
                  "waitingForDesign",
                  t("actions.confirmWaitingTitle"),
                  t("actions.confirmWaitingOk"),
                ),
            },
            showNewOrderAction && {
              key: "newOrder",
              icon: <PlusOutlined />,
              disabled: disableActions || newOrderLoading,
              label: t("actions.newOrder"),
              onClick: () =>
                confirmStatusUpdate(
                  "newOrder",
                  t("actions.confirmNewOrderTitle"),
                  t("actions.confirmNewOrderOk"),
                ),
            },
            { type: "divider" },
            {
              key: "cancel",
              icon: <CloseOutlined />,
              danger: true,
              disabled: disableActions,
              label: t("actions.cancel"),
              onClick: () =>
                confirmStatusUpdate(
                  "cancel",
                  t("actions.confirmCancelTitle"),
                  t("actions.confirmCancelOk"),
                  true,
                ),
            },
          ];

          const actions = primary
            ? [
                {
                  ...primary,
                  tooltip:
                    primary.key === "shipping" && productionBlocked
                      ? shippingLabel
                      : undefined,
                  loading: cancelLoading || waitingLoading || newOrderLoading,
                },
              ]
            : [];

          return <RowActions actions={actions} menuItems={menuItems} />;
        },
      },
    ],
    [
      handleOpenAddressEditor,
      handleOpenDesignModal,
      handleOpenShippingModal,
      handleStatusUpdate,
      isCustomerAdmin,
      isRowActionLoading,
      modal,
      shouldShowShippingRates,
      t,
    ],
  );

  const formatDateTime = useCallback(
    (value) => (value ? moment(value).format("LLL") : t("common.none")),
    [t],
  );

  return (
    <>
      <OrdersStatusListPage
        listApiFn={OrdersAPI.pendingItemsList}
        allowedStatuses={PENDING_STATUSES}
        enableStatusFilter
        columnsBuilder={columnsBuilder}
        tableRefExternal={tableRef}
        toolbarRight={
          isCustomerAdmin ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setManualModalOpen(true)}
            >
              {t("actions.manualOrder")}
            </Button>
          ) : null
        }
      />
      <ManualOrderModal
        open={manualModalOpen}
        onCancel={() => setManualModalOpen(false)}
        onCreated={() => {
          setManualModalOpen(false);
          tableRef.current?.reload?.();
        }}
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
      <OrderDesignModal
        open={designModalOpen}
        orderItemId={designModalRecord?.id}
        onCancel={handleDesignModalClose}
        onSaved={handleDesignSaved}
        zIndex={1500}
      />
      <OrderItemRematchModal
        open={Boolean(rematchRecord)}
        record={rematchRecord}
        onCancel={() => setRematchRecord(null)}
        onSaved={handleRematchSaved}
      />
    </>
  );
}
