"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Button, Result, Skeleton } from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import ApiDocsPage from "@/components/api-docs/ApiDocsPage";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";
import { hasAnyRole } from "@/utils/rbac";

/** Customers see the docs only once SystemAdmin has enabled their API access. */
function RequireApiAccess({ children }) {
  const user = useSelector((s) => s.auth.user);
  const tForbidden = useTranslations("rbac.forbidden");
  const isSystemAdmin = hasAnyRole(user, ["systemadmin"]);
  const [enabled, setEnabled] = useState(isSystemAdmin ? true : null);

  useEffect(() => {
    if (isSystemAdmin) {
      setEnabled(true);
      return;
    }
    let canceled = false;
    ApiKeysAPI.access()
      .then((resp) => {
        if (!canceled) setEnabled(Boolean(resp?.data?.enabled));
      })
      .catch(() => {
        if (!canceled) setEnabled(false);
      });
    return () => {
      canceled = true;
    };
  }, [isSystemAdmin]);

  if (enabled === null) return <Skeleton active paragraph={{ rows: 6 }} />;
  if (!enabled) {
    return (
      <Result
        status="403"
        title="403"
        subTitle={tForbidden("subtitle")}
        extra={
          <Button type="primary" href="/dashboard">
            {tForbidden("backToDashboard")}
          </Button>
        }
      />
    );
  }
  return children;
}

export default function ApiDocsRoute() {
  return (
    <RequireRole anyOfRoles={["customeradmin", "systemadmin"]}>
      <RequireApiAccess>
        <ApiDocsPage />
      </RequireApiAccess>
    </RequireRole>
  );
}
