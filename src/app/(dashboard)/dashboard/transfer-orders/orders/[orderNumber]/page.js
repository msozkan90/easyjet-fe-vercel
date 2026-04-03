"use client";

import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { useParams } from "next/navigation";
import {
  App as AntdApp,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { TransferOrdersAPI } from "@/utils/api";

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

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return value;
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function TransferOrderDetailPage() {
  const { message } = AntdApp.useApp();
  const params = useParams();
  const orderNumber = useMemo(() => String(params?.orderNumber || ""), [params]);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!orderNumber) {
        if (active) {
          setDetail(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const response = await TransferOrdersAPI.detail(orderNumber);
        if (!active) return;
        setDetail(response?.data || null);
      } catch (error) {
        if (!active) return;
        setDetail(null);
        message.error(
          error?.response?.data?.error?.message || "Failed to load transfer order detail",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [message, orderNumber]);

  const itemColumns = useMemo(
    () => [
      {
        title: "SKU",
        dataIndex: "sku",
        render: (value) => value || "-",
      },
      {
        title: "Name",
        dataIndex: "name",
        render: (value) => value || "-",
      },
      {
        title: "Product",
        dataIndex: "transfer_product",
        render: (_, record) => record?.transfer_product?.name || "-",
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        width: 80,
      },
      {
        title: "Price",
        dataIndex: "price",
        render: (value) => formatAmount(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (value) => <Tag color={STATUS_COLORS[value] || "default"}>{value || "-"}</Tag>,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!detail) {
    return <Empty description="Transfer order not found" />;
  }

  return (
    <RequireRole
      anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}
      anyOfCategories={["Transfers"]}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              Transfer Order #{detail?.order_number || "-"}
            </Typography.Title>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
              <Descriptions.Item label="Order Name">{detail?.order_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[detail?.order_status] || "default"}>
                  {detail?.order_status || "-"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{detail?.bill_to_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Order Date">
                {detail?.order_date ? moment(detail.order_date).format("LLL") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Currency">{detail?.currency || "-"}</Descriptions.Item>
              <Descriptions.Item label="Total">{formatAmount(detail?.order_total)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Items">
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={Array.isArray(detail?.items) ? detail.items : []}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </RequireRole>
  );
}
