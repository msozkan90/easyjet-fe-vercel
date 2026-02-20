"use client";

import EntityPermissionsPage from "@/components/common/permissions/EntityPermissionsPage";
import { EntityPermissionsAPI } from "@/utils/api";

export default function CompanyPermissionsPage() {
  return (
    <EntityPermissionsPage
      listApi={EntityPermissionsAPI.companyList}
      getPermissionsApi={EntityPermissionsAPI.getCompanyPermissions}
      updatePermissionsApi={EntityPermissionsAPI.updateCompanyPermissions}
      translationKey="dashboard.companyPermissions"
    />
  );
}
