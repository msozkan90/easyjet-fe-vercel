"use client";

import { useCallback, useMemo, useRef } from "react";
import moment from "moment";
import Link from "next/link";
import { App as AntdApp, Button, Popconfirm, Space, Tag } from "antd";
import { EyeOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { TransferOrdersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";

const STATUS_COLORS = {
  newOrder: "blue",
  waitingForDesign: "gold",
  readyForProduction: "purple",
  processing: "geekblue",
  pdf: "cyan",
  completed: "green",
  shipped: "volcano",
  cancel: "red",
};

export default function TransferOrdersListPage() {
  const tableRef = useRef(null);
  const { message } = AntdApp.useApp();

  const request = useMemo(
    () =>
      makeListRequest(
        TransferOrdersAPI.list,
        {
          defaultSort: [{ field: "order_date", direction: "desc" }],
          filterTransform: (filters = {}) => {
            const next = { ...filters };
            const orderDate = next.order_date;
            if (orderDate?.gte || orderDate?.lte) {
              next.date_from = orderDate?.gte;
              next.date_to = orderDate?.lte;
            } else {
              delete next.date_from;
              delete next.date_to;
            }
            return next;
          },
        },
        normalizeListAndMeta,
      ),
    [],
  );

  const handleDelete = useCallback(async (record) => {
    if (!record?.id) return;
    try {
      await TransferOrdersAPI.remove(record.id);
      message.success("Transfer order deleted successfully");
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || "Failed to delete transfer order",
      );
    }
  }, [message]);

  const columns = useMemo(
    () => [
      {
        title: "Order Number",
        dataIndex: "order_number",
        sorter: true,
        filter: { type: "text", placeholder: "Search order number" },
      },
      {
        title: "Order Name",
        dataIndex: "order_name",
        filter: { type: "text", placeholder: "Search order name" },
      },
      {
        title: "Status",
        dataIndex: "order_status",
        filter: {
          type: "select",
          options: Object.keys(STATUS_COLORS).map((value) => ({
            value,
            label: value,
          })),
          placeholder: "Select status",
        },
        render: (value) => <Tag color={STATUS_COLORS[value] || "default"}>{value || "-"}</Tag>,
      },
      {
        title: "Customer",
        dataIndex: "bill_to_name",
        sorter: true,
      },
      {
        title: "Items",
        dataIndex: "item_count",
        sorter: true,
      },
      {
        title: "Order Date",
        dataIndex: "order_date",
        sorter: true,
        filter: { type: "dateRange", placeholder: "Order date" },
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        render: (_, record) => (
          <Space>
            <Link href={`/dashboard/transfer-orders/orders/${record?.order_number || ""}`}>
              <Button icon={<EyeOutlined />} />
            </Link>
            <Popconfirm
              title="Delete this transfer order?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Button icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete],
  );

  return (
    <RequireRole
      anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
      anyOfCategories={["Transfers"]}
    >
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          order_number: "",
          search: "",
          order_status: undefined,
          order_date: undefined,
        }}
      />
    </RequireRole>
  );
}
