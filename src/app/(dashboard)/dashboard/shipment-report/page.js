"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  App as AntdApp, Button, Card, Col, DatePicker, Drawer, Empty,
  Row, Space, Statistic, Table, Tag, Typography,
} from "antd";
import { EyeOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import { ShipmentReportAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const defaultRange = () => [dayjs().subtract(29, "day"), dayjs()];
const payloadFor = (range) => ({
  date_from: range[0].startOf("day").toISOString(),
  date_to: range[1].endOf("day").toISOString(),
});
const dataOf = (response) => response?.data ?? response ?? {};
const money = (value) =>
  value === null || value === undefined
    ? "—"
    : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const count = (value) => Number(value || 0).toLocaleString();

export default function ShipmentReportPage() {
  const user = useSelector((state) => state.auth.user);
  const isCustomer = user?.roles?.includes("customeradmin");
  const isSystem = user?.roles?.includes("systemadmin");
  const t = useTranslations("dashboard.shipmentReport");
  const { message } = AntdApp.useApp();
  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState({ summary: {}, daily_rows: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailDate, setDetailDate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);

  const load = useCallback(async (selectedRange) => {
    setLoading(true);
    try {
      setReport(dataOf(await ShipmentReportAPI.report(payloadFor(selectedRange))));
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    if (user) load(defaultRange());
  }, [load, user]);

  const openDetail = useCallback(async (date) => {
    const request = ++detailRequest.current;
    setDetailDate(date);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = dataOf(await ShipmentReportAPI.dayDetail({ date }));
      if (request === detailRequest.current) setDetail(data);
    } catch (error) {
      if (request === detailRequest.current) {
        message.error(error?.response?.data?.error?.message || t("loadError"));
      }
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }, [message, t]);

  const dailyColumns = useMemo(() => [
    { title: t("date"), dataIndex: "date", sorter: (a, b) => a.date.localeCompare(b.date), defaultSortOrder: "descend", render: (value) => dayjs(value).format("DD/MM/YYYY") },
    { title: t("orderCount"), dataIndex: "order_count", align: "right", sorter: (a, b) => a.order_count - b.order_count, render: count },
    { title: t("purchaseCount"), dataIndex: "purchase_count", align: "right", render: count },
    { title: t("voidCount"), dataIndex: "void_count", align: "right", render: count },
    { title: t("unresolvedCount"), dataIndex: "unresolved_count", align: "right", render: count },
    ...(!isCustomer ? [
      { title: t("purchaseBaseAmount"), dataIndex: "purchase_base_amount", align: "right", render: money },
      { title: t("voidBaseAmount"), dataIndex: "void_base_amount", align: "right", render: money },
      { title: t("netBaseAmount"), dataIndex: "net_base_amount", align: "right", render: money },
    ] : []),
    { title: t("purchaseAmount"), dataIndex: "purchase_amount", align: "right", render: money },
    { title: t("voidAmount"), dataIndex: "void_amount", align: "right", render: money },
    { title: t("netAmount"), dataIndex: "net_amount", align: "right", render: money },
    { title: "", key: "detail", render: (_, row) => <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(row.date)}>{t("detail", { date: "" }).trim()}</Button> },
  ], [isCustomer, openDetail, t]);

  const detailColumns = useMemo(() => [
    { title: t("eventTime"), dataIndex: "occurred_at", width: 160, render: (value) => dayjs(value).format("DD/MM/YYYY HH:mm") },
    { title: t("event"), dataIndex: "kind", width: 115, render: (value) => <Tag color={value === "void" ? "red" : "green"}>{t(value)}</Tag> },
    { title: t("orderType"), dataIndex: "order_type", width: 105, render: (value) => t(value === "transfer" ? "transferOrder" : "standardOrder") },
    { title: t("orderNumber"), dataIndex: "order_number", render: (value) => value || "—" },
    { title: t("customer"), dataIndex: "customer_name", render: (value) => value || "—" },
    ...(isSystem ? [{ title: t("company"), dataIndex: "company_name", render: (value) => value || "—" }] : []),
    { title: t("label"), dataIndex: "label_id", render: (value) => value ? <Text copyable={{ text: value }}>{value.slice(0, 8)}…</Text> : "—" },
    { title: t("source"), dataIndex: "source" },
    { title: t("service"), dataIndex: "service", render: (value) => value || "—" },
    { title: t("tracking"), dataIndex: "tracking_number", render: (value) => value || "—" },
    ...(!isCustomer ? [{ title: t("baseAmount"), dataIndex: "base_amount", align: "right", render: money }] : []),
    { title: t("amount"), dataIndex: "amount", align: "right", render: money },
    { title: "", dataIndex: "unresolved", render: (value) => value ? <Tag color="orange">{t("unresolved")}</Tag> : null },
  ], [isCustomer, isSystem, t]);

  const cards = [
    { key: "purchase_amount", title: t("purchaseAmount"), color: "#047857" },
    { key: "void_amount", title: t("voidAmount"), color: "#b91c1c" },
    { key: "net_amount", title: t("netAmount"), color: "#1d4ed8" },
  ];

  return (
    <RequireRole anyOfRoles={["systemAdmin", "companyAdmin", "customerAdmin"]}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <Card style={{ borderRadius: 24, background: "linear-gradient(135deg, #f8fafc, #edf4ff)" }}>
          <Title level={3} style={{ margin: 0 }}>{t("title")}</Title>
          <Text type="secondary">{t(isCustomer ? "customerSubtitle" : "subtitle")}</Text>
        </Card>

        <Row gutter={[16, 16]}>
          {cards.map((card) => <Col xs={24} md={8} key={card.key}>
            <Card loading={loading} style={{ borderRadius: 18, background: card.color }}>
              <Statistic title={<span style={{ color: "#fff" }}>{card.title}</span>} value={money(report?.summary?.[card.key])} valueStyle={{ color: "#fff" }} />
            </Card>
          </Col>)}
        </Row>

        <Card title={t("filters")} style={{ borderRadius: 20 }} extra={<Space>
          <Button icon={<ReloadOutlined />} onClick={() => { const next = defaultRange(); setRange(next); load(next); }}>{t("reset")}</Button>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => load(range)}>{t("search")}</Button>
        </Space>}>
          <RangePicker value={range} onChange={(value) => value && setRange(value)} allowClear={false} />
        </Card>

        <Card title={t("summary")} style={{ borderRadius: 20 }}>
          <Table rowKey="date" loading={loading} columns={dailyColumns} dataSource={report?.daily_rows || []}
            scroll={{ x: "max-content" }} pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description={t("empty")} /> }} />
        </Card>

        <Drawer title={detailDate ? t("detail", { date: dayjs(detailDate).format("DD/MM/YYYY") }) : t("title")}
          open={!!detailDate} onClose={() => { detailRequest.current++; setDetailDate(null); }} width="min(1400px, 95vw)" destroyOnClose>
          <Table rowKey="id" loading={detailLoading} columns={detailColumns} dataSource={detail?.rows || []}
            scroll={{ x: "max-content" }} pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description={t("empty")} /> }} />
        </Drawer>
      </Space>
    </RequireRole>
  );
}
