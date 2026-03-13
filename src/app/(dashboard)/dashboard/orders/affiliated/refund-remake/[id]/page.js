"use client";

import RefundRemakeRequestDetailPage from "@/components/orders/refund-remake/RefundRemakeRequestDetailPage";

export default function CompanyRefundRemakeRequestDetailPage() {
  return (
    <RefundRemakeRequestDetailPage
      requireRoles={["companyAdmin"]}
      allowStatusActions
      backHref="/dashboard/orders/affiliated/refund-remake"
    />
  );
}
