"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function ShippedOrdersPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.shippedItemsList}
      allowedStatuses={["shipped"]}
    />
  );
}
