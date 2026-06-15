"use client";

import dynamic from "next/dynamic";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import { DashboardAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const { Title, Text } = Typography;
const Line = dynamic(
  () => import("@ant-design/charts").then((mod) => mod.Line),
  { ssr: false },
);
const Pie = dynamic(
  () => import("@ant-design/charts").then((mod) => mod.Pie),
  { ssr: false },
);
const Column = dynamic(
  () => import("@ant-design/charts").then((mod) => mod.Column),
  { ssr: false },
);

const RANGE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "30D", value: "last_30_days" },
  { label: "7D", value: "last_7_days" },
  { label: "MTD", value: "this_month" },
];
const { RangePicker } = DatePicker;

const THIRD_CHART_ROLES = new Set([
  "companyadmin",
  "companycompletedworker",
  "companyshipmentworker",
]);
const SYSTEM_ADMIN_KPI_KEYS = new Set([
  "wallet_balance",
  "active_companies",
  "pending_company_topups",
  "completed_company_topups",
  "company_wallets",
]);

const STATUS_COLORS = {
  newOrder: "blue",
  readyForProduction: "geekblue",
  processing: "purple",
  printed: "green",
  completed: "green",
  shipped: "gold",
  waitingForDesign: "orange",
  pending: "orange",
  completed_or_printed: "green",
};

