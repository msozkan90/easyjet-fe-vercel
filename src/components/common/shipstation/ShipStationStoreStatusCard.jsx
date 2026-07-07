"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { App as AntdApp, Button, Tooltip } from "antd";
import {
  CheckCircleFilled,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { ShipStationAPI } from "@/utils/api";

const DATE_FORMATS = [
  moment.ISO_8601,
  "M-D-YYYY",
  "MM-DD-YYYY",
  "M/D/YYYY",
  "MM/DD/YYYY",
  "M/D/YYYY h:mm A",
  "MM/DD/YYYY h:mm A",
];

const formatRefreshDate = (value, t) => {
  if (!value) return t("shipStationStatus.neverUpdated");
  const parsed = moment(value, DATE_FORMATS, true);
  if (!parsed.isValid()) {
    const fallback = moment(value);
    if (!fallback.isValid()) return String(value);
    return fallback.format("MM/DD/YYYY h:mm A");
  }
  return parsed.format("MM/DD/YYYY h:mm A");
};

export default function ShipStationStoreStatusCard({ storeId, customerName, t }) {
  const { message } = AntdApp.useApp();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = useMemo(
    () => customerName?.trim() || "ShipStation",
    [customerName]
  );

  const loadStatus = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const response = await ShipStationAPI.storeRefreshStatus(storeId);
      setStatus(response?.data ?? response ?? null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.storeRefreshStatusError")
      );
    } finally {
      setLoading(false);
    }
  }, [message, storeId, t]);

  useEffect(() => {
    setStatus(null);
    if (!storeId) return;
    loadStatus();
  }, [loadStatus, storeId]);

  const handleRefresh = useCallback(async () => {
    if (!storeId || refreshing) return;
    setRefreshing(true);
    try {
      await ShipStationAPI.refreshStore(storeId);
      message.success(t("messages.storeRefreshQueued"));
      await loadStatus();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.storeRefreshError")
      );
    } finally {
      setRefreshing(false);
    }
  }, [loadStatus, message, refreshing, storeId, t]);

  if (!storeId) return null;

  const lastUpdated = formatRefreshDate(status?.refreshDate, t);

  return (
    <div className="flex min-w-[240px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
        <img
          src="/assets/logos/ss_logo.png"
          alt="ShipStation"
          className="h-6 w-6 object-contain"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-semibold leading-tight text-slate-900">
          {displayName}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <CheckCircleFilled className="text-sm text-emerald-500" />
          <span className="truncate">
            {t("shipStationStatus.lastUpdated", { date: lastUpdated })}
          </span>
          {loading && <LoadingOutlined className="text-xs text-slate-400" />}
        </div>
      </div>

      <Tooltip title={t("shipStationStatus.refreshAction")}>
        <Button
          type="text"
          shape="circle"
          size="middle"
          aria-label={t("shipStationStatus.refreshAction")}
          icon={
            refreshing ? (
              <LoadingOutlined className="text-base" />
            ) : (
              <ReloadOutlined className="text-base" />
            )
          }
          onClick={handleRefresh}
          disabled={refreshing}
        />
      </Tooltip>
    </div>
  );
}
