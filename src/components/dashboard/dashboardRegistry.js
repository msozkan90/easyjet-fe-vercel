import CompanyCompletedWorkerTransferDashboard from "./worker/CompanyCompletedWorkerTransferDashboard";
import CompanyShipmentWorkerTransferDashboard from "./worker/CompanyShipmentWorkerTransferDashboard";
import CompanyCompletedWorkerOperationsDashboard from "./CompanyCompletedWorkerOperationsDashboard";
import NormalProductionUrgencyDashboard from "./NormalProductionUrgencyDashboard";
import CompanyShipmentWorkerOperationsDashboard from "./CompanyShipmentWorkerOperationsDashboard";

const normalize = (value) => String(value || "").trim().toLowerCase();

const categoryNames = (user) =>
  (user?.user_categories || []).map((category) =>
    normalize(typeof category === "string" ? category : category?.name),
  );

const hasTransferCategory = (user) =>
  categoryNames(user).some((name) => name === "transfer" || name === "transfers");

const hasStandardCategory = (user) =>
  categoryNames(user).some((name) => ["print", "apparel", "engraving"].includes(name));

const registry = [
  {
    key: "company_admin_normal_production",
    matches: (user) => (user?.roles || []).includes("companyadmin"),
    Component: NormalProductionUrgencyDashboard,
  },
  {
    key: "company_completed_worker_operations",
    matches: (user) =>
      (user?.roles || []).includes("companycompletedworker") &&
      hasStandardCategory(user) &&
      hasTransferCategory(user),
    Component: CompanyCompletedWorkerOperationsDashboard,
  },
  {
    key: "company_completed_worker_normal",
    matches: (user) =>
      (user?.roles || []).includes("companycompletedworker") && hasStandardCategory(user),
    Component: NormalProductionUrgencyDashboard,
  },
  {
    key: "company_completed_worker_transfer",
    matches: (user) =>
      (user?.roles || []).includes("companycompletedworker") &&
      hasTransferCategory(user),
    Component: CompanyCompletedWorkerTransferDashboard,
  },
  {
    key: "company_shipment_worker_operations",
    matches: (user) =>
      (user?.roles || []).includes("companyshipmentworker") &&
      hasStandardCategory(user) &&
      hasTransferCategory(user),
    Component: CompanyShipmentWorkerOperationsDashboard,
  },
  {
    key: "company_shipment_worker_normal",
    matches: (user) =>
      (user?.roles || []).includes("companyshipmentworker") && hasStandardCategory(user),
    Component: NormalProductionUrgencyDashboard,
  },
  {
    key: "company_shipment_worker_transfer",
    matches: (user) =>
      (user?.roles || []).includes("companyshipmentworker") &&
      hasTransferCategory(user),
    Component: CompanyShipmentWorkerTransferDashboard,
  },
];

export function resolveDashboard(user) {
  return registry.find((entry) => entry.matches(user)) || null;
}
