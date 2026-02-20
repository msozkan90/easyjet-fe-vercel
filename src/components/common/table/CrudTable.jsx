// components/common/table/CrudTable.jsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Table, Card, Space, Button, Input, Select, DatePicker } from "antd";
import {
  SearchOutlined,
  FilterFilled,
  ReloadOutlined,
} from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const antdToDir = (ord) =>
  ord === "ascend" ? "asc" : ord === "descend" ? "desc" : undefined;
const dirToAntd = (dir) =>
  dir === "asc" ? "ascend" : dir === "desc" ? "descend" : null;

function TextFilterDropdown({
  placeholder,
  labels,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  close,
}) {
  return (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={selectedKeys?.[0]}
        onChange={(e) =>
          setSelectedKeys(e.target.value ? [e.target.value] : [])
        }
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: "block", width: 188 }}
      />
      <Space>
        <Button
          type="primary"
          icon={<SearchOutlined />}
          size="small"
          onClick={() => confirm()}
        >
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
        <Button type="link" size="small" onClick={() => close()}>
          {labels.close}
        </Button>
      </Space>
    </div>
  );
}

function SelectFilterDropdown({
  multiple,
  placeholder,
  options,
  width = 240,
  labels,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  close,
}) {
  const mode = multiple ? "multiple" : undefined;
  const value = multiple ? selectedKeys || [] : selectedKeys?.[0];
  const onChange = (val) =>
    setSelectedKeys(multiple ? val || [] : val ? [val] : []);
  return (
    <div style={{ padding: 8, width }} onKeyDown={(e) => e.stopPropagation()}>
      <Select
        allowClear
        mode={mode}
        placeholder={placeholder}
        optionFilterProp="label"
        value={value}
        onChange={onChange}
        style={{ width: "100%", marginBottom: 8 }}
        options={options}
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()}>
          {labels.apply}
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
        <Button type="link" size="small" onClick={() => close()}>
          {labels.close}
        </Button>
      </Space>
    </div>
  );
}

function DateRangeFilterDropdown({
  placeholder,
  labels,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  close,
}) {
  const value = useMemo(() => {
    const raw = selectedKeys?.[0];
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj?.gte || !obj?.lte) return null;
      return [dayjs(obj.gte), dayjs(obj.lte)];
    } catch {
      return null;
    }
  }, [selectedKeys]);

  const onRangeChange = (range) => {
    if (range && range[0] && range[1]) {
      setSelectedKeys([
        JSON.stringify({
          gte: range[0].startOf("day").toISOString(),
          lte: range[1].endOf("day").toISOString(),
        }),
      ]);
    } else {
      setSelectedKeys([]);
    }
  };

  return (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <RangePicker
        allowClear
        value={value}
        onChange={onRangeChange}
        style={{ width: 260, marginBottom: 8 }}
        placeholder={[placeholder, placeholder]}
      />
      <Space>
        <Button type="primary" size="small" onClick={() => confirm()}>
          {labels.apply}
        </Button>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.();
            setSelectedKeys([]);
            confirm();
          }}
        >
          {labels.reset}
        </Button>
        <Button type="link" size="small" onClick={() => close()}>
          {labels.close}
        </Button>
      </Space>
    </div>
  );
}

/**
 * CrudTable
 * @param {{
 *   columns: Array, // AntD Columns; her kolon için opsiyonel: filter: { type: 'text'|'select'|'multi', options?:[], placeholder?:string, width?:number }
 *   request: (params: { page:number, pageSize:number, sort?:{orderBy,orderDir}, filters:Record<string,any> }) => Promise<{list:any[], total:number}>,
 *   rowKey?: string,
 *   initialPageSize?: number,
 *   initialFilters?: Record<string, any>,
 *   initialSort?: { orderBy?: string, orderDir?: 'asc'|'desc' },
 *   toolbarLeft?: React.ReactNode,
 *   toolbarRight?: React.ReactNode,
 *   tableProps?: any,
 *   onFiltersChange?: (filters: Record<string, any>) => void,
 * }} props
 */
