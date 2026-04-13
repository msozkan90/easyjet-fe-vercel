"use client";

import TransferOrdersStatusListPage from "../../orders/TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";

export default function AffiliatedTransferProductionOrdersPage() {
  return (
    <TransferOrdersStatusListPage
      listApiFn={TransferOrdersAPI.affilatedProductionItemsList}
      allowedStatuses={["processing", "downloaded"]}
      initialFilters={{ status: ["processing", "downloaded"] }}
      requireRoles={["companyAdmin", "companyShipmentWorker"]}
    />
  );
}
