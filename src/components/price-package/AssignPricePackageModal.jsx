"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { App as AntdApp, Alert, Button, Modal, Radio, Select, Space } from "antd";
import { PricePackagesAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const unwrap = (resp) => resp?.data ?? resp;

/**
 * Assigns a price package to a partner or a direct customer.
 * `target` ({ type: "customer" | "partner", id, name }) fixes who receives the
 * prices; without it the dialog lets the user pick. When the target already
 * has prices for package variations, a second step asks whether to overwrite
 * them or only fill the unpriced variations.
 */
export default function AssignPricePackageModal({
  open,
  onClose,
  target,
  defaultPackageId,
  intro,
  onApplied,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.pricePackage");

  const [packages, setPackages] = useState(null);
  const [totalVariations, setTotalVariations] = useState(0);
  const [targets, setTargets] = useState(null);
  const [packageId, setPackageId] = useState();
  const [targetType, setTargetType] = useState("customer");
  const [targetId, setTargetId] = useState();
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("fill_missing");
  const [busy, setBusy] = useState(false);
  const fixedType = target?.type;
  const fixedId = target?.id;

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPreview(null);
    setMode("fill_missing");
    setPackageId(defaultPackageId);
    setTargetType(fixedType ?? "customer");
    setTargetId(fixedId);

    (async () => {
      try {
        const [pkgResp, targetResp] = await Promise.all([
          PricePackagesAPI.list(),
          fixedId ? Promise.resolve(null) : PricePackagesAPI.targets(),
        ]);
        if (!alive) return;
        const data = unwrap(pkgResp);
        const list = data?.items ?? [];
        setPackages(list);
        setTotalVariations(data?.total_variations ?? 0);
        if (!defaultPackageId && list.length === 1) setPackageId(list[0].id);
        if (targetResp) setTargets(unwrap(targetResp));
      } catch {
        if (alive) {
          setPackages([]);
          message.error(t("messages.loadError"));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, fixedType, fixedId, defaultPackageId, message, t]);

  const targetOptions = useMemo(() => {
    const list = targetType === "partner" ? targets?.partners : targets?.customers;
    return (list ?? []).map((item) => ({ value: item.id, label: item.name }));
  }, [targets, targetType]);

  const targetName =
    target?.name ??
    targetOptions.find((option) => option.value === targetId)?.label ??
    "";

  const targetPayload = () =>
    targetType === "partner" ? { partner_id: targetId } : { customer_id: targetId };

  const runApply = async (applyMode) => {
    const resp = await PricePackagesAPI.apply(packageId, {
      ...targetPayload(),
      mode: applyMode,
    });
    const result = unwrap(resp) ?? {};
    if (!result.created && !result.updated) {
      message.info(t("messages.nothingApplied", { name: targetName }));
    } else {
      message.success(
        t("messages.applySuccess", {
          name: targetName,
          created: result.created ?? 0,
          updated: result.updated ?? 0,
          skipped: result.skipped ?? 0,
        }),
      );
    }
    onApplied?.(result);
    onClose?.();
  };

  const handleOk = async () => {
    if (!targetId) {
      message.warning(t("assign.targetRequired"));
      return;
    }
    if (!packageId) {
      message.warning(t("assign.packageRequired"));
      return;
    }

    setBusy(true);
    try {
      if (preview) {
        await runApply(mode);
        return;
      }
      const next = unwrap(await PricePackagesAPI.preview(packageId, targetPayload()));
      if (!next?.package_variations) {
        message.warning(t("assign.emptyPackage"));
        return;
      }
      if (next.overlapping > 0) {
        setPreview(next);
        return;
      }
      await runApply("fill_missing");
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const noPackages = Array.isArray(packages) && packages.length === 0;

  const footer = noPackages
    ? [
        <Button key="close" onClick={onClose}>
          {intro ? t("assign.skip") : t("editor.cancel")}
        </Button>,
        <Link key="create" href="/dashboard/product-variation/price-packages/new">
          <Button type="primary">{t("assign.createPackage")}</Button>
        </Link>,
      ]
    : [
        preview ? (
          <Button key="back" onClick={() => setPreview(null)} disabled={busy}>
            {t("assign.back")}
          </Button>
        ) : (
          <Button key="close" onClick={onClose} disabled={busy}>
            {intro ? t("assign.skip") : t("editor.cancel")}
          </Button>
        ),
        <Button key="ok" type="primary" loading={busy} onClick={handleOk}>
          {preview ? t("assign.apply") : t("assign.next")}
        </Button>,
      ];

  return (
    <Modal
      title={t("assign.title")}
      open={open}
      onCancel={busy ? undefined : onClose}
      footer={footer}
      destroyOnHidden
    >
      {noPackages ? (
        <Alert type="info" showIcon message={t("assign.noPackages")} />
      ) : preview ? (
        <Space direction="vertical" size={16} className="w-full">
          <div className="text-sm text-text">
            {t("assign.modeQuestion", {
              name: targetName,
              overlapping: preview.overlapping,
            })}
          </div>
          <Radio.Group
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="w-full"
          >
            <Space direction="vertical" size={12} className="w-full">
              <Radio value="fill_missing">
                <div className="font-medium">{t("assign.fillMissing")}</div>
                <div className="text-[13px] text-text-secondary">
                  {t("assign.fillMissingHint", {
                    overlapping: preview.overlapping,
                    missing: preview.missing,
                  })}
                </div>
              </Radio>
              <Radio value="overwrite">
                <div className="font-medium">{t("assign.overwrite")}</div>
                <div className="text-[13px] text-text-secondary">
                  {t("assign.overwriteHint", {
                    total: preview.package_variations,
                    overlapping: preview.overlapping,
                  })}
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      ) : (
        <Space direction="vertical" size={16} className="w-full">
          {intro ? <div className="text-sm text-text">{intro}</div> : null}
          {target ? null : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-text">
                  {t("assign.targetType")}
                </span>
                <Radio.Group
                  optionType="button"
                  value={targetType}
                  onChange={(event) => {
                    setTargetType(event.target.value);
                    setTargetId(undefined);
                  }}
                  options={[
                    { value: "customer", label: t("assign.customer") },
                    { value: "partner", label: t("assign.partner") },
                  ]}
                />
              </div>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t("assign.selectTarget")}
                loading={!targets}
                options={targetOptions}
                value={targetId}
                onChange={setTargetId}
                className="w-full"
                aria-label={t("assign.selectTarget")}
              />
              <div className="text-[12px] text-text-secondary">
                {t("assign.targetHint")}
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text">
              {t("assign.package")}
            </span>
            <Radio.Group
              value={packageId}
              onChange={(event) => setPackageId(event.target.value)}
              className="w-full"
              disabled={!packages}
            >
              <Space direction="vertical" size={8} className="w-full">
                {(packages ?? []).map((pkg) => (
                  <Radio key={pkg.id} value={pkg.id}>
                    <span className="font-medium">{pkg.name}</span>
                    <span className="ml-2 text-[12px] text-text-secondary">
                      {t("coverage", {
                        priced: pkg.priced_variations,
                        total: totalVariations,
                      })}
                    </span>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </div>
        </Space>
      )}
    </Modal>
  );
}
