"use client";

import AffiliatedOrdersStatusListPage from "../../AffiliatedOrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";

export default function AffiliatedShippedOrdersPage() {
  return (
    <AffiliatedOrdersStatusListPage
      listApiFn={OrdersAPI.affiliatedShippedItemsList}
      allowedStatuses={["shipped"]}
      defaultSort={[{ field: "order_date", direction: "desc" }]}
    />
  );
}
