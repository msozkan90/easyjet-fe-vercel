"use client";

import { Button, Tooltip } from "antd";
import { FileSearchOutlined } from "@ant-design/icons";
import OrdersStatusListPage from "./OrdersStatusListPage";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";

const buildColumnsWithCustomer = (t) => (baseColumns = []) => {
  const customerColumn = {
    title: t("columns.customer"),
    dataIndex: "customer",
    render: (_, record) =>
      record?.order?.customer?.name ||
      record?.customer?.name ||
      record?.order?.customer_name ||
      t("common.none"),
  };
  const insertAt = baseColumns.findIndex(
    (column) => column?.dataIndex === "bill_to_name"
  );
  if (insertAt === -1) {
    return [...baseColumns, customerColumn];
  }
  const nextColumns = [...baseColumns];
  nextColumns.splice(insertAt, 0, customerColumn);
  return nextColumns;
};

const withDetailAction = (t) => (baseColumns = []) => [
  ...baseColumns,
  {
    title: t("columns.actions"),
    key: "actions",
    fixed: "right",
    width: 100,
    render: (_, record) => {
      if (record?.__isChild) return null;
      const orderNumber = record?.order?.order_number || record?.order_number;
      if (!orderNumber) {
        return t("common.none");
      }
      return (
        <Tooltip title={t("actions.viewDetail")}>
          <Button
            icon={<FileSearchOutlined />}
            href={`/dashboard/order/detail/${orderNumber}`}
          />
        </Tooltip>
      );
    },
  },
];

export default function AffiliatedOrdersStatusListPage({
  requireRoles = ["companyAdmin", "partnerAdmin"],
  ...rest
}) {
  const t = useTranslations("dashboard.orders");
  const buildAffiliatedColumns = (baseColumns = []) =>
    withDetailAction(t)(buildColumnsWithCustomer(t)(baseColumns));

  return (
    <OrdersStatusListPage
      {...rest}
      requireRoles={requireRoles}
      columnsBuilder={buildAffiliatedColumns}
      productListFetcher={() => fetchGenericList("product")}
      affilated
    />
  );
}
