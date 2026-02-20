"use client";

import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { App as AntdApp, Tag } from "antd";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
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

const resolveAssignedPrice = (record) => {
  const direct = toNumeric(record?.price);
  if (direct !== undefined) {
    return direct;
  }
  const nested = pickBasePrice(record?.partner_price);
  if (nested !== undefined) {
    return nested;
  }
  return resolveBasePrice(record);
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

export default function PartnerProductPricesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.partnerAssignedPrice");
  const tStatus = useTranslations("common.status");
  const user = useSelector((state) => state.auth.user);
  const partnerId =
    user?.partner_id ??
    user?.partner?.id ??
    user?.partnerId ??
    user?.partner?.partner_id ??
    null;

  const [products, setProducts] = useState([]);
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
      ProductPricesAPI.assigned,
      {
        defaultSort: [{ field: "created_at", direction: "desc" }],
        fixedFilters: { partner_id: partnerId, customer_id: null },
      },
      normalizeListAndMeta
    );
  }, [partnerId]);

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
        render: (_, record) => formatPrice(resolveAssignedPrice(record)),
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
    ],
    [colors, products, sizes, t, tStatus]
  );

  const tableProps = useMemo(
    () => ({
      locale: {
        emptyText: partnerId ? t("table.noData") : t("messages.partnerMissing"),
      },
      scroll: { x: true },
    }),
    [partnerId, t]
  );

  return (
    <RequireRole anyOfRoles={["partnerAdmin"]}>
      <CrudTable
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          product_id: undefined,
          size_id: undefined,
          color_id: undefined,
          status: undefined,
        }}
        tableProps={tableProps}
      />
    </RequireRole>
  );
}
