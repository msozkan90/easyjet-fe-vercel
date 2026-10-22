"use client";

import RequireRole from "@/components/common/Access/RequireRole";
import ApiAccessAdminPage from "@/components/api-access/ApiAccessAdminPage";

export default function ApiAccessPage() {
  return (
    <RequireRole anyOfRoles={["systemadmin"]}>
      <ApiAccessAdminPage />
    </RequireRole>
  );
}
