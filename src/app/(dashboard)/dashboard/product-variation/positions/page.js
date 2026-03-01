"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Image,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import ProductPositionForm from "@/components/common/forms/ProductPositionForm";
import { ProductPositionsAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { buildSingleFileSubmitPayload } from "@/utils/formDataHelpers";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import {
  extractDesignAreaFromRecord,
  serializeDesignArea,
} from "@/utils/designArea";

export default function ProductPositionsPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productPosition");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadProducts = async () => {
      try {
        const list = await fetchGenericList("product");
        if (alive) setProducts(list);
      } catch {
        if (alive) {
          message.error(t("messages.loadProductsError"));
        }
      }
    };

    loadProducts();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    ProductPositionsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta,
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.product"),
        dataIndex: "product_id",
        sorter: true,
        filter: {
          type: "select",
          options: products.map((product) => ({
            value: product.id,
            label: product.name,
          })),
          placeholder: t("filters.selectProduct"),
        },
        render: (_, record) => record?.product?.name || t("common.none"),
      },
      {
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
      },
      {
        title: t("columns.image"),
        dataIndex: "images",
        width: 120,
        render: (value, record) => {
          const url = value?.[0]?.image_url ?? record?.images?.[0]?.image_url;
          return url ? (
            <Image
              src={url}
              width={64}
              height={64}
              loading="lazy"
              style={{ objectFit: "cover", borderRadius: 8 }}
              preview={{ mask: <EyeOutlined /> }}
            />
          ) : (
            t("common.none")
          );
        },
      },

      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        sorter: true,
        filter: {
          type: "select",
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ],
          placeholder: t("filters.selectStatus"),
        },
        render: (value) =>
          value === "active" ? (
            <Tag color="green">{tStatus("active")}</Tag>
          ) : (
            <Tag color="red">{tStatus("inactive")}</Tag>
          ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        width: 180,
        sorter: true,
        render: (value) =>
          value ? moment(value).format("LLL") : t("common.none"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 90,
        render: (_, record) => (
          <Space>
            <Popover content={t("actions.edit")}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              ></Button>
            </Popover>
            <Popover content={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button icon={<DeleteOutlined />} danger></Button>
              </Popconfirm>
            </Popover>
          </Space>
        ),
      },
    ],
    [products, t, tStatus],
  );

  const onSubmit = async (values) => {
    const payload = { ...values };
    const serializedArea = serializeDesignArea(values?.design_area);
    if (serializedArea !== undefined) {
      payload.design_area = serializedArea;
    } else {
      delete payload.design_area;
    }

    const { data, config } = buildSingleFileSubmitPayload(payload, {
      fileField: "image",
      formDataField: "image",
    });

    try {
      if (editingRow) {
        await ProductPositionsAPI.update(editingRow.id, data, config);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await ProductPositionsAPI.create(data, config);
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
      setOpen(false);
      setEditingRow(null);
    } catch (error) {
      console.log(error, "error");
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await ProductPositionsAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError"),
      );
    }
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          name: "",
          product_id: undefined,
          status: undefined,
        }}
        toolbarRight={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRow(null);
              setOpen(true);
            }}
          >
            {t("actions.new")}
          </Button>
        }
        tableProps={{
          locale: { emptyText: t("table.noData") },
          scroll: { x: true },
        }}
      />

      <Modal
        title={
          editingRow
            ? t("modal.editTitle", { name: editingRow?.name || "" })
            : t("modal.createTitle")
        }
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <ProductPositionForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          isEdit={Boolean(editingRow)}
          products={products}
          initialValues={
            editingRow
              ? {
                  name: editingRow?.name,
                  status: editingRow?.status,
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  image_url: editingRow?.images?.[0]?.image_url,
                  design_area: extractDesignAreaFromRecord(editingRow),
                }
              : undefined
          }
        />
      </Modal>
    </RequireRole>
  );
}
