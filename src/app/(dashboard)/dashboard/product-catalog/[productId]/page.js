import { Suspense } from "react";
import CustomerProductDetailPage from "@/components/products/catalog/CustomerProductDetailPage";

export default function Page() {
  return (
    <Suspense>
      <CustomerProductDetailPage />
    </Suspense>
  );
}
