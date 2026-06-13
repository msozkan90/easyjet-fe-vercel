"use client";

import RefundRemakeRequestsListPage from "@/components/orders/refund-remake/RefundRemakeRequestsListPage";
import { TransferRefundRemakeRequestsAPI } from "@/utils/api";

export default function AffiliatedTransferRefundRemakeRequestsPage() {
  return (
    <RefundRemakeRequestsListPage
      requireRoles={["companyAdmin"]}
      hideStatusFilter
      basePath="/dashboard/transfer-orders/affiliated/refund-remake"
      listApi={TransferRefundRemakeRequestsAPI}
      orderFilterKey="transfer_order_id"
      orderResponseKey="transfer_order"
    />
  );
}
