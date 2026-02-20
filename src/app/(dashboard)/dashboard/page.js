"use client";

import { Card, Statistic, Row, Col, Table } from "antd";
import { useEffect, useState } from "react";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

export default function DashboardHome() {
  const [count, setCount] = useState(0);
  const [latest, setLatest] = useState([]);
  const tStats = useTranslations("dashboard.stats");
  const tTable = useTranslations("dashboard.table");

  useEffect(() => {
    (async () => {
      try {
        const list = await OrdersAPI.list({ page: 1, pageSize: 5 });
        setCount(list?.total || 0);
        setLatest(list?.items || []);
      } catch {
        // veri yüklenemezse sessiz devam et
      }
    })();
  }, []);

  const columns = [
    { title: tTable("columns.orderNo"), dataIndex: "orderNo", width: 140 },
    { title: tTable("columns.customerName"), dataIndex: "customerName" },
    { title: tTable("columns.status"), dataIndex: "status", width: 160 },
  ];

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={tStats("totalOrders")} value={count} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={tStats("pending")} value={12} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title={tStats("completed")} value={34} />
          </Card>
        </Col>
      </Row>

      <Card title={tTable("title")}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={latest}
          pagination={false}
          scroll={{ x: true }}
        />
      </Card>
    </>
  );
}
