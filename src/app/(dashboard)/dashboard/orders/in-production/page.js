"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function InProductionOrdersPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.productionItemsList}
      allowedStatuses={["processing", "pdf"]}
    />
  );
}
