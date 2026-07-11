import CompanyCompletedWorkerTransferDashboard from "./worker/CompanyCompletedWorkerTransferDashboard";
import CompanyShipmentWorkerTransferDashboard from "./worker/CompanyShipmentWorkerTransferDashboard";

const normalize = (value) => String(value || "").trim().toLowerCase();

const categoryNames = (user) =>
  (user?.user_categories || []).map((category) =>
    normalize(typeof category === "string" ? category : category?.name),
  );

const registry = [
  {
    key: "company_completed_worker_transfer",
    matches: (user) =>
      (user?.roles || []).includes("companycompletedworker") &&
      categoryNames(user).some((name) => name === "transfer" || name === "transfers"),
    Component: CompanyCompletedWorkerTransferDashboard,
  },
  {
    key: "company_shipment_worker_transfer",
    matches: (user) =>
      (user?.roles || []).includes("companyshipmentworker") &&
      categoryNames(user).some((name) => name === "transfer" || name === "transfers"),
    Component: CompanyShipmentWorkerTransferDashboard,
  },
];

export function resolveDashboard(user) {
  return registry.find((entry) => entry.matches(user)) || null;
}
