"use client";

import { useCallback, useMemo, useRef } from "react";
import { Button, Space, Tag, Tooltip } from "antd";
import { DownloadOutlined, FileSearchOutlined } from "@ant-design/icons";
import OrdersStatusListPage from "@/app/(dashboard)/dashboard/orders/OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { getBlobErrorMessage } from "@/utils/apiHelpers";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";
import { useTranslations } from "@/i18n/use-translations";

const fetchProducts = () => fetchGenericList("product");

export default function DesignFlawItemsPage({ categoryId, subCategoryId }) {
  const tableRef = useRef(null);
  const { enqueueDownload, isDownloading } = useDownloadQueue();
  const t = useTranslations("dashboard.orders.designFlaws");

  const listApiFn = useMemo(
    () => async (payload) =>
      OrdersAPI.designFlawItemsList({
        ...(payload || {}),
        filters: {
          ...(payload?.filters || {}),
          category: categoryId,
          ...(subCategoryId ? { sub_category: subCategoryId } : {}),
        },
      }),
    [categoryId, subCategoryId],
  );

  const downloadKey = `orders:design-flaws:${categoryId}:${subCategoryId || "root"}`;
  const handleDownload = useCallback(() => {
    enqueueDownload({
      key: downloadKey,
      title: t("actions.download"),
      fallbackFilename: "design-flaws.zip",
      request: (config) =>
        OrdersAPI.downloadDesignFlaws(
          {
            category_id: categoryId,
            ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
          },
          config,
        ),
      onSuccess: () => tableRef.current?.reload?.(),
      getErrorMessage: (error) =>
        getBlobErrorMessage(error, t("messages.downloadFailed")),
    });
  }, [categoryId, downloadKey, enqueueDownload, subCategoryId, t]);

  const columnsBuilder = useCallback(
    (columns) => [
      ...columns,
      {
        title: t("fields.missingGroups"),
        key: "missingGroups",
        width: 240,
        render: (_, record) => (
          <Space wrap size={[4, 4]}>
            {(record?.design_flaw?.groups || []).map((group, index) => (
              <Tag key={group.id || group.group_key} color="volcano">
                {group.is_legacy
                  ? t("groups.legacy")
                  : t("groups.number", { number: index + 1 })}
                : {group.missing_quantity}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: t("fields.actions"),
        key: "actions",
        fixed: "right",
        width: 80,
        render: (_, record) => {
          const orderNumber =
            record?.order?.order_number || record?.order_number;
          return orderNumber ? (
            <Tooltip title={t("actions.detail")}>
              <Button
                icon={<FileSearchOutlined />}
                href={`/dashboard/order/detail/${orderNumber}`}
              />
            </Tooltip>
          ) : null;
        },
      },
    ],
    [t],
  );

  return (
    <OrdersStatusListPage
      listApiFn={listApiFn}
      tableRefExternal={tableRef}
      allowedStatuses={["designFlaw"]}
      enableStatusFilter={false}
      requireRoles={["companyCompletedWorker", "companyAdmin"]}
      productListFetcher={fetchProducts}
      affilated
      columnsBuilder={columnsBuilder}
      toolbarRight={
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          loading={isDownloading(downloadKey)}
        >
          {t("actions.download")}
        </Button>
      }
    />
  );
}
