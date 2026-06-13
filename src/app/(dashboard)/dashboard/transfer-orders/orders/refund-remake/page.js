"use client";

import RefundRemakeRequestsListPage from "@/components/orders/refund-remake/RefundRemakeRequestsListPage";
import { TransferRefundRemakeRequestsAPI } from "@/utils/api";

export default function TransferRefundRemakeRequestsPage() {
  return (
    <RefundRemakeRequestsListPage
      requireRoles={["customerAdmin", "customerWorker"]}
      basePath="/dashboard/transfer-orders/orders/refund-remake"
      listApi={TransferRefundRemakeRequestsAPI}
      orderFilterKey="transfer_order_id"
      orderResponseKey="transfer_order"
    />
  );
}
