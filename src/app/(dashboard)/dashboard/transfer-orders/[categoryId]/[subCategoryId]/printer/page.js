import TransferPrinterOrderSearchPage from "../../../orders/TransferPrinterOrderSearchPage";

export default function TransferSubCategoryPrinterPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  return (
    <TransferPrinterOrderSearchPage
      categoryId={categoryId}
      subCategoryId={subCategoryId}
    />
  );
}
