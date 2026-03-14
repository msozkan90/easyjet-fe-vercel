"use client";

import RefundRemakeRequestsListPage from "@/components/orders/refund-remake/RefundRemakeRequestsListPage";

export default function CompanyRefundRemakeRequestsPage() {
  return (
    <RefundRemakeRequestsListPage
      requireRoles={["companyAdmin"]}
      hideStatusFilter
      basePath="/dashboard/orders/affiliated/refund-remake"
    />
  );
}
