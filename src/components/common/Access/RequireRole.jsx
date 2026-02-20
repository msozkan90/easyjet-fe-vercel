"use client";

import { Result, Button } from "antd";
import { useSelector } from "react-redux";
import { hasAnyRole, can } from "@/utils/rbac";
import Link from "next/link";
import { useTranslations } from "@/i18n/use-translations";

export default function RequireRole({
  anyOfRoles = [],
  anyOfPerms = [],
  children,
}) {
  const user = useSelector((s) => s.auth.user);
  const tForbidden = useTranslations("rbac.forbidden");
  const grantedByRole = anyOfRoles.length === 0 || hasAnyRole(user, anyOfRoles);
  const grantedByPerm =
    anyOfPerms.length === 0 || anyOfPerms.some((p) => can(user, p));
  const granted = grantedByRole && grantedByPerm;

  if (!granted) {
    return (
      <Result
        status="403"
        title="403"
        subTitle={tForbidden("subtitle")}
        extra={
          <Button type="primary">
            <Link href="/dashboard">{tForbidden("backToDashboard")}</Link>
          </Button>
        }
      />
    );
  }
  return children;
}
