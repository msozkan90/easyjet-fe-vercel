"use client";

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

export default function AffiliatedOrdersStatusListPage({
  requireRoles = ["companyAdmin", "partnerAdmin"],
  ...rest
}) {
  const t = useTranslations("dashboard.orders");
  return (
    <OrdersStatusListPage
      {...rest}
      requireRoles={requireRoles}
      columnsBuilder={buildColumnsWithCustomer(t)}
      productListFetcher={() => fetchGenericList("product")}
      affilated
    />
  );
}
