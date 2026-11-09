"use client";

import OrdersPdfWithRexvenTabs from "@/components/orders/rexven/OrdersPdfWithRexvenTabs";

export default function SubCategoryOrdersPdfPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  return <OrdersPdfWithRexvenTabs categoryId={categoryId} subCategoryId={subCategoryId} />;
}
