import TransferPrinterOrderSearchPage from "../../../orders/TransferPrinterOrderSearchPage";

export default function TransferSubCategoryPrinterPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  const isOthers = String(subCategoryId || "").toLowerCase() === "others";
  return (
    <TransferPrinterOrderSearchPage
      categoryId={categoryId}
      subCategoryId={isOthers ? undefined : subCategoryId}
      withoutDesign={isOthers}
    />
  );
}
