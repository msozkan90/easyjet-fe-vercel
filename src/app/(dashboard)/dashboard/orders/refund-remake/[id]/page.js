"use client";

import RefundRemakeRequestDetailPage from "@/components/orders/refund-remake/RefundRemakeRequestDetailPage";

export default function CustomerRefundRemakeRequestDetailPage() {
  return (
    <RefundRemakeRequestDetailPage
      requireRoles={["customerAdmin"]}
      backHref="/dashboard/orders/refund-remake"
      allowStatusActions={false}
    />
  );
}
