"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function InProductionOrdersPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.productionItemsList}
      allowedStatuses={["processing", "pdf"]}
      showProductionAt
      defaultSort={[
        { field: "production_at", direction: "asc" },
        { field: "id", direction: "asc" },
      ]}
    />
  );
}
