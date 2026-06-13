"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Tooltip } from "antd";
import { RedoOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import TransferOrdersStatusListPage from "../TransferOrdersStatusListPage";
import RefundRemakeCreateModal from "@/components/orders/refund-remake/RefundRemakeCreateModal";
import { TransferOrdersAPI, TransferRefundRemakeRequestsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { collectRequestableOrderItemsFromRow } from "@/utils/refundRemakeRequests";

export default function TransferShippedOrdersPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const tableRef = useRef(null);
  const user = useSelector((state) => state.auth.user);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const canCreateRequest = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.some((role) =>
      ["customeradmin", "customerworker"].includes(String(role || "").toLowerCase())
    );
  }, [user?.roles]);

  const responsibleEntityOptions = useMemo(() => {
    const options = [];
    const entityId = user?.entity?.id;
    const entityName = user?.entity?.entity_name;
    if (entityId && entityName) {
      options.push({ value: entityId, label: entityName });
    }
    const companyId = user?.parent_entity?.company?.id;
    const companyName = user?.parent_entity?.company?.name;
    if (companyId && companyName && !options.some((item) => item.value === companyId)) {
      options.push({ value: companyId, label: companyName });
    }
    return options;
  }, [user?.entity?.entity_name, user?.entity?.id, user?.parent_entity?.company?.id, user?.parent_entity?.company?.name]);

  const selectedOrderItems = useMemo(
    () => collectRequestableOrderItemsFromRow(selectedRow),
    [selectedRow]
  );

  const handleOpenCreateModal = useCallback((record) => {
    setSelectedRow(record);
    setModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setModalOpen(false);
    setSelectedRow(null);
  }, []);

  const handleCreateSubmit = useCallback(
    async (payload) => {
      setCreating(true);
      try {
        await TransferRefundRemakeRequestsAPI.create(payload);
        message.success(t("messages.createSuccess"));
        handleCloseCreateModal();
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.createError")
        );
      } finally {
        setCreating(false);
      }
    },
    [handleCloseCreateModal, message, t]
  );

  const rowActionsRenderer = useCallback(
    ({ record, isParentRow }) => {
      if (!isParentRow) return null;
      const orderNumber = record?.order_number;
      const transferOrderId = record?.transfer_order_id || record?.id;
      const canOpenModal =
        canCreateRequest &&
        Boolean(transferOrderId) &&
        collectRequestableOrderItemsFromRow(record).length > 0;

      if (!canCreateRequest) return null;

      return (
        <Tooltip title={t("actions.createRequest")}>
          <Button
            type="primary"
            icon={<RedoOutlined />}
            disabled={!canOpenModal || !orderNumber}
            onClick={() => handleOpenCreateModal(record)}
          />
        </Tooltip>
      );
    },
    [canCreateRequest, handleOpenCreateModal, t]
  );

  return (
    <>
      <TransferOrdersStatusListPage
        listApiFn={TransferOrdersAPI.shippedTransferItemsList}
        allowedStatuses={["shipped"]}
        enableStatusFilter={false}
        initialFilters={{ status: ["shipped"] }}
        requireRoles={["companyAdmin", "customerAdmin", "customerWorker"]}
        rowActionsRenderer={rowActionsRenderer}
        tableRefExternal={tableRef}
      />
      <RefundRemakeCreateModal
        open={modalOpen}
        submitting={creating}
        orderId={selectedRow?.transfer_order_id || selectedRow?.id}
        orderNumber={selectedRow?.order_number}
        orderItems={selectedOrderItems}
        responsibleEntityOptions={responsibleEntityOptions}
        orderFieldName="transfer_order_id"
        onCancel={handleCloseCreateModal}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}
