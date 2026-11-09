"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Space, Tooltip } from "antd";
import {
  DownloadOutlined,
  FileSearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import OrdersStatusListPage from "../../../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { useTranslations } from "@/i18n/use-translations";
import { useRexvenAwarePdfDownload } from "@/components/orders/rexven/useRexvenAwarePdfDownload";
import OrderItemPackingSlipButton from "@/components/orders/OrderItemPackingSlipButton";
import DesignFlawModal from "@/components/orders/design-flaws/DesignFlawModal";

const fetchProducts = () => fetchGenericList("product");

export default function SubCategoryViewOrderPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  const tCommonActions = useTranslations("common.actions");
  const tableRef = useRef(null);
  const [designFlawItem, setDesignFlawItem] = useState(null);
  const tDesignFlaws = useTranslations("dashboard.orders.designFlaws");

  const listApiFn = useMemo(
    () => async (payload) => {
      const nextFilters = {
        ...(payload?.filters || {}),
        category: categoryId,
        sub_category: subCategoryId,
      };
      return OrdersAPI.workerCompletedItemsList({
        ...(payload || {}),
        filters: nextFilters,
      });
    },
    [categoryId, subCategoryId],
  );

  const downloadKey = `orders-pdf:create:${categoryId}:${subCategoryId}`;
  const downloadPayload = useMemo(
    () =>
      categoryId
        ? {
            category_id: categoryId,
            ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
          }
        : null,
    [categoryId, subCategoryId],
  );
  const reloadTable = useCallback(() => tableRef.current?.reload?.(), []);
  const { handleDownload, loading: downloadLoading } = useRexvenAwarePdfDownload({
    downloadKey,
    payload: downloadPayload,
    onDone: reloadTable,
  });

  const toolbarRight = (
    <Button
      icon={<DownloadOutlined />}
      onClick={handleDownload}
      loading={downloadLoading}
    >
      {tCommonActions("downloadPdf")}
    </Button>
  );

  const columnsBuilder = useCallback(
    (columns) => [
      ...columns,
      {
        title: tDesignFlaws("fields.actions"),
        key: "actions",
        fixed: "right",
        width: 160,
        render: (_, record) => {
          const orderNumber =
            record?.order?.order_number || record?.order_number;
          return (
            <Space>
              {orderNumber ? (
                <Tooltip title={tDesignFlaws("actions.detail")}>
                  <Button
                    icon={<FileSearchOutlined />}
                    href={`/dashboard/order/detail/${orderNumber}`}
                  />
                </Tooltip>
              ) : null}
              <OrderItemPackingSlipButton
                orderItem={record}
                categoryId={categoryId}
                subCategoryId={subCategoryId}
              />
              {["pdf", "completed"].includes(record?.status) ? (
                <Tooltip title={tDesignFlaws("actions.mark")}>
                  <Button
                    danger
                    icon={<WarningOutlined />}
                    onClick={() => setDesignFlawItem(record)}
                  />
                </Tooltip>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [categoryId, subCategoryId, tDesignFlaws],
  );

  return (
    <>
      <OrdersStatusListPage
        listApiFn={listApiFn}
        tableRefExternal={tableRef}
        allowedStatuses={["processing", "pdf", "completed"]}
        defaultSort={[
          { field: "status", direction: "asc" },
          { field: "order_date", direction: "asc" },
        ]}
        requireRoles={["companyCompletedWorker"]}
        productListFetcher={fetchProducts}
        affilated
        enableProductionNotes
        toolbarRight={toolbarRight}
        columnsBuilder={columnsBuilder}
      />
      <DesignFlawModal
        open={Boolean(designFlawItem)}
        orderItem={designFlawItem}
        onCancel={() => setDesignFlawItem(null)}
        onSaved={() => {
          setDesignFlawItem(null);
          tableRef.current?.reload?.();
        }}
      />
    </>
  );
}
