"use client";

import { useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { CustomerGroupsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

export function buildCustomerOptions(customers, groupLabel, labelWithOwner = (label) => label) {
  const groups = new Map();
  for (const { customer_group: group } of customers) {
    if (!group) continue;
    const entry = groups.get(group.id);
    if (entry) entry.count++;
    else groups.set(group.id, { group, count: 1 });
  }

  return [
    ...Array.from(groups.values(), ({ group, count }) => ({
      id: group.id,
      type: "customer_group",
      value: `customer_group:${group.id}`,
      label: labelWithOwner(groupLabel({ name: group.name, count }), group),
    })),
    ...customers.map((customer) => ({
      id: customer.id,
      type: "customer",
      value: `customer:${customer.id}`,
      label: customer.name || customer.id,
    })),
  ];
}

export function customerSelection(value) {
  const [type, id] = String(value || "").split(":");
  if (type === "customer_group" && id) return { customer_group_id: id };
  if (type === "customer" && id) return { customer_id: id };
  return {};
}

export function mapCustomerFilter(filters, key = "customer_id") {
  const { [key]: value, ...rest } = filters;
  if (typeof value !== "string" || !/^(customer|customer_group):/.test(value)) return filters;
  return { ...rest, ...customerSelection(value) };
}

export function useCustomerFilterOptions({
  enabled = true,
  companyId,
  includePartnerCustomers = false,
  activeOnly = false,
  revision = 0,
} = {}) {
  const t = useTranslations("dashboard.customerGroups");
  const { message } = App.useApp();
  const [result, setResult] = useState(null);
  const requestKey = enabled ? JSON.stringify([companyId, includePartnerCustomers, activeOnly, revision]) : null;

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    CustomerGroupsAPI.filterOptions({
      company_id: companyId,
      include_partner_customers: includePartnerCustomers ? "true" : undefined,
      active_only: activeOnly ? "true" : undefined,
    })
      .then((response) => {
        if (active) setResult({ key: requestKey, customers: response?.data ?? [] });
      })
      .catch(() => {
        if (!active) return;
        setResult({ key: requestKey, customers: [] });
        message.error(t("loadError"));
      });
    return () => { active = false; };
  }, [requestKey, companyId, includePartnerCustomers, activeOnly, message, t]);

  const options = useMemo(() => {
    if (!requestKey || result?.key !== requestKey) return [];
    return buildCustomerOptions(
      result.customers,
      (values) => t("groupOption", values),
      (label, group) => {
        const owner = group.partner?.name || group.company?.name;
        return owner ? `${label} · ${owner}` : label;
      },
    );
  }, [requestKey, result, t]);

  return { options, loading: Boolean(requestKey && result?.key !== requestKey) };
}
