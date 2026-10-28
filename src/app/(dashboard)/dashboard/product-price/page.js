import { redirect } from "next/navigation";

// Old address of the customer Product Catalog page; keeps bookmarks working.
export default function Page() {
  redirect("/dashboard/product-catalog");
}
