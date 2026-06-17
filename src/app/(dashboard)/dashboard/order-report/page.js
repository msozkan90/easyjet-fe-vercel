"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import {
  CategoriesAPI,
  CustomersAPI,
  OrdersAPI,
  PartnersAPI,
} from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ALL_ENTITIES_VALUE = "__all_entities__";
const ORDER_STATUS_KEYS = [
  "newOrder",
  "processing",
  "pdf",
  "completed",
  "downloaded",
  "printed",
  "shipped",
  "waitingForDesign",
  "cancel",
  "refund",
  "remake",
];

const createDefaultRange = () => [dayjs().subtract(29, "day"), dayjs()];

const createDefaultFilters = () => ({
  entity_ids: [],
  category_id: undefined,
  order_status: [],
  date_range: createDefaultRange(),
});

const extractPayload = (response) => response?.data ?? response ?? {};

const normalizeCategoryList = (response) => {
  const payload = extractPayload(response);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;

const formatCount = (value) => Number(value || 0).toLocaleString();

const isTransferCategory = (category) => {
  const name = String(category?.name || "")
    .trim()
    .toLowerCase();
  return name === "transfer" || name === "transfers";
};

const getTextValue = (value) => String(value || "").toLowerCase();

const buildReportPayload = (filters, entityOptionsMap) => {
  const [from, to] = filters?.date_range || [];
  const selectedEntities = (filters?.entity_ids || [])
    .map((value) => entityOptionsMap.get(value))
    .filter(Boolean);

  const customer_ids = selectedEntities
    .filter((entity) => entity.type === "customer")
    .map((entity) => entity.id);
  const partner_ids = selectedEntities
    .filter((entity) => entity.type === "partner")
    .map((entity) => entity.id);

  return {
    customer_ids: customer_ids.length ? customer_ids : undefined,
    partner_ids: partner_ids.length ? partner_ids : undefined,
    category_id: filters?.category_id || undefined,
    order_status:
      Array.isArray(filters?.order_status) && filters.order_status.length
        ? filters.order_status
        : undefined,
    date_from: from?.startOf("day").toISOString(),
    date_to: to?.endOf("day").toISOString(),
  };
};

function TextColumnFilter({
  placeholder,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  labels,
}) {
  return (
    <div style={{ padding: 8 }} onKeyDown={(event) => event.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={selectedKeys?.[0]}
        onChange={(event) =>
          setSelectedKeys(event.target.value ? [event.target.value] : [])
        }
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: "block", width: 220 }}
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()}>
          {labels.search}
        </Button>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.();
            confirm();
          }}
        >
          {labels.reset}
        </Button>
      </Space>
    </div>
  );
}

