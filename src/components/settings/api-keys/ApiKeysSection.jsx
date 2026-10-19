"use client";

import { useCallback, useEffect, useState } from "react";
import { App as AntdApp, Button, Skeleton } from "antd";
import {
  KeyOutlined,
  PlusOutlined,
  ReadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import StatusTag from "@/components/ui/StatusTag";
import { EmptyState, ErrorState } from "@/components/ui/StateView";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";
import ApiKeySecretModal from "./ApiKeySecretModal";
import ApiKeyTable from "./ApiKeyTable";
import CreateApiKeyModal from "./CreateApiKeyModal";
import WebhooksCard from "./WebhooksCard";

const errorMessage = (error, fallback) =>
  error?.response?.data?.error?.message || fallback;

function Stat({ label, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text">{children}</span>
    </div>
  );
}

export default function ApiKeysSection() {
  const t = useTranslations("dashboard.settings.apiKeys");
  const { message } = AntdApp.useApp();
  const [access, setAccess] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const accessResp = await ApiKeysAPI.access();
      const nextAccess = accessResp?.data ?? null;
      setAccess(nextAccess);
      if (nextAccess?.enabled) {
        const keysResp = await ApiKeysAPI.list();
        setKeys(Array.isArray(keysResp?.data) ? keysResp.data : []);
      } else {
        setKeys([]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreated = (created) => {
    setCreateOpen(false);
    if (created?.api_key) setSecret({ apiKey: created.api_key });
    load();
  };

  const handleRotate = async (key) => {
    try {
      const resp = await ApiKeysAPI.rotate(key.id);
      setSecret({
        apiKey: resp?.data?.api_key,
        rotated: true,
        previousKeyExpiresAt: resp?.data?.previous_key_expires_at,
      });
      load();
    } catch (error) {
      message.error(errorMessage(error, t("messages.rotateError")));
    }
  };

  const handleRevoke = async (key) => {
    try {
      await ApiKeysAPI.revoke(key.id);
      message.success(t("messages.revokeSuccess"));
      load();
    } catch (error) {
      message.error(errorMessage(error, t("messages.revokeError")));
    }
  };

  if (loading && !access) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <ErrorState description={t("messages.loadError")} onRetry={load} />
      </div>
    );
  }

  if (!access?.enabled) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<KeyOutlined />}
          title={t("disabled.title")}
          description={t("disabled.description")}
        />
      </div>
    );
  }

  const limitReached = access.active_keys >= access.max_keys;
  const limits = access.rate_limits_per_minute ?? {};

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="m-0 text-base font-semibold text-text">
              {t("title")}
            </h2>
            <p className="m-0 max-w-[640px] text-[13px] text-text-secondary">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/api-docs">
              <Button icon={<ReadOutlined />}>{t("actions.docs")}</Button>
            </Link>
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              aria-label={t("actions.refresh")}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={limitReached}
              title={
                limitReached
                  ? t("limitReached", { max: access.max_keys })
                  : undefined
              }
              onClick={() => setCreateOpen(true)}
            >
              {t("actions.create")}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-subtle px-4 py-3 md:grid-cols-4">
          <Stat label={t("summary.liveAccess")}>
            <StatusTag
              tone={access.live_enabled ? "success" : "waiting"}
              size="small"
            >
              {access.live_enabled
                ? t("summary.liveEnabled")
                : t("summary.testOnly")}
            </StatusTag>
          </Stat>
          <Stat label={t("summary.activeKeys")}>
            <span className="tabular-nums">
              {access.active_keys} / {access.max_keys}
            </span>
          </Stat>
          <Stat label={t("summary.readLimit")}>
            <span className="tabular-nums">
              {t("summary.perMinute", { count: limits.read ?? 0 })}
            </span>
          </Stat>
          <Stat label={t("summary.writeLimit")}>
            <span className="tabular-nums">
              {t("summary.perMinute", { count: limits.write ?? 0 })}
            </span>
          </Stat>
        </div>

        <ApiKeyTable
          keys={keys}
          loading={loading}
          onRotate={handleRotate}
          onRevoke={handleRevoke}
        />

        <CreateApiKeyModal
          open={createOpen}
          access={access}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
        <ApiKeySecretModal secret={secret} onClose={() => setSecret(null)} />
      </section>
      <WebhooksCard access={access} />
    </div>
  );
}
