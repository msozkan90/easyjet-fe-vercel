"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";

export default function OrdersViewOrderPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.workerShippedItemsList}
      allowedStatuses={["completed", "shipped"]}
      requireRoles={["companyShipmentWorker"]}
      productListFetcher={() => fetchGenericList("product")}
    />
  );
}
