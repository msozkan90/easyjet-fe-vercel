import { Suspense } from "react";
import CustomerProductCatalogPage from "@/components/products/catalog/CustomerProductCatalogPage";

export default function Page() {
  return (
    <Suspense>
      <CustomerProductCatalogPage />
    </Suspense>
  );
}
