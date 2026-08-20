import DesignFlawItemsPage from "@/components/orders/design-flaws/DesignFlawItemsPage";

export default function SubCategoryDesignFlawsPage({ params }) {
  return (
    <DesignFlawItemsPage
      categoryId={params?.categoryId}
      subCategoryId={params?.subCategoryId}
    />
  );
}
