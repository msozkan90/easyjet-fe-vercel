"use client";

import RefundRemakeRequestDetailPage from "@/components/orders/refund-remake/RefundRemakeRequestDetailPage";
import { TransferRefundRemakeRequestsAPI } from "@/utils/api";

export default function TransferRefundRemakeRequestDetailPage() {
  return (
    <RefundRemakeRequestDetailPage
      requireRoles={["customerAdmin", "customerWorker"]}
      backHref="/dashboard/transfer-orders/orders/refund-remake"
      allowStatusActions={false}
      detailApi={TransferRefundRemakeRequestsAPI}
      orderResponseKey="transfer_order"
      orderIdField="transfer_order_id"
    />
  );
}
