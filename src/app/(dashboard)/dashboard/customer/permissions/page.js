"use client";

import EntityPermissionsPage from "@/components/common/permissions/EntityPermissionsPage";
import { EntityPermissionsAPI } from "@/utils/api";

export default function CustomerPermissionsPage() {
  return (
    <EntityPermissionsPage
      listApi={EntityPermissionsAPI.customerList}
      getPermissionsApi={EntityPermissionsAPI.getCustomerPermissions}
      updatePermissionsApi={EntityPermissionsAPI.updateCustomerPermissions}
      translationKey="dashboard.customerPermissions"
    />
  );
}
