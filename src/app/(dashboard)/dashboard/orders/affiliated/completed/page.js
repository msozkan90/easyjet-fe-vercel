"use client";

import AffiliatedOrdersStatusListPage from "../../AffiliatedOrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function AffiliatedCompletedOrdersPage() {
  return (
    <AffiliatedOrdersStatusListPage
      listApiFn={OrdersAPI.affiliatedCompletedItemsList}
      allowedStatuses={["completed"]}
      enableItemCancel
      showProductionAt
      defaultSort={[
        { field: "production_at", direction: "asc" },
        { field: "id", direction: "asc" },
      ]}
    />
  );
}
