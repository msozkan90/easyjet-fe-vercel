"use client";

import OrdersPdfPage from "@/components/orders-pdf/OrdersPdfPage";

export default function CategoryOrdersPdfPage({ params }) {
  const { categoryId } = params || {};
  return <OrdersPdfPage categoryId={categoryId} />;
}
