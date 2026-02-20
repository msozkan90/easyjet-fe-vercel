"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import ProductSizeMapperForm from "@/components/common/forms/ProductSizeMapperForm";
import { ProductSizeMappersAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

export default function ProductMapperSizesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productSizeMapper");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
  const [sizes, setSizes] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadProducts = async () => {
      try {
        const list = await fetchGenericList("product");
        if (alive) setProducts(list || []);
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
    ProductSizeMappersAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta
  );

  const productOptions = useMemo(
    () =>
      products
        .filter((product) => product?.id)
        .map((product) => ({
          value: product.id,
          label: product.name,
        })),
    [products]
  );

  const sizeOptions = useMemo(
    () =>
      sizes
        .filter((size) => size?.id)
        .map((size) => ({
          value: size.id,
          label: size.name,
        })),
    [sizes]
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.product"),
        dataIndex: "product_id",
        sorter: true,
        filter: {
          type: "select",
          options: productOptions,
          placeholder: t("filters.selectProduct"),
        },
        render: (_, record) => record?.product?.name || t("common.none"),
      },
      {
        title: t("columns.size"),
        dataIndex: "size_id",
        sorter: true,
        filter: {
          type: "select",
          options: sizeOptions,
          placeholder: t("filters.selectSize"),
        },
        render: (_, record) => record?.size?.name || t("common.none"),
      },
      {
        title: t("columns.mapper"),
        dataIndex: "size_mapper",
        sorter: true,
        filter: {
          type: "text",
          placeholder: t("filters.searchMapper"),
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
        width: 110,
        fixed: "right",
        render: (_, record) => (
          <Space>
            <Popover content={t("actions.edit")}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              />
            </Popover>
            <Popover content={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Popover>
          </Space>
        ),
      },
    ],
    [productOptions, sizeOptions, t, tStatus]
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        await ProductSizeMappersAPI.update(editingRow.id, values);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await ProductSizeMappersAPI.create(values);
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
      setOpen(false);
      setEditingRow(null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed")
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await ProductSizeMappersAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError")
      );
    }
  };

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          product_id: undefined,
          size_id: undefined,
          size_mapper: "",
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
            ? t("modal.editTitle", {
                name: editingRow?.size_mapper || "",
              })
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
        <ProductSizeMapperForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          products={products}
          isEdit={Boolean(editingRow)}
          initialValues={
            editingRow
              ? {
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  size_id: editingRow?.size_id ?? editingRow?.size?.id,
                  size_mapper: editingRow?.size_mapper,
                  status: editingRow?.status,
                }
              : undefined
          }
        />
      </Modal>
    </RequireRole>
  );
}
