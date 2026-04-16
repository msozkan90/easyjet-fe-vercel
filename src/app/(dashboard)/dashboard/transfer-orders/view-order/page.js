"use client";

import TransferOrdersStatusListPage from "../orders/TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";

export default function TransferOrdersViewOrderPage() {
  return (
    <TransferOrdersStatusListPage
      listApiFn={TransferOrdersAPI.workerShippedItemsList}
      allowedStatuses={["printed", "shipped"]}
      requireRoles={["companyShipmentWorker"]}
    />
  );
}
