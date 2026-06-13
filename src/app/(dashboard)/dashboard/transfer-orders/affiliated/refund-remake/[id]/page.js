"use client";

import RefundRemakeRequestDetailPage from "@/components/orders/refund-remake/RefundRemakeRequestDetailPage";
import { TransferRefundRemakeRequestsAPI } from "@/utils/api";

export default function AffiliatedTransferRefundRemakeRequestDetailPage() {
  return (
    <RefundRemakeRequestDetailPage
      requireRoles={["companyAdmin"]}
      allowStatusActions
      backHref="/dashboard/transfer-orders/affiliated/refund-remake"
      detailApi={TransferRefundRemakeRequestsAPI}
      orderResponseKey="transfer_order"
      orderIdField="transfer_order_id"
    />
  );
}
