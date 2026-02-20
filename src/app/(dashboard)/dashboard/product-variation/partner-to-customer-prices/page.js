"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import PartnerProductPriceForm from "@/components/common/forms/PartnerProductPriceForm";
import { ProductPricesAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { formatPrice, pickBasePrice, toNumeric } from "@/utils/priceHelpers";
import { useTranslations } from "@/i18n/use-translations";

const resolveBasePrice = (record) => {
  if (!record || typeof record !== "object") {
    return toNumeric(record);
  }

  const directKeys = [
    "base_price",
    "basePrice",
    "incoming_price",
    "incomingPrice",
    "company_price",
    "companyPrice",
  ];

  for (const key of directKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key];
      const numeric = toNumeric(value);
      if (numeric !== undefined) {
        return numeric;
      }
    }
  }

  const nestedKeys = [
    "partner_price",
    "partnerPrice",
    "partner",
    "parent_price",
    "parentPrice",
    "meta",
  ];

  for (const key of nestedKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const nested = pickBasePrice(record[key]);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  if (
    record?.customer_id == null &&
    record?.customer == null &&
    record?.partner_id &&
    record?.price !== undefined
  ) {
    return toNumeric(record.price);
  }

  return undefined;
};

const formatStatusTag = (value, tStatus) => {
  if (value === "active") {
    return <Tag color="green">{tStatus("active")}</Tag>;
  }
  if (value === "inactive") {
    return <Tag color="red">{tStatus("inactive")}</Tag>;
  }
  return <Tag>{value || "-"}</Tag>;
};

export default function PartnerToCustomerProductPricesPage() {
  const tableRef = useRef(null);
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.partnerProductPrice");
  const tStatus = useTranslations("common.status");
  const user = useSelector((state) => state.auth.user);
  const partnerId =
    user?.partner_id ??
    user?.partner?.id ??
    user?.partnerId ??
    user?.partner?.partner_id ??
    null;

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadProducts = async () => {
      try {
        const list = await fetchGenericList("product");
        if (alive) {
          setProducts(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadProductsError"));
        }
      }
    };

    const loadCustomers = async () => {
      try {
        const list = await fetchGenericList("customer");
        if (alive) {
          setCustomers(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadCustomersError"));
        }
      }
    };

    const loadSizes = async () => {
      try {
        const list = await fetchGenericList("product_size");
        if (alive) {
          setSizes(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadSizesError"));
        }
      }
    };

    const loadColors = async () => {
      try {
        const list = await fetchGenericList("product_color");
        if (alive) {
          setColors(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadColorsError"));
        }
      }
    };

    loadProducts();
    loadCustomers();
    loadSizes();
    loadColors();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = useMemo(() => {
    if (!partnerId) {
      return async () => ({ list: [], total: 0 });
    }
    return makeListRequest(
      ProductPricesAPI.list,
      {
        defaultSort: [{ field: "created_at", direction: "desc" }],
      },
      normalizeListAndMeta
    );
  }, [partnerId]);

  const columns = useMemo(() => {
    return [
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
        title: t("columns.customer"),
        dataIndex: "customer_id",
        sorter: true,
        filter: {
          type: "select",
          options: customers.map((customer) => ({
            value: customer.id,
            label: customer.name,
          })),
          placeholder: t("filters.selectCustomer"),
        },
        render: (_, record) => (
          <Tag color="blue">
            {record?.customer?.name || t("common.partnerSelf")}
          </Tag>
        ),
      },
      {
        title: t("columns.size"),
        dataIndex: "size_id",
        sorter: true,
        filter: {
          type: "select",
          options: sizes.map((size) => ({
            value: size.id,
            label: size.name,
          })),
          placeholder: t("filters.selectSize"),
        },
        render: (_, record) => record?.size?.name || t("common.none"),
      },
      {
        title: t("columns.color"),
        dataIndex: "color_id",
        sorter: true,
        filter: {
          type: "select",
          options: colors.map((color) => ({
            value: color.id,
            label: color.name,
          })),
          placeholder: t("filters.selectColor"),
        },
        render: (_, record) => record?.color?.name || t("common.none"),
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
        render: (value) => formatPrice(value),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        sorter: true,
        filter: {
          type: "select",
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ],
          placeholder: t("filters.selectStatus"),
        },
        render: (value) => formatStatusTag(value, tStatus),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        sorter: true,
        render: (value) =>
          value ? moment(value).format("LLL") : t("common.none"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        render: (_, record) => {
          const isCustomerAssignment =
            record?.customer_id != null || record?.customer != null;

          if (!isCustomerAssignment) {
            return (
              <Typography.Text type="secondary">
                {t("values.readOnly")}
              </Typography.Text>
            );
          }

          return (
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
          );
        },
      },
    ];
  }, [colors, customers, products, sizes, t, tStatus]);

  const onSubmit = async (values) => {
    try {
      const { base_price: _basePrice, partner_id, ...rest } = values || {};
      const payload = {
        ...rest,
      };

      if (editingRow) {
        await ProductPricesAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
      } else {
        await ProductPricesAPI.create(payload);
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
      }
      tableRef.current?.reload();
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
      await ProductPricesAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError")
      );
    }
  };

  return (
    <RequireRole anyOfRoles={["partnerAdmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          product_id: undefined,
          customer_id: undefined,
          size_id: undefined,
          color_id: undefined,
          status: undefined,
        }}
        toolbarRight={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!partnerId}
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
                name: editingRow?.customer?.name || "",
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
        <PartnerProductPriceForm
          partnerId={partnerId}
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          isEdit={Boolean(editingRow)}
          products={products}
          customers={customers}
          initialValues={
            editingRow
              ? {
                  price: editingRow?.price,
                  status: editingRow?.status,
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  customer_id:
                    editingRow?.customer_id ?? editingRow?.customer?.id,
                  size_id: editingRow?.size_id ?? editingRow?.size?.id,
                  color_id: editingRow?.color_id ?? editingRow?.color?.id,
                  base_price:
                    resolveBasePrice(editingRow?.partner_price) ??
                    resolveBasePrice(editingRow),
                }
              : undefined
          }
        />
      </Modal>
    </RequireRole>
  );
}