const CrudTable = forwardRef(function CrudTable(
  {
    columns,
    request,
    rowKey = "id",
    initialPageSize = 10,
    initialFilters = {},
    initialSort = { orderBy: undefined, orderDir: undefined },
    toolbarLeft,
    toolbarRight,
    onFiltersChange,
    tableProps = {},
  },
  ref
) {
  const tTable = useTranslations("common.table");
  const tActions = useTranslations("common.actions");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageState, setPageState] = useState({
    page: 1,
    pageSize: initialPageSize,
  });
  const [sortState, setSortState] = useState(initialSort);
  const [filters, setFilters] = useState(initialFilters);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { list, total } = await request({
        page: pageState.page,
        pageSize: pageState.pageSize,
        sort: { orderBy: sortState.orderBy, orderDir: sortState.orderDir },
        filters,
      });
      setRows(list || []);
      setTotal(Number(total) || 0);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    reload: () => fetchData(),
    setPage: (page) => setPageState((s) => ({ ...s, page })),
    setFilters: (f) => setFilters((prev) => ({ ...prev, ...f })),
    setSort: (s) => setSortState(s),
  }));

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageState.page,
    pageState.pageSize,
    JSON.stringify(filters),
    sortState.orderBy,
    sortState.orderDir,
  ]);

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Column filterDropdown/filteredValue wiring
  const effectiveColumns = useMemo(() => {
    return (columns || []).map((col) => {
      const meta = col.filter;
      const fallbackLabel =
        typeof col.title === "string" || typeof col.title === "number"
          ? String(col.title)
          : col.dataIndex || col.key || "";
      if (!meta) {
        // sortOrder mapping
        return {
          ...col,
          sortOrder:
            col.dataIndex && sortState.orderBy === col.dataIndex
              ? dirToAntd(sortState.orderDir)
              : null,
        };
      }

      const dataIndex = col.dataIndex || col.key;
      const filteredValue = (() => {
        const v = filters?.[dataIndex];
        if (meta.type === "text") return v ? [v] : null;
        if (meta.type === "select") return v != null ? [v] : null;
        if (meta.type === "multi")
          return Array.isArray(v) && v.length ? v : null;
        if (meta.type === "dateRange") {
          if (v?.gte || v?.lte) {
            try {
              return [JSON.stringify(v)];
            } catch {
              return null;
            }
          }
          return null;
        }
        return null;
      })();

      let filterDropdown;
      if (meta.type === "text") {
        const placeholder =
          meta.placeholder ||
          tTable("searchPlaceholder", { label: fallbackLabel });
        filterDropdown = (args) => (
          <TextFilterDropdown
            placeholder={placeholder}
            labels={{
              search: tActions("search"),
              reset: tActions("reset"),
              close: tActions("close"),
            }}
            {...args}
          />
        );
      } else if (meta.type === "select") {
        const placeholder =
          meta.placeholder ||
          tTable("selectPlaceholder", { label: fallbackLabel });
        filterDropdown = (args) => (
          <SelectFilterDropdown
            multiple={false}
            placeholder={placeholder}
            options={meta.options || []}
            width={meta.width}
            labels={{
              apply: tActions("apply"),
              reset: tActions("reset"),
              close: tActions("close"),
            }}
            {...args}
          />
        );
      } else if (meta.type === "multi") {
        const placeholder =
          meta.placeholder ||
          tTable("selectPlaceholder", { label: fallbackLabel });
        filterDropdown = (args) => (
          <SelectFilterDropdown
            multiple
            placeholder={placeholder}
            options={meta.options || []}
            width={meta.width}
            labels={{
              apply: tActions("apply"),
              reset: tActions("reset"),
              close: tActions("close"),
            }}
            {...args}
          />
        );
      } else if (meta.type === "dateRange") {
        const placeholder =
          meta.placeholder ||
          tTable("selectPlaceholder", { label: fallbackLabel });
        filterDropdown = (args) => (
          <DateRangeFilterDropdown
            placeholder={placeholder}
            labels={{
              apply: tActions("apply"),
              reset: tActions("reset"),
              close: tActions("close"),
            }}
            {...args}
          />
        );
      }

      return {
        ...col,
        filterDropdown,
        filterIcon: (filtered) => (
          <FilterFilled style={{ color: filtered ? "#1677ff" : undefined }} />
        ),
        filteredValue,
        sortOrder:
          col.dataIndex && sortState.orderBy === col.dataIndex
            ? dirToAntd(sortState.orderDir)
            : null,
      };
    });
  }, [columns, filters, sortState]);

  const onTableChange = (pagination, tableFilters, sorter) => {
    const { current, pageSize } = pagination || {};
    if (current !== pageState.page || pageSize !== pageState.pageSize) {
      setPageState({
        page: current || 1,
        pageSize: pageSize || initialPageSize,
      });
    }

    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortState({
      orderBy: s?.field ?? s?.column?.dataIndex ?? undefined,
      orderDir: antdToDir(s?.order),
    });

    // Build nextFilters from tableFilters using our meta
    const next = { ...filters };
    (columns || []).forEach((col) => {
      const k = col.dataIndex || col.key;
      if (!k || !col.filter) return;

      if (col.filter.type === "text") {
        next[k] = (tableFilters?.[k] || [])[0] || "";
      } else if (col.filter.type === "select") {
        next[k] = (tableFilters?.[k] || [])[0] || undefined;
      } else if (col.filter.type === "multi") {
        next[k] = tableFilters?.[k] || [];
      } else if (col.filter.type === "dateRange") {
        const raw = (tableFilters?.[k] || [])[0];
        if (raw) {
          try {
            next[k] = JSON.parse(raw);
          } catch {
            next[k] = undefined;
          }
        } else {
          next[k] = undefined;
        }
      }
    });
    setFilters(next);
  };

  return (
    <div className=" gap-4">
      {/* Toolbar */}
      <Card className="shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {toolbarLeft}
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
              {tActions("refresh")}
            </Button>
            {toolbarRight}
          </Space>
        </div>
      </Card>
      {/* Table */}
      <Card className="shadow-sm">
        <Table
          rowKey={rowKey}
          loading={loading}
          columns={effectiveColumns}
          dataSource={rows}
          onChange={onTableChange}
          pagination={{
            current: pageState.page,
            pageSize: pageState.pageSize,
            total,

            showSizeChanger: true,
            responsive: true,
            showTotal: (count) => tTable("totalItems", { count }),
            pageSizeOptions: [2, 10, 20, 50, 100],
          }}
          scroll={{ x: true }}
          {...tableProps}
        />
      </Card>
    </div>
  );
});

export default CrudTable;
