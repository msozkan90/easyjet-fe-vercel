"use client";

import TransferOrdersStatusListPage from "../TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";

export default function TransferPrintedOrdersPage() {
  return (
    <TransferOrdersStatusListPage
      listApiFn={TransferOrdersAPI.printedItemsList}
      allowedStatuses={["printed"]}
      enableStatusFilter={false}
      initialFilters={{ status: ["printed"] }}
      requireRoles={["companyAdmin", "customerAdmin"]}
    />
  );
}
