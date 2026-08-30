"use client";

import AffiliatedOrdersStatusListPage from "../../AffiliatedOrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function AffiliatedProductionOrdersPage() {
  return (
    <AffiliatedOrdersStatusListPage
      listApiFn={OrdersAPI.affiliatedProductionItemsList}
      allowedStatuses={["processing", "pdf"]}
      enableItemCancel
      defaultSort={[
        { field: "status", direction: "asc" },
        { field: "order_date", direction: "asc" },
      ]}
    />
  );
}
