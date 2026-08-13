"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function InProductionOrdersPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.productionItemsList}
      allowedStatuses={["processing", "pdf"]}
      defaultSort={[
        { field: "order_date", direction: "asc" },
        { field: "status", direction: "asc" },
      ]}
    />
  );
}
