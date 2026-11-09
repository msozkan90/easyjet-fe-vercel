"use client";

import { useEffect, useState } from "react";
import { Tabs } from "antd";
import OrdersPdfPage from "@/components/orders-pdf/OrdersPdfPage";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import RexvenLabelBatchesPanel from "./RexvenLabelBatchesPanel";

/** PDF'ler sayfası: company'nin Rexven müşterisi varsa "Rexven Etiketleri" sekmesi eklenir. */
export default function OrdersPdfWithRexvenTabs({ categoryId, subCategoryId }) {
  const t = useTranslations("dashboard.orders.rexvenLabels");
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    let active = true;
    OrdersAPI.rexvenLabelContext()
      .then((response) => {
        if (!active) return;
        const data = response?.data ?? {};
        setCustomers(Array.isArray(data.customers) ? data.customers : []);
      })
      .catch(() => {
        if (active) setCustomers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const pdfPage = <OrdersPdfPage categoryId={categoryId} subCategoryId={subCategoryId} />;
  if (!customers.length) return pdfPage;

  return (
    <Tabs
      defaultActiveKey="pdfs"
      destroyInactiveTabPane
      items={[
        { key: "pdfs", label: t("tabs.pdfs"), children: pdfPage },
        {
          key: "rexven",
          label: t("tabs.rexven"),
          children: <RexvenLabelBatchesPanel customers={customers} />,
        },
      ]}
    />
  );
}
