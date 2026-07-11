"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  SendOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Space, Typography, theme } from "antd";
import { DashboardAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import DashboardDateFilter from "../DashboardDateFilter";
import DashboardSummaryCard from "../DashboardSummaryCard";
import DashboardSubCategoryFilter from "../DashboardSubCategoryFilter";

const Pie = dynamic(() => import("@ant-design/charts").then((mod) => mod.Pie), { ssr: false });
const Column = dynamic(() => import("@ant-design/charts").then((mod) => mod.Column), { ssr: false });
const { Title, Text } = Typography;
const DASHBOARD_CONFIGS = {
  completed: {
    statuses: ["processing", "downloaded", "printed"],
    titleKey: "title",
    subtitleKey: "subtitle",
    trendTitleKey: "charts.dailyTrend",
    unit: "inch",
  },
  shipment: {
    statuses: ["printed", "shipped"],
    titleKey: "shipmentTitle",
    subtitleKey: "shipmentSubtitle",
    trendTitleKey: "charts.shipmentDailyTrend",
    unit: "order",
  },
};

const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export function TransferWorkerDashboard({ variant = "completed" }) {
  const config = DASHBOARD_CONFIGS[variant];
  const t = useTranslations("dashboard.overview");
  const { token } = theme.useToken();
  const [range, setRange] = useState(() => [dayjs().startOf("day"), dayjs().endOf("day")]);
  const [data, setData] = useState(null);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await DashboardAPI.overview({
        start_at: range[0].startOf("day").toDate().toISOString(),
        end_at: range[1].add(1, "day").startOf("day").toDate().toISOString(),
        timezone: browserTimeZone(),
        sub_category_ids: selectedSubCategoryIds,
      });
      setData(response?.data || response);
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || requestError?.message || t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [range, selectedSubCategoryIds, t]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const colors = useMemo(() => ({
    processing: token.colorWarning,
    downloaded: token.colorInfo,
    printed: token.colorSuccess,
    shipped: token.colorPrimary,
  }), [token]);

  const icons = {
    processing: <FieldTimeOutlined />,
    downloaded: <CloudDownloadOutlined />,
    printed: <CheckCircleOutlined />,
    shipped: <SendOutlined />,
    total: <ShoppingOutlined />,
  };

  const distribution = config.statuses.map((status) => ({
    status,
    label: t(`statuses.${status}`),
    value: Number(data?.summary?.[status] || 0),
  }));
  const trend = (data?.series || []).map((item) => ({
    ...item,
    label: t(`statuses.${item.status}`),
  }));
  const hasData = Number(data?.summary?.total || 0) > 0;
  const statusColorList = config.statuses.map((status) => colors[status]);
  const suffix = config.unit === "inch" ? "in" : t("units.order");
  const precision = config.unit === "inch" ? 2 : 0;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card bordered={false} style={{ background: `linear-gradient(135deg, ${token.colorPrimaryBg}, ${token.colorBgContainer})` }}>
        <Row gutter={[24, 20]} align="middle" justify="space-between">
          <Col xs={24} lg={14}>
            <Title level={2} style={{ margin: 0 }}>{t(config.titleKey)}</Title>
            <Text type="secondary">{t(config.subtitleKey)}</Text>
            {data?.meta?.generated_at ? (
              <div><Text type="secondary" style={{ fontSize: 12 }}>{t("lastUpdated", { date: dayjs(data.meta.generated_at).format("DD.MM.YYYY HH:mm") })}</Text></div>
            ) : null}
          </Col>
          <Col xs={24} lg={10}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <DashboardDateFilter value={range} onChange={setRange} t={t} />
              <DashboardSubCategoryFilter
                value={selectedSubCategoryIds}
                options={data?.meta?.available_sub_categories || []}
                onChange={setSelectedSubCategoryIds}
                t={t}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {error ? <Alert type="error" showIcon message={t("messages.loadError")} description={error} action={<Button icon={<ReloadOutlined />} onClick={loadDashboard}>{t("actions.retry")}</Button>} /> : null}

      {loading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
        <>
          <Row gutter={[16, 16]}>
            {config.statuses.map((status) => (
              <Col key={status} xs={24} sm={12} xl={variant === "shipment" ? 8 : 6}>
                <DashboardSummaryCard title={t(`statuses.${status}`)} value={data?.summary?.[status] || 0} color={colors[status]} icon={icons[status]} suffix={suffix} precision={precision} />
              </Col>
            ))}
            <Col xs={24} sm={12} xl={variant === "shipment" ? 8 : 6}>
              <DashboardSummaryCard title={t("statuses.total")} value={data?.summary?.total || 0} color={token.colorPrimary} icon={icons.total} suffix={suffix} precision={precision} />
            </Col>
          </Row>

          {hasData ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={9}><Card title={t("charts.distribution")} bordered={false}><Pie data={distribution} angleField="value" colorField="label" color={statusColorList} innerRadius={0.64} height={320} label={{ text: "value", position: "outside" }} legend={{ color: { position: "bottom" } }} /></Card></Col>
              <Col xs={24} xl={15}><Card title={t(config.trendTitleKey)} bordered={false}><Column data={trend} xField="date" yField="value" colorField="label" color={statusColorList} stack height={320} axis={{ x: { labelAutoHide: true, labelAutoRotate: true }, y: { title: suffix } }} legend={{ color: { position: "bottom" } }} /></Card></Col>
            </Row>
          ) : <Card bordered={false}><Empty description={t("messages.empty")} /></Card>}
        </>
      )}
    </Space>
  );
}

export default function CompanyCompletedWorkerTransferDashboard() {
  return <TransferWorkerDashboard variant="completed" />;
}
