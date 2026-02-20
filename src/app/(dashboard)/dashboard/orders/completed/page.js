"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function CompletedOrdersPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.completedItemsList}
      allowedStatuses={["completed"]}
    />
  );
}
