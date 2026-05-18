"use client";

import OrdersPdfPage from "@/components/orders-pdf/OrdersPdfPage";

export default function SubCategoryOrdersPdfPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  return <OrdersPdfPage categoryId={categoryId} subCategoryId={subCategoryId} />;
}
