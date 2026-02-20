"use client";

import EntityPermissionsPage from "@/components/common/permissions/EntityPermissionsPage";
import { EntityPermissionsAPI } from "@/utils/api";

export default function PartnerPermissionsPage() {
  return (
    <EntityPermissionsPage
      listApi={EntityPermissionsAPI.partnerList}
      getPermissionsApi={EntityPermissionsAPI.getPartnerPermissions}
      updatePermissionsApi={EntityPermissionsAPI.updatePartnerPermissions}
      translationKey="dashboard.partnerPermissions"
    />
  );
}
