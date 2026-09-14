"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  App as AntdApp, Button, Card, Col, DatePicker, Drawer, Empty, Input,
  Row, Select, Space, Statistic, Table, Tag, Typography,
} from "antd";
import { EyeOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import { ShipmentReportAPI } from "@/utils/api";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";
import { getBlobErrorMessage, saveBlobAsFile } from "@/utils/apiHelpers";
import ReportExportButton from "@/components/reports/ReportExportButton";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const defaultRange = () => [dayjs().subtract(29, "day"), dayjs()];
const payloadFor = (range, entityKey, entityId) => ({
  date_from: range[0].startOf("day").toISOString(),
  date_to: range[1].endOf("day").toISOString(),
  ...(entityKey && entityId ? { [entityKey]: entityId } : {}),
});
const dataOf = (response) => response?.data ?? response ?? {};
const money = (value) =>
  value === null || value === undefined
    ? "—"
    : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const count = (value) => Number(value || 0).toLocaleString();
const compareText = (a, b) => String(a ?? "").localeCompare(String(b ?? ""));
const compareNumber = (a, b) => Number(a ?? 0) - Number(b ?? 0);
const textValue = (value) => String(value ?? "").toLocaleLowerCase();

function TextFilterDropdown({ selectedKeys, setSelectedKeys, confirm, clearFilters, title, t }) {
  return <div style={{ padding: 8 }} onKeyDown={(event) => event.stopPropagation()}>
    <Input autoFocus placeholder={t("columnSearch", { column: title })} value={selectedKeys?.[0]}
      onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
      onPressEnter={() => confirm()} style={{ width: 210, marginBottom: 8 }} />
    <Space>
      <Button size="small" type="primary" onClick={() => confirm()}>{t("search")}</Button>
      <Button size="small" onClick={() => { clearFilters?.(); confirm(); }}>{t("reset")}</Button>
    </Space>
  </div>;
}

const textFilter = (title, accessor, t) => ({
  filterDropdown: (props) => <TextFilterDropdown {...props} title={title} t={t} />,
  filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />,
  onFilter: (value, row) => textValue(accessor(row)).includes(textValue(value)),
});

export default function ShipmentReportPage() {
  const user = useSelector((state) => state.auth.user);
  const isCustomer = user?.roles?.includes("customeradmin");
  const isSystem = user?.roles?.includes("systemadmin");
  const isCompany = user?.roles?.includes("companyadmin");
  const entityKey = isSystem ? "company_id" : isCompany ? "customer_id" : null;
  const t = useTranslations("dashboard.shipmentReport");
  const { locale } = useLocaleInfo();
  const { message } = AntdApp.useApp();
  const [range, setRange] = useState(defaultRange);
  const [selectedEntityId, setSelectedEntityId] = useState(undefined);
  const [appliedPayload, setAppliedPayload] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [entityOptions, setEntityOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [report, setReport] = useState({ summary: {}, daily_rows: [] });
  const [reportVersion, setReportVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailDate, setDetailDate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const reportRequest = useRef(0);

  const load = useCallback(async (selectedRange, entityId) => {
    const request = ++reportRequest.current;
    setLoading(true);
    try {
      const payload = payloadFor(selectedRange, entityKey, entityId);
      const data = dataOf(await ShipmentReportAPI.report(payload));
      if (request === reportRequest.current) {
        setReport(data);
        setAppliedPayload(payload);
        setReportVersion((value) => value + 1);
      }
    } catch (error) {
      if (request === reportRequest.current) message.error(error?.response?.data?.error?.message || t("loadError"));
    } finally {
      if (request === reportRequest.current) setLoading(false);
    }
  }, [entityKey, message, t]);

  const handleExport = useCallback(async (format) => {
    if (!appliedPayload) return;
    setExportLoading(true);
    try {
      const file = await ShipmentReportAPI.reportExport({ ...appliedPayload, format, locale });
      saveBlobAsFile(file.blob, file.filename);
    } catch (error) {
      message.error(await getBlobErrorMessage(error, t("exportError")));
    } finally {
      setExportLoading(false);
    }
  }, [appliedPayload, locale, message, t]);

  useEffect(() => {
    if (user) load(defaultRange(), undefined);
  }, [load, user]);

  useEffect(() => {
    if (!user || !entityKey) return;
    let active = true;
    setOptionsLoading(true);
    ShipmentReportAPI.filterOptions()
      .then((response) => {
        if (active) setEntityOptions((dataOf(response) || []).map((row) => ({ value: row.id, label: row.name || row.id })));
      })
      .catch((error) => { if (active) message.error(error?.response?.data?.error?.message || t("loadOptionsError")); })
      .finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, [entityKey, isSystem, message, t, user]);

  const openDetail = useCallback(async (date) => {
    const request = ++detailRequest.current;
    setDetailDate(date);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = dataOf(await ShipmentReportAPI.dayDetail({ date,
        ...(entityKey && appliedPayload?.[entityKey] ? { [entityKey]: appliedPayload[entityKey] } : {}) }));
      if (request === detailRequest.current) setDetail(data);
    } catch (error) {
      if (request === detailRequest.current) {
        message.error(error?.response?.data?.error?.message || t("loadError"));
      }
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }, [appliedPayload, entityKey, message, t]);

  const dailyColumns = useMemo(() => {
    const numeric = (key, labelKey, render) => {
      const title = t(labelKey);
      return {
        title, dataIndex: key, align: "right",
        sorter: (a, b) => compareNumber(a[key], b[key]),
        ...textFilter(title, (row) => row[key], t), render,
      };
    };
    return [
      { title: t("date"), dataIndex: "date", sorter: (a, b) => compareText(a.date, b.date), defaultSortOrder: "descend",
        ...textFilter(t("date"), (row) => dayjs(row.date).format("DD/MM/YYYY"), t), render: (value) => dayjs(value).format("DD/MM/YYYY") },
      numeric("order_count", "orderCount", count),
      numeric("purchase_count", "purchaseCount", count),
      numeric("void_count", "voidCount", count),
      numeric("unresolved_count", "unresolvedCount", count),
      ...(!isCustomer ? [
        numeric("purchase_base_amount", "purchaseBaseAmount", money),
        numeric("void_base_amount", "voidBaseAmount", money),
        numeric("net_base_amount", "netBaseAmount", money),
      ] : []),
      numeric("purchase_amount", "purchaseAmount", money),
      numeric("void_amount", "voidAmount", money),
      numeric("net_amount", "netAmount", money),
      { title: "", key: "detail", render: (_, row) => <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(row.date)}>{t("detail", { date: "" }).trim()}</Button> },
    ];
  }, [isCustomer, openDetail, t]);

  const detailColumns = useMemo(() => {
    const textColumn = (key, labelKey, render) => {
      const title = t(labelKey);
      return { title, dataIndex: key, sorter: (a, b) => compareText(a[key], b[key]),
        ...textFilter(title, (row) => row[key], t), render: render || ((value) => value || "—") };
    };
    const amountColumn = (key, labelKey) => {
      const title = t(labelKey);
      return { title, dataIndex: key, align: "right", sorter: (a, b) => compareNumber(a[key], b[key]),
        ...textFilter(title, (row) => row[key] ?? "—", t), render: money };
    };
    return [
      { title: t("eventTime"), dataIndex: "occurred_at", width: 160,
        sorter: (a, b) => compareText(a.occurred_at, b.occurred_at),
        ...textFilter(t("eventTime"), (row) => dayjs(row.occurred_at).format("DD/MM/YYYY HH:mm"), t),
        render: (value) => dayjs(value).format("DD/MM/YYYY HH:mm") },
      { title: t("event"), dataIndex: "kind", width: 115,
        filters: [{ text: t("purchase"), value: "purchase" }, { text: t("void"), value: "void" }],
        onFilter: (value, row) => row.kind === value,
        sorter: (a, b) => compareText(a.kind, b.kind),
        render: (value) => <Tag color={value === "void" ? "red" : "green"}>{t(value)}</Tag> },
      { title: t("orderType"), dataIndex: "order_type", width: 105,
        filters: [{ text: t("standardOrder"), value: "order" }, { text: t("transferOrder"), value: "transfer" }],
        onFilter: (value, row) => row.order_type === value,
        sorter: (a, b) => compareText(a.order_type, b.order_type),
        render: (value) => t(value === "transfer" ? "transferOrder" : "standardOrder") },
      textColumn("order_number", "orderNumber"),
      textColumn("customer_name", "customer"),
      ...(isSystem ? [textColumn("company_name", "company")] : []),
      textColumn("label_id", "label", (value) => value ? <Text copyable={{ text: value }}>{value.slice(0, 8)}…</Text> : "—"),
      { title: t("source"), dataIndex: "source",
        filters: ["easyjet", "shipStationCompany", "shipStationPartner"].map((value) => ({ text: value, value })),
        onFilter: (value, row) => row.source === value,
        sorter: (a, b) => compareText(a.source, b.source) },
      textColumn("service", "service"),
      textColumn("tracking_number", "tracking"),
      ...(!isCustomer ? [amountColumn("base_amount", "baseAmount")] : []),
      amountColumn("amount", "amount"),
      { title: t("unresolvedCount"), dataIndex: "unresolved",
        filters: [{ text: t("unresolved"), value: true }, { text: t("resolved"), value: false }],
        onFilter: (value, row) => row.unresolved === value,
        sorter: (a, b) => Number(a.unresolved) - Number(b.unresolved),
        render: (value) => value ? <Tag color="orange">{t("unresolved")}</Tag> : "—" },
    ];
  }, [isCustomer, isSystem, t]);

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
          <Button icon={<ReloadOutlined />} onClick={() => { const next = defaultRange(); setRange(next); setSelectedEntityId(undefined); load(next, undefined); }}>{t("reset")}</Button>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => load(range, selectedEntityId)}>{t("search")}</Button>
          <ReportExportButton onExport={handleExport} loading={exportLoading}
            disabled={!appliedPayload || loading} label={t("exportReport")} />
        </Space>}>
          <Space wrap size={12}>
            <RangePicker value={range} onChange={(value) => value && setRange(value)} allowClear={false} />
            {entityKey && <Select allowClear showSearch optionFilterProp="label" style={{ width: 300 }}
              value={selectedEntityId} onChange={setSelectedEntityId} options={entityOptions}
              loading={optionsLoading} placeholder={t(isSystem ? "allCompanies" : "allCustomers")}
              aria-label={t(isSystem ? "companyFilter" : "customerFilter")} />}
          </Space>
        </Card>

        <Card title={t("summary")} style={{ borderRadius: 20 }}>
          <Table key={reportVersion} rowKey="date" loading={loading} columns={dailyColumns} dataSource={report?.daily_rows || []}
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
