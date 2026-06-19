import PrinterOrderSearchPage from "@/components/orders/PrinterOrderSearchPage";

export default function SubCategoryReportScrapePage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  return (
    <PrinterOrderSearchPage
      categoryId={categoryId}
      subCategoryId={subCategoryId}
      mode="reportScrape"
    />
  );
}
