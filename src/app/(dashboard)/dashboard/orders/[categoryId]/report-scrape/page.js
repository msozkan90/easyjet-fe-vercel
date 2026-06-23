import PrinterOrderSearchPage from "@/components/orders/PrinterOrderSearchPage";

export default function CategoryReportScrapePage({ params }) {
  const { categoryId } = params || {};
  return <PrinterOrderSearchPage categoryId={categoryId} mode="reportScrape" />;
}
