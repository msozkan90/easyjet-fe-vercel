import DesignFlawRecordsPage from "@/components/orders/design-flaws/DesignFlawRecordsPage";

export default function CategoryDesignFlawRecordsPage({ params }) {
  return <DesignFlawRecordsPage categoryId={params?.categoryId} />;
}
