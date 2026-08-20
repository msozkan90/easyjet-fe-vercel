import DesignFlawItemsPage from "@/components/orders/design-flaws/DesignFlawItemsPage";

export default function CategoryDesignFlawsPage({ params }) {
  return <DesignFlawItemsPage categoryId={params?.categoryId} />;
}
