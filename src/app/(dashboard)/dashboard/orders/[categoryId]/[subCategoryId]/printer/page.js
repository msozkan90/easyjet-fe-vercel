import PrinterOrderSearchPage from "@/components/orders/PrinterOrderSearchPage";

export default function SubCategoryPrinterPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  return (
    <PrinterOrderSearchPage
      categoryId={categoryId}
      subCategoryId={subCategoryId}
    />
  );
}
