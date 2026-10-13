// components/common/table/CrudTable.jsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Table, Space, Button, Input, Select, DatePicker } from "antd";
import {
  SearchOutlined,
  FilterFilled,
  ReloadOutlined,
} from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";
import dayjs from "dayjs";
import { palette } from "@/theme/tokens";
import { EmptyState, ErrorState } from "@/components/ui/StateView";

const { RangePicker } = DatePicker;

const antdToDir = (ord) =>
  ord === "ascend" ? "asc" : ord === "descend" ? "desc" : undefined;
const dirToAntd = (dir) =>
  dir === "asc" ? "ascend" : dir === "desc" ? "descend" : null;
const isActionsColumn = (column) => {
  const key = String(column?.key || column?.dataIndex || "").trim().toLowerCase();
  return key === "actions";
};

function FilterDropdownFrame({ width, labels, onApply, onReset, onClose, applyIcon, applyLabel, children }) {
  return (
    <div
      className="flex flex-col"
      style={{ width }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="p-3">{children}</div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <Button type="text" size="small" onClick={onClose}>
          {labels.close}
        </Button>
        <Space size={6}>
          <Button size="small" onClick={onReset}>
            {labels.reset}
          </Button>
          <Button type="primary" size="small" icon={applyIcon} onClick={onApply}>
            {applyLabel}
          </Button>
        </Space>
      </div>
    </div>
  );
}

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
    <FilterDropdownFrame
      width={240}
      labels={labels}
      onApply={() => confirm()}
      onReset={() => {
        clearFilters?.();
        confirm();
      }}
      onClose={() => close()}
      applyIcon={<SearchOutlined />}
      applyLabel={labels.search}
    >
      <Input
        autoFocus
        allowClear
        prefix={<SearchOutlined className="text-ink-400" />}
        placeholder={placeholder}
        value={selectedKeys?.[0]}
        onChange={(e) =>
          setSelectedKeys(e.target.value ? [e.target.value] : [])
        }
        onPressEnter={() => confirm()}
      />
    </FilterDropdownFrame>
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
    <FilterDropdownFrame
      width={width}
      labels={labels}
      onApply={() => confirm()}
      onReset={() => {
        clearFilters?.();
        confirm();
      }}
      onClose={() => close()}
      applyLabel={labels.apply}
    >
      <Select
        allowClear
        showSearch
        autoFocus
        mode={mode}
        placeholder={placeholder}
        optionFilterProp="label"
        value={value}
        onChange={onChange}
        style={{ width: "100%" }}
        options={options}
        maxTagCount="responsive"
      />
    </FilterDropdownFrame>
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
    <FilterDropdownFrame
      width={300}
      labels={labels}
      onApply={() => confirm()}
      onReset={() => {
        clearFilters?.();
        setSelectedKeys([]);
        confirm();
      }}
      onClose={() => close()}
      applyLabel={labels.apply}
    >
      <RangePicker
        allowClear
        value={value}
        onChange={onRangeChange}
        style={{ width: "100%" }}
        placeholder={[placeholder, placeholder]}
      />
    </FilterDropdownFrame>
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
 *   showRefresh?: boolean,
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
    showRefresh = true,
    tableProps = {},
  },
  ref
) {
  const tTable = useTranslations("common.table");
  const tActions = useTranslations("common.actions");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageState, setPageState] = useState({
    page: 1,
    pageSize: initialPageSize,
  });
  const [sortState, setSortState] = useState(initialSort);
  const [filters, setFilters] = useState(initialFilters);
  const onFiltersChangeRef = useRef(onFiltersChange);

  useEffect(() => {
    onFiltersChangeRef.current = onFiltersChange;
  }, [onFiltersChange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { list, total } = await request({
        page: pageState.page,
        pageSize: pageState.pageSize,
        sort: { orderBy: sortState.orderBy, orderDir: sortState.orderDir },
        filters,
      });
      const nextTotal = Number(total) || 0;
      const maxPage = Math.max(
        1,
        Math.ceil(nextTotal / Math.max(1, pageState.pageSize))
      );

      if (pageState.page > maxPage) {
        setPageState((prev) =>
          prev.page === maxPage ? prev : { ...prev, page: maxPage }
        );
        return;
      }

      setRows(list || []);
      setTotal(nextTotal);
      setLoadError(null);
    } catch (error) {
      setLoadError(error || new Error("load failed"));
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
    onFiltersChangeRef.current?.(filters);
  }, [filters]);

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
          ...(isActionsColumn(col) && col?.fixed === undefined
            ? { fixed: "right" }
            : {}),
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
        ...(isActionsColumn(col) && col?.fixed === undefined
          ? { fixed: "right" }
          : {}),
        filterDropdown,
        filterIcon: (filtered) => (
          <FilterFilled
            style={{ color: filtered ? palette.orange600 : undefined }}
          />
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

  const { locale: tableLocale, ...restTableProps } = tableProps || {};
  const customEmpty = tableLocale?.emptyText;
  const emptyText =
    customEmpty === undefined ||
    typeof customEmpty === "string" ||
    typeof customEmpty === "number" ? (
      <EmptyState compact title={customEmpty} />
    ) : (
      customEmpty
    );

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      {showRefresh || toolbarLeft || toolbarRight ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          {toolbarLeft ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-xl border border-line bg-subtle p-2">
              {toolbarLeft}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showRefresh ? (
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchData()}
                loading={loading}
              >
                {tActions("refresh")}
              </Button>
            ) : null}
            {toolbarRight}
          </div>
        </div>
      ) : null}
      {/* Table */}
      <div className="ej-table-surface">
        {loadError && !loading ? (
          <div className="border-b border-line">
            <ErrorState compact onRetry={() => fetchData()} />
          </div>
        ) : null}
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
            pageSizeOptions: [10, 20, 50, 100],
          }}
          scroll={{ x: true }}
          {...restTableProps}
          locale={{ ...(tableLocale || {}), emptyText }}
        />
      </div>
    </div>
  );
});

export default CrudTable;
