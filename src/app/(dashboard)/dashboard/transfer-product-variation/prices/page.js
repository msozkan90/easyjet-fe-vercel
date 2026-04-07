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
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import TransferProductPriceForm from "@/components/common/forms/TransferProductPriceForm";
import { TransferProductPricesAPI } from "@/utils/api";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

export default function TransferProductPricesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.transferProductPrice");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [transferProducts, setTransferProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadTransferProducts = async () => {
      try {
        const list = await fetchGenericList("transfer_product");
        if (alive) {
          setTransferProducts(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadTransferProductsError"));
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

    const loadPartners = async () => {
      try {
        const list = await fetchGenericList("partner");
        if (alive) {
          setPartners(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadPartnersError"));
        }
      }
    };

    loadTransferProducts();
    loadCustomers();
    loadPartners();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    TransferProductPricesAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta,
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.transferProduct"),
        dataIndex: "transfer_product_id",
        sorter: true,
        filter: {
          type: "select",
          options: transferProducts.map((transferProduct) => ({
            value: transferProduct.id,
            label: transferProduct.name,
          })),
          placeholder: t("filters.selectTransferProduct"),
        },
        render: (_, record) =>
          record?.transfer_product?.name || t("common.none"),
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
        render: (_, record) => record?.customer?.name || t("common.none"),
      },
      {
        title: t("columns.partner"),
        dataIndex: "partner_id",
        sorter: true,
        filter: {
          type: "select",
          options: partners.map((partner) => ({
            value: partner.id,
            label: partner.name,
          })),
          placeholder: t("filters.selectPartner"),
        },
        render: (_, record) => record?.partner?.name || t("common.none"),
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
        render: (value) =>
          value !== null && value !== undefined
            ? value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : t("common.none"),
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
    [customers, partners, t, tStatus, transferProducts],
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        await TransferProductPricesAPI.update(editingRow.id, {
          price: values.price,
          status: values.status,
        });
        message.success(t("messages.updateSuccess"));
      } else {
        await TransferProductPricesAPI.create(values);
        message.success(t("messages.createSuccess"));
      }

      setOpen(false);
      setEditingRow(null);
      tableRef.current?.setPage(1);
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await TransferProductPricesAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError"),
      );
    }
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin"]} anyOfCategories={["Transfers"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          transfer_product_id: undefined,
          customer_id: undefined,
          partner_id: undefined,
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
                name: editingRow?.transfer_product?.name || "",
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
        <TransferProductPriceForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          isEdit={Boolean(editingRow)}
          transferProducts={transferProducts}
          customers={customers}
          partners={partners}
          initialValues={
            editingRow
              ? {
                  price: editingRow?.price,
                  status: editingRow?.status,
                  transfer_product_id:
                    editingRow?.transfer_product_id ??
                    editingRow?.transfer_product?.id,
                  customer_id:
                    editingRow?.customer_id ?? editingRow?.customer?.id,
                  partner_id: editingRow?.partner_id ?? editingRow?.partner?.id,
                }
              : undefined
          }
        />
      </Modal>
    </RequireRole>
  );
}
