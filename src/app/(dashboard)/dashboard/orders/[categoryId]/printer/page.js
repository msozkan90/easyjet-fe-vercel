import PrinterOrderSearchPage from "@/components/orders/PrinterOrderSearchPage";

export default function CategoryPrinterPage({ params }) {
  const { categoryId } = params || {};
  return <PrinterOrderSearchPage categoryId={categoryId} />;
}
