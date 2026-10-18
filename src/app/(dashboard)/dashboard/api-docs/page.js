"use client";

import RequireRole from "@/components/common/Access/RequireRole";
import ApiDocsPage from "@/components/api-docs/ApiDocsPage";

export default function ApiDocsRoute() {
  return (
    <RequireRole anyOfRoles={["customeradmin", "systemadmin"]}>
      <ApiDocsPage />
    </RequireRole>
  );
}
