"use client";

import AffiliatedOrdersStatusListPage from "../../AffiliatedOrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function AffiliatedShippedOrdersPage() {
  return (
    <AffiliatedOrdersStatusListPage
      listApiFn={OrdersAPI.affiliatedShippedItemsList}
      allowedStatuses={["shipped"]}
      showProductionAt
      defaultSort={[
        { field: "production_at", direction: "asc" },
        { field: "id", direction: "asc" },
      ]}
    />
  );
}
