"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Space, Tooltip } from "antd";
import { FileSearchOutlined, RedoOutlined } from "@ant-design/icons";
import OrdersStatusListPage from "../OrdersStatusListPage";
import RefundRemakeCreateModal from "@/components/orders/refund-remake/RefundRemakeCreateModal";
import { OrdersAPI, RefundRemakeRequestsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { useSelector } from "react-redux";
import { collectRequestableOrderItemsFromRow } from "@/utils/refundRemakeRequests";

export default function ShippedOrdersPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.refundRemake");
  const tableRef = useRef(null);
  const user = useSelector((state) => state.auth.user);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const isCustomerAdmin = useMemo(
    () => Array.isArray(user?.roles) && user.roles.includes("customeradmin"),
    [user?.roles]
  );

  const responsibleEntityOptions = useMemo(() => {
    const options = [];
    const entityId = user?.entity?.id;
    const entityName = user?.entity?.entity_name;
    if (entityId && entityName) {
      options.push({
        value: entityId,
        label: `${entityName} - ${entityId}`,
      });
    }
    const companyId = user?.parent_entity?.company?.id;
    const companyName = user?.parent_entity?.company?.name;
    if (companyId && companyName && !options.some((item) => item.value === companyId)) {
      options.push({
        value: companyId,
        label: `${companyName} - ${companyId}`,
      });
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
        await RefundRemakeRequestsAPI.create(payload);
        message.success(t("messages.createSuccess"));
        handleCloseCreateModal();
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

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 170,
        render: (_, record) => {
          if (record?.__isChild) return null;
          const orderNumber = record?.order?.order_number || record?.order_number;
          const canCreate =
            isCustomerAdmin &&
            Boolean(record?.order?.id || record?.order_id) &&
            collectRequestableOrderItemsFromRow(record).length > 0;
          return (
            <Space>
              <Tooltip title={t("actions.viewOrderDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  disabled={!orderNumber}
                  href={
                    orderNumber ? `/dashboard/order/detail/${orderNumber}` : undefined
                  }
                />
              </Tooltip>
              {isCustomerAdmin ? (
                <Tooltip title={t("actions.createRequest")}>
                  <Button
                    type="primary"
                    icon={<RedoOutlined />}
                    disabled={!canCreate}
                    onClick={() => handleOpenCreateModal(record)}
                  />
                </Tooltip>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [handleOpenCreateModal, isCustomerAdmin, t]
  );

  return (
    <>
      <OrdersStatusListPage
        listApiFn={OrdersAPI.shippedItemsList}
        allowedStatuses={["shipped"]}
        columnsBuilder={columnsBuilder}
        tableRefExternal={tableRef}
      />
      <RefundRemakeCreateModal
        open={modalOpen}
        submitting={creating}
        orderId={selectedRow?.order?.id || selectedRow?.order_id}
        orderNumber={selectedRow?.order?.order_number || selectedRow?.order_number}
        orderItems={selectedOrderItems}
        responsibleEntityOptions={responsibleEntityOptions}
        onCancel={handleCloseCreateModal}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}
