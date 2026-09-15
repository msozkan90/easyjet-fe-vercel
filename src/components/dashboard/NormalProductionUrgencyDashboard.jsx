"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import OrdersStatusListPage from "@/app/(dashboard)/dashboard/orders/OrdersStatusListPage";
import { DashboardAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";

const { Title, Text } = Typography;
const BUCKETS = [
  { key: "overdue_72_plus", color: "#cf1322", background: "#fff1f0", icon: <ExclamationCircleOutlined /> },
  { key: "critical_48_72", color: "#d46b08", background: "#fff7e6", icon: <ClockCircleOutlined /> },
  { key: "warning_24_48", color: "#d4b106", background: "#feffe6", icon: <ClockCircleOutlined /> },
  { key: "action_0_24", color: "#1677ff", background: "#e6f4ff", icon: <ShoppingOutlined /> },
];

const unwrap = (response) => response?.data || response;
const fetchProducts = () => fetchGenericList("product");

const formatDuration = (milliseconds, t) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t("duration", { hours, minutes });
};

export default function NormalProductionUrgencyDashboard() {
  const t = useTranslations("dashboard.overview.urgency");
  const { token } = theme.useToken();
  const roles = useSelector((state) => state.auth.user?.roles || []);
  const [data, setData] = useState(null);
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowedStatuses = useMemo(() => {
    if (roles.includes("companyadmin")) return ["processing", "pdf", "completed"];
    if (roles.includes("companyshipmentworker")) return ["completed"];
    return ["processing", "pdf"];
  }, [roles]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = unwrap(await DashboardAPI.normalProductionUrgency());
      setData(next);
      const nonEmpty = BUCKETS.find(
        ({ key }) => Number(next?.buckets?.find((item) => item.key === key)?.order_count || 0) > 0,
      );
      setSelectedBucket((current) => {
        const currentCount = next?.buckets?.find((item) => item.key === current)?.order_count;
        return current && Number(currentCount || 0) > 0 ? current : nonEmpty?.key || null;
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || requestError?.message || t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const bucketData = useMemo(
    () => new Map((data?.buckets || []).map((item) => [item.key, item])),
    [data],
  );

  const listApiFn = useMemo(() => {
    if (!selectedBucket || !data?.meta?.generated_at) return null;
    return (payload) => DashboardAPI.normalProductionUrgencyItems({
      ...payload,
      bucket: selectedBucket,
      as_of: data.meta.generated_at,
    });
  }, [data?.meta?.generated_at, selectedBucket]);

  const columnsBuilder = useCallback((columns) => {
    const asOf = dayjs(data?.meta?.generated_at);
    const deadlineHours = 72;
    const productionIndex = columns.findIndex((column) => column.dataIndex === "production_at");
    const timingColumns = [
      {
        title: t("table.elapsed"),
        key: "elapsed_time",
        width: 130,
        render: (_, record) => record?.production_at
          ? formatDuration(asOf.diff(dayjs(record.production_at)), t)
          : "—",
      },
      {
        title: t("table.remaining"),
        key: "remaining_time",
        width: 170,
        render: (_, record) => {
          if (!record?.production_at) return "—";
          const elapsed = asOf.diff(dayjs(record.production_at));
          const remaining = deadlineHours * 60 * 60 * 1000 - elapsed;
          return remaining >= 0 ? (
            <Tag color="blue">{t("remaining", { duration: formatDuration(remaining, t) })}</Tag>
          ) : (
            <Tag color="red">{t("exceeded", { duration: formatDuration(Math.abs(remaining), t) })}</Tag>
          );
        },
      },
    ];
    const withTimings = productionIndex < 0 ? [...columns, ...timingColumns] : [
      ...columns.slice(0, productionIndex + 1),
      ...timingColumns,
      ...columns.slice(productionIndex + 1),
    ];
    return [
      ...withTimings,
      {
        title: t("table.actions"),
        key: "actions",
        fixed: "right",
        width: 100,
        render: (_, record) => {
          if (record?.__isChild) return null;
          const orderNumber = record?.order?.order_number || record?.order_number;
          return orderNumber ? (
            <Button
              icon={<FileSearchOutlined />}
              href={`/dashboard/order/detail/${orderNumber}`}
              aria-label={t("table.viewDetail")}
            />
          ) : "—";
        },
      },
    ];
  }, [data?.meta?.generated_at, t]);

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Card
        bordered={false}
        style={{ background: `linear-gradient(135deg, ${token.colorPrimaryBg}, ${token.colorBgContainer})` }}
      >
        <Flex justify="space-between" align="center" gap={16} wrap>
          <div>
            <Title level={2} style={{ margin: 0 }}>{t("title")}</Title>
            <Text type="secondary">{t("subtitle")}</Text>
            {data?.meta?.generated_at ? (
              <div><Text type="secondary" style={{ fontSize: 12 }}>{t("lastUpdated", { date: dayjs(data.meta.generated_at).format("DD.MM.YYYY HH:mm") })}</Text></div>
            ) : null}
          </div>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadSummary}>{t("actions.refresh")}</Button>
        </Flex>
      </Card>

      {error ? (
        <Alert
          type="error"
          showIcon
          message={t("messages.loadError")}
          description={error}
          action={<Button icon={<ReloadOutlined />} onClick={loadSummary}>{t("actions.retry")}</Button>}
        />
      ) : null}

      {loading && !data ? <Skeleton active paragraph={{ rows: 5 }} /> : (
        <Row gutter={[16, 16]}>
          {BUCKETS.map((bucket) => {
            const metrics = bucketData.get(bucket.key) || {};
            const selected = selectedBucket === bucket.key;
            return (
              <Col key={bucket.key} xs={24} sm={12} xl={6}>
                <Card
                  hoverable
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => setSelectedBucket(bucket.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedBucket(bucket.key);
                    }
                  }}
                  style={{
                    height: "100%",
                    border: `2px solid ${selected ? bucket.color : "transparent"}`,
                    background: selected ? bucket.background : token.colorBgContainer,
                    boxShadow: selected ? token.boxShadowSecondary : token.boxShadowTertiary,
                  }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Space align="start">
                      <span style={{ color: bucket.color, fontSize: 22 }}>{bucket.icon}</span>
                      <div>
                        <Text strong style={{ display: "block" }}>{t(`buckets.${bucket.key}.title`)}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t(`buckets.${bucket.key}.range`)}</Text>
                      </div>
                    </Space>
                    <Row gutter={8}>
                      <Col span={8}><Statistic title={t("metrics.orders")} value={metrics.order_count || 0} valueStyle={{ color: bucket.color, fontSize: 24 }} /></Col>
                      <Col span={8}><Statistic title={t("metrics.items")} value={metrics.item_count || 0} valueStyle={{ fontSize: 24 }} /></Col>
                      <Col span={8}><Statistic title={t("metrics.quantity")} value={metrics.quantity_total || 0} valueStyle={{ fontSize: 24 }} /></Col>
                    </Row>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {!loading && data && !selectedBucket ? (
        <Card bordered={false}><Empty description={t("messages.empty")} /></Card>
      ) : null}

      {listApiFn && selectedBucket ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Title level={4} style={{ margin: 0 }}>{t(`buckets.${selectedBucket}.listTitle`)}</Title>
          <OrdersStatusListPage
            key={`${selectedBucket}-${data.meta.generated_at}`}
            listApiFn={listApiFn}
            allowedStatuses={allowedStatuses}
            showProductionAt
            columnsBuilder={columnsBuilder}
            requireRoles={["companyAdmin", "companyCompletedWorker", "companyShipmentWorker"]}
            productListFetcher={fetchProducts}
            affilated
            showCustomerColumn
            defaultSort={[
              { field: "production_at", direction: "asc" },
              { field: "id", direction: "asc" },
            ]}
          />
        </Space>
      ) : null}
    </Space>
  );
}
