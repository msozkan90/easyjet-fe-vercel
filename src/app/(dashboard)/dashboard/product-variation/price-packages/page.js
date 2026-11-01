"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { App as AntdApp, Button, Card, Popconfirm, Progress, Tooltip } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import PageHeader from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/StateView";
import AssignPricePackageModal from "@/components/price-package/AssignPricePackageModal";
import { PricePackagesAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const NEW_PACKAGE_HREF = "/dashboard/product-variation/price-packages/new";

export default function PricePackagesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.pricePackage");

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [assignPackageId, setAssignPackageId] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const resp = await PricePackagesAPI.list();
      setData(resp?.data ?? resp);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (id) => {
    try {
      await PricePackagesAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      load();
    } catch (err) {
      message.error(
        err?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    }
  };

  const packages = data?.items ?? [];
  const max = data?.max_packages ?? 3;
  const total = data?.total_variations ?? 0;
  const limitReached = packages.length >= max;
  const emptySlots = data ? Math.max(0, max - packages.length) : 0;

  const openAssign = (packageId) => {
    setAssignPackageId(packageId);
    setAssignOpen(true);
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      <PageHeader
        breadcrumb={[
          { title: t("breadcrumb"), href: "/dashboard/product-variation/products" },
          { title: t("title") },
        ]}
        title={t("title")}
        description={t("description", { max })}
        meta={
          data ? (
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-[12px] font-medium text-text-secondary">
              {t("slots", { count: packages.length, max })}
            </span>
          ) : null
        }
        extra={
          <>
            <Button
              icon={<SendOutlined />}
              disabled={!packages.length}
              onClick={() => openAssign(null)}
            >
              {t("actions.assign")}
            </Button>
            <Tooltip title={limitReached ? t("limitReached", { max }) : undefined}>
              {limitReached ? (
                <Button type="primary" icon={<PlusOutlined />} disabled>
                  {t("actions.new")}
                </Button>
              ) : (
                <Link href={NEW_PACKAGE_HREF}>
                  <Button type="primary" icon={<PlusOutlined />}>
                    {t("actions.new")}
                  </Button>
                </Link>
              )}
            </Tooltip>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState description={t("messages.loadError")} onRetry={load} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {!data
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} loading />
              ))
            : null}
          {packages.map((pkg) => {
            const percent = total ? Math.round((pkg.priced_variations / total) * 100) : 0;
            return (
              <Card
                key={pkg.id}
                className="flex flex-col"
                styles={{ body: { display: "flex", flexDirection: "column", gap: 16, flex: 1 } }}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/dashboard/product-variation/price-packages/${pkg.id}`}
                    className="truncate text-[16px] font-semibold text-text! no-underline hover:text-brand-600!"
                  >
                    {pkg.name}
                  </Link>
                  <p className="m-0 line-clamp-2 min-h-[40px] text-[13px] text-text-secondary">
                    {pkg.description || t("noDescription")}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Progress
                    percent={percent}
                    size="small"
                    showInfo={false}
                    strokeColor="var(--color-brand-500)"
                  />
                  <span className="text-[12px] text-text-secondary">
                    {t("coverage", { priced: pkg.priced_variations, total })}
                  </span>
                  <span className="text-[12px] text-text-secondary">
                    {t("updatedAt", { date: dayjs(pkg.updated_at).format("DD.MM.YYYY HH:mm") })}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-end gap-2 border-0 border-t border-solid border-line pt-3">
                  <div className="flex items-center gap-1.5">
                    <Tooltip title={t("actions.edit")}>
                      <Link href={`/dashboard/product-variation/price-packages/${pkg.id}`}>
                        <Button size="small" icon={<EditOutlined />} aria-label={t("actions.edit")} />
                      </Link>
                    </Tooltip>
                    <Popconfirm
                      title={t("actions.confirmDeleteTitle")}
                      description={
                        <div className="max-w-[260px]">{t("actions.confirmDeleteDescription")}</div>
                      }
                      okText={t("actions.confirmDeleteOk")}
                      okButtonProps={{ danger: true }}
                      // Opens below so the button's tooltip (above) never covers it.
                      placement="bottomRight"
                      onConfirm={() => onDelete(pkg.id)}
                    >
                      <Tooltip title={t("actions.delete")}>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={t("actions.delete")}
                        />
                      </Tooltip>
                    </Popconfirm>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => openAssign(pkg.id)}
                    >
                      {t("actions.assignShort")}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, index) => (
            <Link
              key={`slot-${index}`}
              href={NEW_PACKAGE_HREF}
              className="flex min-h-[120px] flex-col md:min-h-[204px] items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-text-secondary! no-underline transition-colors hover:border-brand-500 hover:text-brand-600!"
            >
              <PlusOutlined className="text-xl" />
              <span className="text-[13px] font-medium">{t("actions.new")}</span>
              <span className="text-[12px]">{t("emptySlot")}</span>
            </Link>
          ))}
        </div>
      )}

      <AssignPricePackageModal
        open={assignOpen}
        defaultPackageId={assignPackageId ?? undefined}
        onClose={() => setAssignOpen(false)}
      />
    </RequireRole>
  );
}