function prettifyKey(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export default function DashboardHome() {
  const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("last_30_days");
  const [customRange, setCustomRange] = useState(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const t = useTranslations("dashboard.overview");
  const { token } = theme.useToken();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await DashboardAPI.overview({
          range,
          ...(customRange?.[0] && customRange?.[1]
            ? {
                start_date: customRange[0].format("YYYY-MM-DD"),
                end_date: customRange[1].format("YYYY-MM-DD"),
              }
            : {}),
          category_ids: selectedCategoryIds,
        });
        setData(response?.data || response);
      } catch (fetchError) {
        setError(
          fetchError?.response?.data?.message ||
            fetchError?.message ||
            t("messages.loadError"),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [customRange, range, selectedCategoryIds, t]);

  const categories = data?.context?.available_categories || [];
  const visibility = data?.context?.visibility || {};
  const kpis = useMemo(() => data?.kpis || [], [data?.kpis]);
  const normalizedDashboardRole = String(
    data?.context?.role_code || user?.role?.name || user?.roles?.[0] || "",
  )
    .replace(/_/g, "")
    .toLowerCase();
  const isSystemAdminDashboard = normalizedDashboardRole === "systemadmin";
  const badgeEntries = useMemo(
    () =>
      Object.entries(data?.badges || {})
        .filter(([key]) =>
          visibility?.show_stock_badges
            ? true
            : key !== "stock_alert" && key !== "low_stock_count",
        )
        .map(([key, value]) => ({
          key,
          value,
        })),
    [data?.badges, visibility?.show_stock_badges],
  );
  const visibleKpis = useMemo(
    () =>
      isSystemAdminDashboard
        ? kpis.filter((item) => SYSTEM_ADMIN_KPI_KEYS.has(item.key))
        : kpis,
    [isSystemAdminDashboard, kpis],
  );
  const showStockChart =
    !isSystemAdminDashboard &&
    visibility?.show_stock_insights &&
    THIRD_CHART_ROLES.has(normalizedDashboardRole);
  const showPaymentsChart = !showStockChart && visibility?.show_payments_chart;
  const hasStandardAccess = Boolean(visibility?.has_standard_access);
  const hasTransferAccess = Boolean(visibility?.has_transfer_access);
  const showCategoryFilter =
    !isSystemAdminDashboard && Boolean(visibility?.show_category_filter);
  const showOrdersChart =
    !isSystemAdminDashboard && Boolean(visibility?.show_orders_chart);
  const showAttentionOrders =
    !isSystemAdminDashboard && Boolean(visibility?.show_attention_orders);
  const showRefundTable =
    !isSystemAdminDashboard && Boolean(visibility?.show_refund_table);

  const kpiLabel = (key) => {
    const translated = t(`kpis.${key}`);
    return translated.startsWith("dashboard.overview")
      ? prettifyKey(key)
      : translated;
  };

  const badgeLabel = (key) => {
    const translated = t(`badges.${key}`);
    return translated.startsWith("dashboard.overview")
      ? prettifyKey(key)
      : translated;
  };

  const chartLabel = (key) => {
    const translated = t(`charts.${key}`);
    return translated.startsWith("dashboard.overview")
      ? prettifyKey(key)
      : translated;
  };

  const translatedOr = useCallback(
    (path, fallback) => {
      const translated = t(path);
      return translated.startsWith("dashboard.overview") ? fallback : translated;
    },
    [t],
  );

  const formatNumberTooltip = useCallback(
    (value) => Number(value || 0).toLocaleString("en-US"),
    [],
  );

  const formatMoneyTooltip = useCallback((value) => formatMoney(value), []);

  const normalizeTooltipItems = useCallback((items, formatter) => {
    (items || []).forEach((item) => {
      const datum =
        item?.data?.data ||
        item?.data?.datum ||
        item?.data ||
        item?.datum ||
        {};
      const rawValue =
        item?.value ?? datum?.value ?? datum?.count ?? datum?.amount ?? 0;
      item.name =
        item?.name ||
        datum?.labelText ||
        datum?.series ||
        datum?.type ||
        datum?.label ||
        "-";
      item.value = formatter(rawValue);
    });
  }, []);

  const bindTooltipFormatter = useCallback(
    (formatter) => (plot) => {
      if (!plot?.on) return;
      plot.on("tooltip:change", (event) => {
        normalizeTooltipItems(event?.data?.items, formatter);
      });
    },
    [normalizeTooltipItems],
  );

  const attentionColumns = [
    {
      title: t("tables.orderNumber"),
      dataIndex: "order_number",
      render: (value) => value || "-",
    },
    {
      title: t("tables.customer"),
      dataIndex: "customer_name",
      render: (value) => value || "-",
    },
    {
      title: t("tables.status"),
      dataIndex: "status",
      render: (value) => (
        <Tag color={STATUS_COLORS[value] || "default"}>
          {prettifyKey(value)}
        </Tag>
      ),
    },
    {
      title: t("tables.createdAt"),
      dataIndex: "created_at",
      render: formatDate,
    },
  ];

  const transactionColumns = [
    {
      title: t("tables.type"),
      dataIndex: "transaction_type",
      render: (value) => prettifyKey(value),
    },
    {
      title: t("tables.amount"),
      dataIndex: "amount",
      render: formatMoney,
    },
    {
      title: t("tables.status"),
      dataIndex: "status",
      render: (value) => <Tag>{prettifyKey(value)}</Tag>,
    },
    {
      title: t("tables.createdAt"),
      dataIndex: "created_at",
      render: formatDate,
    },
  ];

  const lowStockColumns = [
    {
      title: t("tables.product"),
      dataIndex: "product_name",
    },
    {
      title: t("tables.variant"),
      dataIndex: "variant",
    },
    {
      title: t("tables.quantity"),
      dataIndex: "quantity",
    },
    {
      title: t("tables.threshold"),
      dataIndex: "threshold",
    },
  ];

  const refundColumns = [
    {
      title: t("tables.orderNumber"),
      dataIndex: "order_number",
      render: (value) => value || "-",
    },
    {
      title: t("tables.customer"),
      dataIndex: "customer_name",
      render: (value) => value || "-",
    },
    {
      title: t("tables.type"),
      dataIndex: "request_type",
      render: (value) => prettifyKey(value),
    },
    {
      title: t("tables.status"),
      dataIndex: "status",
      render: (value) => <Tag>{prettifyKey(value)}</Tag>,
    },
  ];

  const thirdChartData = showStockChart
    ? data?.charts?.stockMovementTrend || []
    : data?.charts?.paymentsTrend || [];
  const ordersTrendData = (data?.charts?.ordersTrend || []).flatMap((item) => {
    const next = [];
    if (hasStandardAccess) {
      next.push({ date: item.date, series: t("series.standard"), value: item.standard });
    }
    if (hasTransferAccess) {
      next.push({ date: item.date, series: t("series.transfer"), value: item.transfer });
    }
    return next;
  });
  const statusBreakdownData = useMemo(() => {
    const raw = data?.charts?.statusBreakdown || [];
    const mapped = raw
      .filter((item) => Number(item?.value || 0) > 0)
      .map((item) => ({
        ...item,
        labelText: translatedOr(
          `statusLabels.${String(item.label || "").toLowerCase().replace(/\s+|\/+/g, "_")}`,
          item.label,
        ),
      }));
    return mapped.length
      ? mapped
      : raw.map((item) => ({
          ...item,
          labelText: translatedOr(
            `statusLabels.${String(item.label || "").toLowerCase().replace(/\s+|\/+/g, "_")}`,
            item.label,
          ),
        }));
  }, [data?.charts?.statusBreakdown, translatedOr]);

  const thirdChartConfig = showStockChart
    ? {
        data: thirdChartData.flatMap((item) => [
          { date: item.date, type: "Debit", value: item.debit },
          { date: item.date, type: "Credit", value: item.credit },
        ]),
        xField: "date",
        yField: "value",
        seriesField: "type",
        color: ["#d97706", "#059669"],
        height: 280,
      }
    : {
        data: thirdChartData.flatMap((item) => [
          { date: item.date, type: t("series.topups"), value: item.topups },
          { date: item.date, type: t("series.transactions"), value: item.transactions },
        ]),
        xField: "date",
        yField: "value",
        seriesField: "type",
        color: ["#2563eb", "#7c3aed"],
        height: 280,
      };

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <Card
        styles={{
          body: {
            background:
              "linear-gradient(135deg, rgba(17,24,39,0.96), rgba(37,99,235,0.88))",
            borderRadius: token.borderRadiusLG,
            color: "#fff",
          },
        }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} lg={14}>
            <Space direction="vertical" size={6}>
              <Tag color="cyan" style={{ width: "fit-content", marginInlineEnd: 0 }}>
                {data?.context?.entity_type
                  ? prettifyKey(data.context.entity_type)
                  : prettifyKey(user?.role?.name)}
              </Tag>
              <Title level={3} style={{ color: "#fff", margin: 0 }}>
                {data?.context?.entity_name || t("title")}
              </Title>
              <Text style={{ color: "rgba(255,255,255,0.82)" }}>
                {t("subtitle")}
              </Text>
            </Space>
          </Col>
          <Col xs={24} lg={10}>
            <Space
              direction="vertical"
              size={12}
              style={{ width: "100%", alignItems: "flex-end" }}
            >
              <Segmented
                options={RANGE_OPTIONS}
                value={range}
                onChange={(value) => {
                  setCustomRange(null);
                  setRange(value);
                }}
              />
              <RangePicker
                allowClear
                value={customRange}
                onChange={(value) => setCustomRange(value && value[0] && value[1] ? value : null)}
                style={{ width: "100%", minWidth: 280, maxWidth: 420 }}
                format="DD.MM.YYYY"
                placeholder={[t("filters.startDate"), t("filters.endDate")]}
              />
              {showCategoryFilter ? (
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: "100%", minWidth: 280, maxWidth: 420 }}
                  placeholder={t("filters.categories")}
                  value={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                  maxTagCount="responsive"
                  dropdownStyle={{ minWidth: 280 }}
                  options={categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                />
              ) : null}
            </Space>
          </Col>
        </Row>
      </Card>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      {loading ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : !data ? (
        <Empty description={t("messages.empty")} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {visibleKpis.map((item) => (
              <Col xs={24} sm={12} xl={8} xxl={4} key={item.key}>
                <Card bordered={false} style={{ height: "100%" }}>
                  <Statistic
                    title={kpiLabel(item.key)}
                    value={item.value}
                    formatter={(value) =>
                      item.key === "wallet_balance"
                        ? formatMoney(value)
                        : Number(value || 0).toLocaleString("en-US")
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Card title={t("badges.title")}>
            <Space size={[8, 8]} wrap>
              {badgeEntries.map((badge) => (
                <Tag
                  key={badge.key}
                  color={
                    typeof badge.value === "boolean"
                      ? badge.value
                        ? "green"
                        : "default"
                      : "blue"
                  }
                  style={{ paddingInline: 10, paddingBlock: 6 }}
                >
                  {badgeLabel(badge.key)}:{" "}
                  {typeof badge.value === "boolean"
                    ? badge.value
                      ? t("badges.enabled")
                      : t("badges.disabled")
                    : badge.key === "wallet"
                      ? formatMoney(badge.value)
                      : badge.value}
                </Tag>
              ))}
            </Space>
          </Card>
          {showOrdersChart ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={16}>
                <Card title={chartLabel("ordersTrend")}>
                  <Line
                    onReady={bindTooltipFormatter(formatNumberTooltip)}
                    data={ordersTrendData}
                    xField="date"
                    yField="value"
                    seriesField="series"
                    smooth
                    height={300}
                    color={["#2563eb", "#14b8a6"]}
                    legend={{ position: "top" }}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title={chartLabel("statusBreakdown")}>
                  <Pie
                    onReady={bindTooltipFormatter(formatNumberTooltip)}
                    data={statusBreakdownData}
                    angleField="value"
                    colorField="labelText"
                    keyField="labelText"
                    innerRadius={0.68}
                    height={300}
                    label= {false}
                    legend={{
                      position: "top",
                      layout: "horizontal",
                      itemName: {
                        style: {
                          fontSize: 12,
                        },
                      },
                    }}
                  />
                </Card>
              </Col>
            </Row>
          ) : null}

          {showStockChart || showPaymentsChart ? (
            <Row gutter={[16, 16]}>
              <Col xs={24}>
                <Card
                  title={chartLabel(
                    showStockChart ? "stockMovementTrend" : "paymentsTrend",
                  )}
                >
                  <Column
                    onReady={bindTooltipFormatter(
                      showStockChart ? formatNumberTooltip : formatMoneyTooltip,
                    )}
                    {...thirdChartConfig}
                  />
                </Card>
              </Col>
            </Row>
          ) : null}

          {showAttentionOrders || visibility?.show_recent_transactions ? (
            <Row gutter={[16, 16]}>
              {showAttentionOrders ? (
                <Col xs={24} xl={visibility?.show_recent_transactions ? 12 : 24}>
                  <Card title={t("tables.attentionOrders")}>
                    <Table
                      rowKey="id"
                      columns={attentionColumns}
                      dataSource={data?.tables?.attentionOrders || []}
                      locale={{ emptyText: t("messages.empty") }}
                      pagination={false}
                      scroll={{ x: 720 }}
                    />
                  </Card>
                </Col>
              ) : null}
              {visibility?.show_recent_transactions ? (
                <Col xs={24} xl={visibility?.show_attention_orders ? 12 : 24}>
                  <Card title={t("tables.recentTransactions")}>
                    <Table
                      rowKey="id"
                      columns={transactionColumns}
                      dataSource={data?.tables?.recentTransactions || []}
                      locale={{ emptyText: t("messages.empty") }}
                      pagination={false}
                      scroll={{ x: 680 }}
                    />
                  </Card>
                </Col>
              ) : null}
            </Row>
          ) : null}

          {visibility?.show_stock_table || showRefundTable ? (
            <Row gutter={[16, 16]}>
              {visibility?.show_stock_table ? (
                <Col xs={24} xl={showRefundTable ? 12 : 24}>
                  <Card title={t("tables.lowStockItems")}>
                    <Table
                      rowKey="id"
                      columns={lowStockColumns}
                      dataSource={data?.tables?.lowStockItems || []}
                      locale={{ emptyText: t("messages.empty") }}
                      pagination={false}
                      scroll={{ x: 640 }}
                    />
                  </Card>
                </Col>
              ) : null}
              {showRefundTable ? (
                <Col xs={24} xl={visibility?.show_stock_table ? 12 : 24}>
                  <Card title={t("tables.recentRefundRemakeRequests")}>
                    <Table
                      rowKey="id"
                      columns={refundColumns}
                      dataSource={data?.tables?.recentRefundRemakeRequests || []}
                      locale={{ emptyText: t("messages.empty") }}
                      pagination={false}
                      scroll={{ x: 640 }}
                    />
                  </Card>
                </Col>
              ) : null}
            </Row>
          ) : null}
        </>
      )}
    </Space>
  );
}
