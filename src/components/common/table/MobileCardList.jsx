"use client";

import { Checkbox, Pagination, Skeleton } from "antd";

const isActionsColumn = (column) =>
  String(column?.key || column?.dataIndex || "")
    .trim()
    .toLowerCase() === "actions";

const readValue = (record, dataIndex) => {
  if (dataIndex === undefined || dataIndex === null) return undefined;
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex];
  return path.reduce((acc, key) => (acc == null ? acc : acc[key]), record);
};

const renderCell = (column, record, index) => {
  const value = readValue(record, column.dataIndex);
  return typeof column.render === "function"
    ? column.render(value, record, index)
    : value;
};

const isEmptyNode = (node) =>
  node === null || node === undefined || node === false || node === "";

const columnTitle = (column) =>
  typeof column.title === "function" ? column.title({}) : column.title;

function CardFields({ columns, record, index }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2">
      {columns.map((column, columnIndex) => {
        const content = renderCell(column, record, index);
        if (isEmptyNode(content)) return null;
        return (
          <div
            key={column.key || column.dataIndex?.toString() || columnIndex}
            className="contents"
          >
            <dt className="text-xs font-medium text-text-secondary">
              {columnTitle(column)}
            </dt>
            <dd className="m-0 min-w-0 break-words text-[13px] text-text">
              {content}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Phone layout for CrudTable: each row becomes a card with label/value
 * pairs, its actions at the bottom and child rows (multi-item orders)
 * nested below. Uses the same columns, renderers, selection and pagination
 * as the desktop table.
 */
export default function MobileCardList({
  columns,
  rows,
  rowKey,
  loading,
  emptyText,
  pagination,
  rowSelection,
}) {
  const getKey = (record, index) =>
    typeof rowKey === "function" ? rowKey(record) : (record?.[rowKey] ?? index);

  const actionsColumn = columns.find(isActionsColumn);
  const fieldColumns = columns.filter(
    (column) => !isActionsColumn(column) && !isEmptyNode(columnTitle(column)),
  );

  const selectedKeys = new Set(rowSelection?.selectedRowKeys || []);
  const toggleRow = (record, key, checked) => {
    if (!rowSelection) return;
    const nextKeys = checked
      ? [...selectedKeys, key]
      : [...selectedKeys].filter((value) => value !== key);
    const nextRows = rows.filter((row, index) =>
      nextKeys.includes(getKey(row, index)),
    );
    rowSelection.onSelect?.(record, checked, nextRows);
    rowSelection.onChange?.(nextKeys, nextRows);
  };

  if (loading && !rows.length) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} active paragraph={{ rows: 3 }} />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}>
      {rows.map((record, index) => {
        const key = getKey(record, index);
        const checkboxProps = rowSelection?.getCheckboxProps?.(record) || {};
        const children = Array.isArray(record?.children) ? record.children : [];
        const actions = actionsColumn
          ? renderCell(actionsColumn, record, index)
          : null;
        return (
          <article
            key={key}
            className="ej-mobile-card flex flex-col gap-3 rounded-xl border border-line bg-surface p-3"
          >
            {rowSelection ? (
              <Checkbox
                checked={selectedKeys.has(key)}
                disabled={checkboxProps.disabled}
                onChange={(event) =>
                  toggleRow(record, key, event.target.checked)
                }
              />
            ) : null}
            <CardFields columns={fieldColumns} record={record} index={index} />
            {children.length ? (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                {children.map((child, childIndex) => (
                  <div
                    key={getKey(child, childIndex)}
                    className="rounded-lg bg-subtle p-2"
                  >
                    <CardFields
                      columns={fieldColumns}
                      record={child}
                      index={childIndex}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {!isEmptyNode(actions) ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                {actions}
              </div>
            ) : null}
          </article>
        );
      })}
      {pagination ? (
        <Pagination
          size="small"
          align="center"
          current={pagination.current}
          pageSize={pagination.pageSize}
          total={pagination.total}
          showSizeChanger={false}
          onChange={pagination.onChange}
        />
      ) : null}
    </div>
  );
}
