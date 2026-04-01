"use client";

import { Result, Button } from "antd";
import { useSelector } from "react-redux";
import { hasAnyRole, can } from "@/utils/rbac";
import Link from "next/link";
import { useTranslations } from "@/i18n/use-translations";

export default function RequireRole({
  anyOfRoles = [],
  anyOfPerms = [],
  anyOfCategories = [],
  children,
}) {
  const user = useSelector((s) => s.auth.user);
  const tForbidden = useTranslations("rbac.forbidden");
  const grantedByRole = anyOfRoles.length === 0 || hasAnyRole(user, anyOfRoles);
  const grantedByPerm =
    anyOfPerms.length === 0 || anyOfPerms.some((p) => can(user, p));
  const categoryNames = new Set(
    (user?.user_categories || [])
      .map((category) => {
        if (!category) return null;
        if (typeof category === "string") return category.trim().toLowerCase();
        return String(category?.name || "").trim().toLowerCase();
      })
      .filter(Boolean),
  );
  const grantedByCategory =
    anyOfCategories.length === 0 ||
    anyOfCategories.some((name) =>
      categoryNames.has(String(name || "").trim().toLowerCase()),
    );
  const granted = grantedByRole && grantedByPerm && grantedByCategory;

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
