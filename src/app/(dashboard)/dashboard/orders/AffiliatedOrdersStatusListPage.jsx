"use client";

import { useRef, useState } from "react";
import { App as AntdApp, Button, Popconfirm, Space, Tooltip } from "antd";
import { DeleteOutlined, FileSearchOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import OrdersStatusListPage from "./OrdersStatusListPage";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { OrdersAPI } from "@/utils/api";

const fetchProducts = () => fetchGenericList("product");

export default function AffiliatedOrdersStatusListPage({
  requireRoles = ["companyAdmin", "partnerAdmin"],
  enableItemCancel = false,
  ...rest
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const tableRef = useRef(null);
  const [cancelingItemId, setCancelingItemId] = useState(null);
  const roles = useSelector((state) => state.auth.user?.roles || []);
  const isCompanyAdmin = roles.includes("companyadmin");

  const handleCancelItem = async (itemId) => {
    setCancelingItemId(itemId);
    try {
      await OrdersAPI.cancelAffiliatedItem(itemId);
      message.success(t("messages.itemCancelSuccess"));
      await tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.itemCancelError"),
      );
    } finally {
      setCancelingItemId(null);
    }
  };

  const buildAffiliatedColumns = (baseColumns = []) => [
    ...baseColumns,
    {
      title: t("columns.actions"),
      key: "actions",
      fixed: "right",
      width: 120,
      render: (_, record) => {
        const orderNumber = record?.order?.order_number || record?.order_number;
        const canCancel =
          enableItemCancel &&
          isCompanyAdmin &&
          ["pdf", "completed"].includes(record?.status) &&
          Boolean(record?.id);
        const canViewDetail = !record?.__isChild && Boolean(orderNumber);

        if (!canViewDetail && !canCancel) return t("common.none");

        return (
          <Space size="small">
            {canViewDetail ? (
              <Tooltip title={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  href={`/dashboard/order/detail/${orderNumber}`}
                />
              </Tooltip>
            ) : null}
            {canCancel ? (
              <Popconfirm
                title={t("actions.cancelItemConfirmTitle")}
                description={t("actions.cancelItemConfirmDescription")}
                okText={t("actions.cancelItemConfirmOk")}
                cancelText={t("actions.cancelItemConfirmDismiss")}
                okButtonProps={{ danger: true }}
                onConfirm={() => handleCancelItem(record.id)}
              >
                <Tooltip title={t("actions.cancelItem")}>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={cancelingItemId === record.id}
                    disabled={Boolean(cancelingItemId)}
                    aria-label={t("actions.cancelItem")}
                  />
                </Tooltip>
              </Popconfirm>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <OrdersStatusListPage
      {...rest}
      requireRoles={requireRoles}
      columnsBuilder={buildAffiliatedColumns}
      tableRefExternal={tableRef}
      productListFetcher={fetchProducts}
      affilated
      showCustomerColumn
    />
  );
}
