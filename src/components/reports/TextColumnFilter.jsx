"use client";

import { Button, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

/**
 * Text filter dropdown for report tables; same layout as CrudTable filters.
 */
export default function TextColumnFilter({
  placeholder,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
  labels,
}) {
  return (
    <div
      className="flex w-[260px] flex-col"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="p-3">
        <Input
          autoFocus
          allowClear
          prefix={<SearchOutlined className="text-ink-400" />}
          placeholder={placeholder}
          value={selectedKeys?.[0]}
          onChange={(event) =>
            setSelectedKeys(event.target.value ? [event.target.value] : [])
          }
          onPressEnter={() => confirm()}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5 border-t border-line px-3 py-2">
        <Button
          size="small"
          onClick={() => {
            clearFilters?.();
            confirm();
          }}
        >
          {labels.reset}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<SearchOutlined />}
          onClick={() => confirm()}
        >
          {labels.search}
        </Button>
      </div>
    </div>
  );
}
