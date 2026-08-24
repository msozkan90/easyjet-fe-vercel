"use client";

import OrdersStatusListPage from "../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";

const fetchProducts = () => fetchGenericList("product");

export default function OrdersViewOrderPage() {
  return (
    <OrdersStatusListPage
      listApiFn={OrdersAPI.workerShippedItemsList}
      allowedStatuses={["completed", "shipped"]}
      defaultSort={[
        { field: "status", direction: "asc" },
        { field: "order_date", direction: "asc" },
      ]}
      requireRoles={["companyShipmentWorker"]}
      productListFetcher={fetchProducts}
    />
  );
}
