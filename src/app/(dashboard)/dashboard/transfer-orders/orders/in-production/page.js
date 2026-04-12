"use client";

import TransferOrdersStatusListPage from "../TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";

export default function TransferInProductionOrdersPage() {
  return (
    <TransferOrdersStatusListPage
      listApiFn={TransferOrdersAPI.productionItemsList}
      allowedStatuses={["processing", "downloaded"]}
      initialFilters={{ status: ["processing", "downloaded"] }}
    />
  );
}
