"use client";

import AffiliatedOrdersStatusListPage from "../../AffiliatedOrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function AffiliatedProductionOrdersPage() {
  return (
    <AffiliatedOrdersStatusListPage
      listApiFn={OrdersAPI.affiliatedProductionItemsList}
      allowedStatuses={["processing", "pdf"]}
      enableItemCancel
      showProductionAt
      defaultSort={[
        { field: "production_at", direction: "asc" },
        { field: "id", direction: "asc" },
      ]}
    />
  );
}
