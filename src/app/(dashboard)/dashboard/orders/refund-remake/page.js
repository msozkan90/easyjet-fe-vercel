"use client";

import RefundRemakeRequestsListPage from "@/components/orders/refund-remake/RefundRemakeRequestsListPage";

export default function CustomerRefundRemakeRequestsPage() {
  return (
    <RefundRemakeRequestsListPage
      requireRoles={["customerAdmin"]}
      basePath="/dashboard/orders/refund-remake"
    />
  );
}
