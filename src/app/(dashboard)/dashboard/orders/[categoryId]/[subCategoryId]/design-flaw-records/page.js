import DesignFlawRecordsPage from "@/components/orders/design-flaws/DesignFlawRecordsPage";

export default function SubCategoryDesignFlawRecordsPage({ params }) {
  return (
    <DesignFlawRecordsPage
      categoryId={params?.categoryId}
      subCategoryId={params?.subCategoryId}
    />
  );
}
