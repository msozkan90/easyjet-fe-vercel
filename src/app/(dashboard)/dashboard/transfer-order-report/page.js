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
  PartnersAPI,
  TransferProductsAPI,
  TransferOrdersAPI,
} from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ALL_ENTITIES_VALUE = "__all_entities__";
const TRANSFER_ORDER_STATUS_KEYS = [
  "newOrder",
  "processing",
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
  transfer_product_id: undefined,
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

const formatLength = (value) =>
  `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} in`;

const getTextValue = (value) => String(value || "").toLowerCase();
const isTransferCategory = (category) => {
  const name = String(category?.name || "")
    .trim()
    .toLowerCase();
  return name === "transfer" || name === "transfers";
};

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
    transfer_product_id: filters?.transfer_product_id || undefined,
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

export default function TransferOrderReportPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.transferOrderReport");
  const tOrders = useTranslations("dashboard.orders");
  const tActions = useTranslations("common.actions");

  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [reportData, setReportData] = useState({
    summary: {
      total_orders: 0,
      total_items: 0,
      total_length_inches: 0,
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
  const [transferProducts, setTransferProducts] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const deferredDailyRows = useDeferredValue(reportData.daily_rows);

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const [partnersResp, customersResp, categoriesResp, transferProductsResp] = await Promise.all([
        PartnersAPI.list({ pagination: { page: 1, pageSize: 500 } }),
        CustomersAPI.list({ pagination: { page: 1, pageSize: 500 } }),
        CategoriesAPI.listWithSubCategories(),
        TransferProductsAPI.list({
          pagination: { page: 1, pageSize: 500 },
          filters: { status: "active" },
        }),
      ]);

      setPartners(normalizeListAndMeta(partnersResp).list);
      setCustomers(normalizeListAndMeta(customersResp).list);
      setCategories(
        normalizeCategoryList(categoriesResp).filter((category) =>
          isTransferCategory(category),
        ),
      );
      setTransferProducts(normalizeListAndMeta(transferProductsResp).list);
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
        const response = await TransferOrdersAPI.report(
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

  const statusOptions = useMemo(
    () =>
      TRANSFER_ORDER_STATUS_KEYS.map((status) => ({
        value: status,
        label: tOrders(`status.values.${status}`),
      })),
    [tOrders],
  );

  const transferCategoryIds = useMemo(
    () => new Set(categories.map((category) => String(category?.id || "")).filter(Boolean)),
    [categories],
  );

  const productOptions = useMemo(
    () =>
      transferProducts
        .filter((product) => transferCategoryIds.has(String(product?.category_id || "")))
        .map((product) => ({
          value: product.id,
          label: product.name || product.id,
        }))
        .sort((left, right) =>
          String(left.label || "").localeCompare(String(right.label || ""), undefined, {
            sensitivity: "base",
          }),
        ),
    [transferCategoryIds, transferProducts],
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
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
          >
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
    setFilters((prev) => {
      return { ...prev, [key]: value || undefined };
    });
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
        const response = await TransferOrdersAPI.reportDayDetail({
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

  const dailyColumns = useMemo(
    () => [
      {
        title: t("table.date"),
        dataIndex: "date",
        key: "date",
        sorter: (left, right) =>
          dayjs(left.date).valueOf() - dayjs(right.date).valueOf(),
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
        sorter: (left, right) =>
          Number(left.order_count || 0) - Number(right.order_count || 0),
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
        title: t("table.lengthInches"),
        dataIndex: "length_inches",
        key: "length_inches",
        align: "right",
        sorter: (left, right) =>
          Number(left.length_inches || 0) - Number(right.length_inches || 0),
        render: formatLength,
        ...getTextColumnSearchProps(t("table.lengthInches"), (record) => record.length_inches),
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
          String(left.product_name || "").localeCompare(
            String(right.product_name || ""),
          ),
        ...getTextColumnSearchProps(t("detailTable.product"), (record) => record.product_name),
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
        title: t("detailTable.lengthInches"),
        dataIndex: "length_inches",
        key: "length_inches",
        align: "right",
        sorter: (left, right) =>
          Number(left.length_inches || 0) - Number(right.length_inches || 0),
        render: formatLength,
        ...getTextColumnSearchProps(t("detailTable.lengthInches"), (record) => record.length_inches),
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
        accent: "linear-gradient(135deg, #102a56 0%, #295fbf 100%)",
      },
      {
        key: "total_items",
        title: t("summary.totalItems"),
        value: formatCount(reportData?.summary?.total_items),
        accent: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
      },
      {
        key: "total_length_inches",
        title: t("summary.totalLengthInches"),
        value: formatLength(reportData?.summary?.total_length_inches),
        accent: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
      },
      {
        key: "total_revenue",
        title: t("summary.totalRevenue"),
        value: formatMoney(reportData?.summary?.total_revenue),
        accent: "linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)",
      },
      {
        key: "total_days",
        title: t("summary.totalDays"),
        value: formatCount(reportData?.summary?.total_days),
        accent: "linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)",
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
              "radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 28%), radial-gradient(circle at right center, rgba(59,130,246,0.12), transparent 24%), linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)",
            border: "1px solid rgba(37, 99, 235, 0.12)",
            borderRadius: 24,
          }}
        >
          <Space direction="vertical" size={6}>
            <Tag color="cyan" style={{ width: "fit-content", borderRadius: 999 }}>
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
            <Col xs={24} sm={12} xl={card.key === "total_days" ? 24 : 6} key={card.key}>
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
            background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
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
            <Col xs={24} lg={14}>
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
            <Col xs={24} md={12} lg={5}>
              <Text strong>{t("filters.product")}</Text>
              <Select
                allowClear
                showSearch
                value={filters.transfer_product_id}
                onChange={(value) =>
                  handleFilterChange("transfer_product_id", value)
                }
                options={productOptions}
                loading={filterOptionsLoading}
                placeholder={t("filters.productPlaceholder")}
                style={{ width: "100%", marginTop: 8 }}
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} md={12} lg={10}>
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
            scroll={{ x: 960 }}
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
          width={920}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setDetailData(null);
          }}
          destroyOnClose
        >
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalOrders")}
                    value={formatCount(detailData?.summary?.total_orders)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalItems")}
                    value={formatCount(detailData?.summary?.total_items)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalLengthInches")}
                    value={formatLength(detailData?.summary?.total_length_inches)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card loading={detailLoading} style={{ borderRadius: 18 }}>
                  <Statistic
                    title={t("drawer.totalRevenue")}
                    value={formatMoney(detailData?.summary?.total_revenue)}
                  />
                </Card>
              </Col>
            </Row>

            <Table
              rowKey={(row) => row.product_id || row.key || row.product_name}
              loading={detailLoading}
              columns={detailColumns}
              dataSource={detailData?.products || []}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 760 }}
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
