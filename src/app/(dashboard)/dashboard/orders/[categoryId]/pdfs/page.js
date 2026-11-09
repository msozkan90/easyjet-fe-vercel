"use client";

import OrdersPdfWithRexvenTabs from "@/components/orders/rexven/OrdersPdfWithRexvenTabs";

export default function CategoryOrdersPdfPage({ params }) {
  const { categoryId } = params || {};
  return <OrdersPdfWithRexvenTabs categoryId={categoryId} />;
}