export default function OrderReportPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orderReport");
  const tOrders = useTranslations("dashboard.orders");
  const tActions = useTranslations("common.actions");

  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [reportData, setReportData] = useState({
    summary: {
      total_orders: 0,
      total_items: 0,
      total_revenue: 0,
      total_days: 0,
    },
    daily_rows: [],
    applied_range: null,
  });
  const [loading, setLoading] = useState(true);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const deferredDailyRows = useDeferredValue(reportData.daily_rows);

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const [partnersResp, customersResp, categoriesResp] = await Promise.all([
        PartnersAPI.list({ pagination: { page: 1, pageSize: 500 } }),
        CustomersAPI.list({ pagination: { page: 1, pageSize: 500 } }),
        CategoriesAPI.listWithSubCategories(),
      ]);

      setPartners(normalizeListAndMeta(partnersResp).list);
      setCustomers(normalizeListAndMeta(customersResp).list);
      setCategories(
        normalizeCategoryList(categoriesResp).filter(
          (category) => !isTransferCategory(category),
        ),
      );
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.loadFiltersError"),
      );
    } finally {
      setFilterOptionsLoading(false);
    }
  }, [message, t]);

  const entityOptions = useMemo(() => {
    const partnerRows = partners.map((partner) => ({
      value: `partner:${partner.id}`,
      id: partner.id,
      type: "partner",
      label: partner.name || partner.id,
      searchText: `${partner.name || ""} partner`,
    }));

    const customerRows = customers.map((customer) => ({
      value: `customer:${customer.id}`,
      id: customer.id,
      type: "customer",
      label: customer.name || customer.id,
      searchText: `${customer.name || ""} customer`,
    }));

    return [...partnerRows, ...customerRows].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" }),
    );
  }, [customers, partners]);

  const entityOptionsMap = useMemo(
    () => new Map(entityOptions.map((option) => [option.value, option])),
    [entityOptions],
  );

  const fetchReport = useCallback(
    async (nextFilters) => {
      setLoading(true);
      try {
        const response = await OrdersAPI.report(
          buildReportPayload(nextFilters, entityOptionsMap),
        );
        startTransition(() => {
          setReportData(extractPayload(response));
        });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.loadReportError"),
        );
      } finally {
        setLoading(false);
      }
    },
    [entityOptionsMap, message, t],
  );

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    fetchReport(createDefaultFilters());
  }, [fetchReport]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name || category.id,
      })),
    [categories],
  );

  const statusOptions = useMemo(
    () =>
      ORDER_STATUS_KEYS.map((status) => ({
        value: status,
        label: tOrders(`status.values.${status}`),
      })),
    [tOrders],
  );

  const entitySelectOptions = useMemo(
    () => [
      {
        value: ALL_ENTITIES_VALUE,
        label: (
          <Space size={8}>
            <Text strong>{t("filters.selectAllEntities")}</Text>
          </Space>
        ),
        searchText: t("filters.selectAllEntities"),
      },
      ...entityOptions.map((option) => ({
        value: option.value,
        label: (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>{option.label}</span>
            <Tag color={option.type === "customer" ? "blue" : "gold"}>
              {t(`filters.entityTypes.${option.type}`)}
            </Tag>
          </div>
        ),
        searchText: option.searchText,
      })),
    ],
    [entityOptions, t],
  );

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }, []);

  const handleEntityChange = useCallback(
    (value) => {
      const nextValues = Array.isArray(value) ? value : [];
      if (nextValues.includes(ALL_ENTITIES_VALUE)) {
        setFilters((prev) => ({
          ...prev,
          entity_ids:
            prev.entity_ids.length === entityOptions.length
              ? []
              : entityOptions.map((option) => option.value),
        }));
        return;
      }
      setFilters((prev) => ({ ...prev, entity_ids: nextValues }));
    },
    [entityOptions],
  );

  const handleDateRangeChange = useCallback((value) => {
    setFilters((prev) => ({ ...prev, date_range: value || [] }));
  }, []);

  const handleSearch = useCallback(() => {
    fetchReport(filters);
  }, [fetchReport, filters]);

  const handleReset = useCallback(() => {
    const next = createDefaultFilters();
    setFilters(next);
    fetchReport(next);
  }, [fetchReport]);

  const handleOpenDetail = useCallback(
    async (record) => {
      setDrawerOpen(true);
      setDetailLoading(true);
      try {
        const response = await OrdersAPI.reportDayDetail({
          ...buildReportPayload(filters, entityOptionsMap),
          date: record.date,
        });
        startTransition(() => {
          setDetailData(extractPayload(response));
        });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.loadDetailError"),
        );
        setDrawerOpen(false);
      } finally {
        setDetailLoading(false);
      }
    },
    [entityOptionsMap, filters, message, t],
  );

  const datePresets = useMemo(
    () => [
      {
        label: t("filters.presets.today"),
        value: [dayjs(), dayjs()],
      },
      {
        label: t("filters.presets.weekly"),
        value: [dayjs().subtract(6, "day"), dayjs()],
      },
      {
        label: t("filters.presets.monthly"),
        value: [dayjs().subtract(29, "day"), dayjs()],
      },
    ],
    [t],
  );

  const columnFilterLabels = useMemo(
    () => ({
      search: tActions("search"),
      reset: tActions("reset"),
    }),
    [tActions],
  );

  const getTextColumnSearchProps = useCallback(
    (title, accessor) => ({
      filterDropdown: (dropdownProps) => (
        <TextColumnFilter
          {...dropdownProps}
          placeholder={t("filters.searchInColumn", { column: title })}
          labels={columnFilterLabels}
        />
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
      ),
      onFilter: (value, record) =>
        getTextValue(accessor(record)).includes(getTextValue(value)),
    }),
    [columnFilterLabels, t],
  );

  const detailRows = useMemo(
    () =>
      (detailData?.products || []).map((product) => ({
        ...product,
        __search_size: (product.children || [])
          .map((child) => child.size_name || "")
          .join(" "),
        __search_color: (product.children || [])
          .map((child) => child.color_name || "")
          .join(" "),
      })),
    [detailData?.products],
  );

  const dailyColumns = useMemo(
    () => [
      {
        title: t("table.date"),
        dataIndex: "date",
        key: "date",
        sorter: (left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf(),
        defaultSortOrder: "descend",
        render: (value) => dayjs(value).format("DD/MM/YYYY"),
        ...getTextColumnSearchProps(t("table.date"), (record) =>
          dayjs(record.date).format("DD/MM/YYYY"),
        ),
      },
      {
        title: t("table.orderCount"),
        dataIndex: "order_count",
        key: "order_count",
        align: "right",
        sorter: (left, right) => Number(left.order_count || 0) - Number(right.order_count || 0),
        render: formatCount,
        ...getTextColumnSearchProps(t("table.orderCount"), (record) => record.order_count),
      },
      {
        title: t("table.itemQuantity"),
        dataIndex: "item_quantity",
        key: "item_quantity",
        align: "right",
        sorter: (left, right) =>
          Number(left.item_quantity || 0) - Number(right.item_quantity || 0),
        render: formatCount,
        ...getTextColumnSearchProps(t("table.itemQuantity"), (record) => record.item_quantity),
      },
      {
        title: t("table.revenue"),
        dataIndex: "revenue",
        key: "revenue",
        align: "right",
        sorter: (left, right) => Number(left.revenue || 0) - Number(right.revenue || 0),
        render: formatMoney,
        ...getTextColumnSearchProps(t("table.revenue"), (record) => record.revenue),
      },
      {
        title: t("table.actions"),
        key: "actions",
        align: "center",
        render: (_, record) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            {tActions("detail")}
          </Button>
        ),
      },
    ],
    [getTextColumnSearchProps, handleOpenDetail, t, tActions],
  );

  const detailColumns = useMemo(
    () => [
      {
        title: t("detailTable.product"),
        dataIndex: "product_name",
        key: "product_name",
        sorter: (left, right) =>
          String(left.product_name || "").localeCompare(String(right.product_name || "")),
        render: (value, record) => (record?.children ? <Text strong>{value}</Text> : ""),
        ...getTextColumnSearchProps(t("detailTable.product"), (record) => record.product_name),
      },
      {
        title: t("detailTable.size"),
        dataIndex: "size_name",
        key: "size_name",
        sorter: (left, right) =>
          String(left.size_name || left.__search_size || "").localeCompare(
            String(right.size_name || right.__search_size || ""),
          ),
        render: (value, record) => (record?.children ? "-" : value || "-"),
        ...getTextColumnSearchProps(t("detailTable.size"), (record) =>
          record.children ? record.__search_size : record.size_name,
        ),
      },
      {
        title: t("detailTable.color"),
        dataIndex: "color_name",
        key: "color_name",
        sorter: (left, right) =>
          String(left.color_name || left.__search_color || "").localeCompare(
            String(right.color_name || right.__search_color || ""),
          ),
        render: (value, record) => (record?.children ? "-" : value || "-"),
        ...getTextColumnSearchProps(t("detailTable.color"), (record) =>
          record.children ? record.__search_color : record.color_name,
        ),
      },
      {
        title: t("detailTable.itemQuantity"),
        dataIndex: "item_quantity",
        key: "item_quantity",
        align: "right",
        sorter: (left, right) =>
          Number(left.item_quantity || 0) - Number(right.item_quantity || 0),
        render: formatCount,
        ...getTextColumnSearchProps(t("detailTable.itemQuantity"), (record) => record.item_quantity),
      },
      {
        title: t("detailTable.revenue"),
        dataIndex: "revenue",
        key: "revenue",
        align: "right",
        sorter: (left, right) => Number(left.revenue || 0) - Number(right.revenue || 0),
        render: formatMoney,
        ...getTextColumnSearchProps(t("detailTable.revenue"), (record) => record.revenue),
      },
    ],
    [getTextColumnSearchProps, t],
  );

  const summaryCards = useMemo(
    () => [
      {
        key: "total_orders",
        title: t("summary.totalOrders"),
        value: formatCount(reportData?.summary?.total_orders),
        accent: "linear-gradient(135deg, #173b7a 0%, #2f63d4 100%)",
      },
      {
        key: "total_items",
        title: t("summary.totalItems"),
        value: formatCount(reportData?.summary?.total_items),
        accent: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
      },
      {
        key: "total_revenue",
        title: t("summary.totalRevenue"),
        value: formatMoney(reportData?.summary?.total_revenue),
        accent: "linear-gradient(135deg, #9a3412 0%, #f97316 100%)",
      },
      {
        key: "total_days",
        title: t("summary.totalDays"),
        value: formatCount(reportData?.summary?.total_days),
        accent: "linear-gradient(135deg, #581c87 0%, #a855f7 100%)",
      },
    ],
    [reportData?.summary, t],
  );

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <Card
          bordered={false}
          style={{
            background:
              "radial-gradient(circle at top left, rgba(253,186,116,0.24), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eef4ff 100%)",
            border: "1px solid rgba(37, 99, 235, 0.12)",
            borderRadius: 24,
          }}
        >
          <Space direction="vertical" size={6}>
            <Tag color="blue" style={{ width: "fit-content", borderRadius: 999 }}>
              {t("heroBadge")}
            </Tag>
            <Title level={3} style={{ margin: 0 }}>
              {t("title")}
            </Title>
            <Text type="secondary">{t("subtitle")}</Text>
            {reportData?.applied_range ? (
              <Text type="secondary">
                {t("rangeLabel", {
                  from: dayjs(reportData.applied_range.date_from).format("DD/MM/YYYY"),
                  to: dayjs(reportData.applied_range.date_to).format("DD/MM/YYYY"),
                })}
              </Text>
            ) : null}
          </Space>
        </Card>

        <Row gutter={[16, 16]}>
          {summaryCards.map((card) => (
            <Col xs={24} sm={12} xl={6} key={card.key}>
              <Card
                loading={loading}
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "none",
                  background: card.accent,
                  color: "#fff",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
                }}
                styles={{
                  body: {
                    position: "relative",
                  },
                }}
              >
                <Statistic
                  title={<span style={{ color: "rgba(255,255,255,0.84)" }}>{card.title}</span>}
                  value={card.value}
                  valueStyle={{ color: "#fff" }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Card
          title={t("filters.title")}
          bordered={false}
          style={{
            borderRadius: 24,
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
          }}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                {t("filters.reset")}
              </Button>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                {t("filters.search")}
              </Button>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Text strong>{t("filters.entities")}</Text>
              <Select
                allowClear
                showSearch
                mode="multiple"
                value={filters.entity_ids}
                onChange={handleEntityChange}
                options={entitySelectOptions}
                loading={filterOptionsLoading}
                placeholder={t("filters.entitiesPlaceholder")}
                style={{ width: "100%", marginTop: 8 }}
                optionFilterProp="searchText"
                maxTagCount="responsive"
                filterOption={(input, option) =>
                  getTextValue(option?.searchText).includes(getTextValue(input))
                }
              />
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Text strong>{t("filters.category")}</Text>
              <Select
                allowClear
                showSearch
                value={filters.category_id}
                onChange={(value) => handleFilterChange("category_id", value)}
                options={categoryOptions}
                loading={filterOptionsLoading}
                placeholder={t("filters.categoryPlaceholder")}
                style={{ width: "100%", marginTop: 8 }}
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Text strong>{t("filters.orderStatus")}</Text>
              <Select
                allowClear
                showSearch
                mode="multiple"
                value={filters.order_status}
                onChange={(value) => handleFilterChange("order_status", value)}
                options={statusOptions}
                placeholder={t("filters.orderStatusPlaceholder")}
                style={{ width: "100%", marginTop: 8 }}
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24}>
              <Text strong>{t("filters.orderDate")}</Text>
              <RangePicker
                allowClear={false}
                value={filters.date_range}
                onChange={handleDateRangeChange}
                presets={datePresets}
                style={{ width: "100%", marginTop: 8 }}
                format="DD/MM/YYYY"
              />
            </Col>
          </Row>
        </Card>

        <Card
          title={t("table.title")}
          bordered={false}
          style={{ borderRadius: 24, boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)" }}
        >
          <Table
            rowKey="date"
            loading={loading}
            columns={dailyColumns}
            dataSource={deferredDailyRows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 860 }}
            locale={{
              emptyText: <Empty description={t("messages.empty")} />,
            }}
          />
        </Card>

        <Drawer
          title={
            detailData?.date
              ? t("drawer.title", { date: dayjs(detailData.date).format("DD/MM/YYYY") })
              : t("drawer.fallbackTitle")
          }
          width={860}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setDetailData(null);
          }}
          destroyOnClose
        >
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalOrders")}
                    value={formatCount(detailData?.summary?.total_orders)}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalItems")}
                    value={formatCount(detailData?.summary?.total_items)}
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalRevenue")}
                    value={formatMoney(detailData?.summary?.total_revenue)}
                  />
                </Card>
              </Col>
            </Row>

            <Table
              rowKey={(row) =>
                row.product_id ||
                row.key ||
                `${row.product_name}-${row.size_name || "na"}-${row.color_name || "na"}`
              }
              loading={detailLoading}
              columns={detailColumns}
              dataSource={detailRows}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              expandable={{ defaultExpandAllRows: true }}
              locale={{
                emptyText: <Empty description={t("messages.emptyDetail")} />,
              }}
            />
          </Space>
        </Drawer>
      </Space>
    </RequireRole>
  );
}
