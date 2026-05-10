"use client";

import TransferOrdersStatusListPage from "../TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";

export default function TransferShippedOrdersPage() {
  return (
    <TransferOrdersStatusListPage
      listApiFn={TransferOrdersAPI.shippedTransferItemsList}
      allowedStatuses={["shipped"]}
      enableStatusFilter={false}
      initialFilters={{ status: ["shipped"] }}
      requireRoles={["companyAdmin", "customerAdmin"]}
    />
  );
}
