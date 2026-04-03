"use client";

import { Layout, Menu, theme } from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
  ApartmentOutlined,
  TeamOutlined,
  ShoppingOutlined,
  CloseCircleOutlined,
  LineChartOutlined,
  BankOutlined,
  DollarOutlined,
  AntDesignOutlined,
  PartitionOutlined,
  AppstoreOutlined,
  BgColorsOutlined,
  GatewayOutlined,
  PictureOutlined,
  DollarCircleOutlined,
  TagsOutlined,
} from "@ant-design/icons";

import Link from "next/link";
import { useSelector } from "react-redux";
import Image from "next/image";
import { useTranslations } from "@/i18n/use-translations";

const { Sider } = Layout;

export default function Sidebar({ collapsed }) {
  const user = useSelector((s) => s.auth.user);
  const roles = user?.roles || [];
  const isSystemAdmin = roles.includes("systemadmin");
  const isCompanyAdmin = roles.includes("companyadmin");
  const isCompanyCompletedWorker = roles.includes("companycompletedworker");
  const isShipmentWorker = roles.includes("companyshipmentworker");
  const isPartnerAdmin = roles.includes("partneradmin");
  const isCustomerAdmin = roles.includes("customeradmin");
  const userCategoryNames = new Set(
    (user?.user_categories || [])
      .map((category) => {
        if (!category) return null;
        if (typeof category === "string") return category.trim().toLowerCase();
        return String(category?.name || "").trim().toLowerCase();
      })
      .filter(Boolean),
  );
  const hasTransferOrderCategory =
    userCategoryNames.has("transfers");
  const hasStandardProductVariationCategory =
    userCategoryNames.has("print") ||
    userCategoryNames.has("apparel") ||
    userCategoryNames.has("engraving");
  const hasTransferOrdersAccess =
    hasTransferOrderCategory &&
    (isCompanyAdmin || isPartnerAdmin || isCustomerAdmin);
  const isFinancialUser = isCompanyAdmin || isPartnerAdmin || isCustomerAdmin;
  const categoriesData = useSelector(
    (s) => s.categories?.listWithSubCategories,
  );
  const { token } = theme.useToken();
  const tSidebar = useTranslations("dashboard.sidebar");

  const userCategoryIds = new Set(
    (user?.user_categories || [])
      .map((category) => {
        if (!category) return null;
        if (typeof category === "string" || typeof category === "number") {
          return String(category);
        }
        return (
          category.id ||
          category.category_id ||
          category.categoryId ||
          category.value
        );
      })
      .filter(Boolean)
      .map(String),
  );

  const categoriesList = (() => {
    if (Array.isArray(categoriesData)) return categoriesData;
    if (Array.isArray(categoriesData?.items)) return categoriesData.items;
    if (Array.isArray(categoriesData?.data)) return categoriesData.data;
    return [];
  })();

  const filteredCategories = categoriesList.filter((category) =>
    userCategoryIds.has(String(category?.id)),
  );

  const buildCategoryMenuItems = () =>
    filteredCategories.map((category) => {
      const subCategories = Array.isArray(category?.sub_categories)
        ? category.sub_categories
        : [];

      const categoryItems = [
        {
          key: `category-${category.id}-view-order`,
          label: (
            <Link href={`/dashboard/orders/${category.id}/view-order`}>
              View Order
            </Link>
          ),
        },
        {
          key: `category-${category.id}-printer`,
          label: (
            <Link href={`/dashboard/orders/${category.id}/printer`}>
              Printer
            </Link>
          ),
        },
      ];

      const subCategoryItems = subCategories.map((subCategory) => ({
        key: `subcategory-${category.id}-${subCategory.id}`,
        icon: <TagsOutlined />,
        label: subCategory.name || "Sub Category",
        children: [
          {
            key: `subcategory-${category.id}-${subCategory.id}-view-order`,
            label: (
              <Link
                href={`/dashboard/orders/${category.id}/${subCategory.id}/view-order`}
              >
                View Order
              </Link>
            ),
          },
          {
            key: `subcategory-${category.id}-${subCategory.id}-printer`,
            label: (
              <Link
                href={`/dashboard/orders/${category.id}/${subCategory.id}/printer`}
              >
                Printer
              </Link>
            ),
          },
        ],
      }));

      return {
        key: `category-${category.id}`,
        icon: <AppstoreOutlined />,
        label: category.name || "Category",
        children: [...categoryItems, ...subCategoryItems],
      };
    });

  const buildShipmentOrdersMenuItem = () => ({
    key: "shipment-orders",
    icon: <ShoppingCartOutlined />,
    label: tSidebar("orders.title"),
    children: [
      {
        key: "shipment-orders-view-order",
        label: <Link href="/dashboard/orders/view-order">View Order</Link>,
      },
      {
        key: "shipment-orders-printer",
        label: <Link href="/dashboard/orders/printer">Printer</Link>,
      },
    ],
  });

  const items = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">{tSidebar("dashboard")}</Link>,
    },
    ...(isCompanyCompletedWorker ? buildCategoryMenuItems() : []),
    ...(isShipmentWorker ? [buildShipmentOrdersMenuItem()] : []),
    ...(isFinancialUser
      ? [
          {
            key: "financial",
            icon: <DollarOutlined />,
            label: tSidebar("financial.title"),
            children: [
              {
                key: "wallet-topups",
                icon: <DollarOutlined />,
                label: (
                  <Link href="/dashboard/financial/topups">
                    {tSidebar("financial.topupList")}
                  </Link>
                ),
              },
              ...(isCompanyAdmin
                ? [
                    {
                      key: "financial-report",
                      icon: <LineChartOutlined />,
                      label: (
                        <Link href="/dashboard/financial-report">
                          {tSidebar("financial.report")}
                        </Link>
                      ),
                    },
                    {
                      key: "payment-management",
                      icon: <BankOutlined />,
                      label: (
                        <Link href="/dashboard/payment-management">
                          {tSidebar("financial.paymentManagement")}
                        </Link>
                      ),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...(isSystemAdmin
      ? [
          {
            key: "financial-admin",
            icon: <DollarOutlined />,
            label: tSidebar("financial.adminTitle"),
            children: [
              {
                key: "financial-admin-topups",
                icon: <BankOutlined />,
                label: (
                  <Link href="/dashboard/financial/admin/topups">
                    {tSidebar("financial.adminTopups")}
                  </Link>
                ),
              },
              {
                key: "financial-admin-funding-accounts",
                icon: <DollarCircleOutlined />,
                label: (
                  <Link href="/dashboard/financial/admin/funding-accounts">
                    {tSidebar("financial.fundingAccounts")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isCompanyAdmin
      ? [
          {
            key: "partner",
            icon: <PartitionOutlined />,
            label: tSidebar("partner.title"),
            children: [
              {
                key: "partner-list",
                icon: <PartitionOutlined />,
                label: (
                  <Link href="/dashboard/partner">
                    {tSidebar("partner.partners")}
                  </Link>
                ),
              },
              {
                key: "partner-admins",
                icon: <TeamOutlined />,
                label: (
                  <Link href="/dashboard/partner/admins">
                    {tSidebar("partner.admins")}
                  </Link>
                ),
              },
              {
                key: "partner-permissions",
                icon: <SettingOutlined />,
                label: (
                  <Link href="/dashboard/partner/permissions">
                    {tSidebar("partner.permissions")}
                  </Link>
                ),
              },
            ],
          },
          ...(hasStandardProductVariationCategory
            ? [
                {
                  key: "product-variation",
                  icon: <AppstoreOutlined />,
                  label: tSidebar("productVariation.title"),
                  children: [
                    {
                      key: "product-variation-products",
                      icon: <AppstoreOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/products">
                          {tSidebar("productVariation.products")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-sizes",
                      icon: <TagsOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/sizes">
                          {tSidebar("productVariation.sizes")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-colors",
                      icon: <BgColorsOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/colors">
                          {tSidebar("productVariation.colors")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-positions",
                      icon: <GatewayOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/positions">
                          {tSidebar("productVariation.positions")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-additional-prices",
                      icon: <DollarCircleOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/additional-prices">
                          {tSidebar("productVariation.additionalPrices")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-stock",
                      icon: <DollarOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/stock">
                          {tSidebar("productVariation.stock")}
                        </Link>
                      ),
                    },
                    {
                      key: "product-variation-prices",
                      icon: <DollarOutlined />,
                      label: (
                        <Link href="/dashboard/product-variation/prices">
                          {tSidebar("productVariation.prices")}
                        </Link>
                      ),
                    },
                  ],
                },
              ]
            : []),
          ...(hasTransferOrderCategory
            ? [
                {
                  key: "transfer-product-variation",
                  icon: <AppstoreOutlined />,
                  label: tSidebar("transferProductVariation.title"),
                  children: [
                    {
                      key: "transfer-product-variation-products",
                      icon: <AppstoreOutlined />,
                      label: (
                        <Link href="/dashboard/transfer-product-variation/products">
                          {tSidebar("transferProductVariation.products")}
                        </Link>
                      ),
                    },
                  ],
                },
              ]
            : []),
        ]
      : []),
    ...(isCompanyAdmin
      ? [
          {
            key: "customer",
            icon: <ApartmentOutlined />,
            label: tSidebar("customer.title"),
            children: [
              {
                key: "customer-list",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/customer">
                    {tSidebar("customer.customers")}
                  </Link>
                ),
              },
              {
                key: "customer-admins",
                icon: <TeamOutlined />,
                label: (
                  <Link href="/dashboard/customer/admins">
                    {tSidebar("customer.admins")}
                  </Link>
                ),
              },
              {
                key: "customer-permissions",
                icon: <SettingOutlined />,
                label: (
                  <Link href="/dashboard/customer/permissions">
                    {tSidebar("customer.permissions")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isCustomerAdmin
      ? [
          {
            key: "product-mapper",
            icon: <AppstoreOutlined />,
            label: tSidebar("productMapper.title"),
            children: [
              {
                key: "product-mapper-products",
                icon: <AppstoreOutlined />,
                label: (
                  <Link href="/dashboard/product-mapper/products">
                    {tSidebar("productMapper.products")}
                  </Link>
                ),
              },
              {
                key: "product-mapper-sizes",
                icon: <GatewayOutlined />,
                label: (
                  <Link href="/dashboard/product-mapper/sizes">
                    {tSidebar("productMapper.sizes")}
                  </Link>
                ),
              },
              {
                key: "product-mapper-colors",
                icon: <BgColorsOutlined />,
                label: (
                  <Link href="/dashboard/product-mapper/colors">
                    {tSidebar("productMapper.colors")}
                  </Link>
                ),
              },
            ],
          },
          {
            key: "order",
            icon: <ApartmentOutlined />,
            label: tSidebar("order.title"),
            children: [
              {
                key: "order-pool",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/pre-orders">
                    {tSidebar("order.preOrders")}
                  </Link>
                ),
              },
              {
                key: "pending-orders",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/orders/pending">
                    {tSidebar("order.pending")}
                  </Link>
                ),
              },
              {
                key: "in-production-orders",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/orders/in-production">
                    {tSidebar("order.inProduction")}
                  </Link>
                ),
              },
              {
                key: "completed-orders",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/orders/completed">
                    {tSidebar("order.completed")}
                  </Link>
                ),
              },
              {
                key: "shipped-orders",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/orders/shipped">
                    {tSidebar("order.shipped")}
                  </Link>
                ),
              },
              {
                key: "refund-remake-orders",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/orders/refund-remake">
                    {tSidebar("order.refundRemake")}
                  </Link>
                ),
              },

              {
                key: "cancel-orders",
                icon: <CloseCircleOutlined />,
                label: (
                  <Link href="/dashboard/orders/cancel">
                    {tSidebar("orders.cancel")}
                  </Link>
                ),
              },
              // {
              //   key: "customer-admins",
              //   icon: <TeamOutlined />,
              //   label: (
              //     <Link href="/dashboard/customer/admins">Customer Admins</Link>
              //   ),
              // },
            ],
          },
          ...(hasTransferOrdersAccess
            ? [
                {
                  key: "transfer-orders",
                  icon: <ShoppingCartOutlined />,
                  label: tSidebar("order.transferOrders"),
                  children: [
                    {
                      key: "transfer-order-pool",
                      icon: <ApartmentOutlined />,
                      label: (
                        <Link href="/dashboard/transfer-orders">
                          {tSidebar("order.transferOrderPool")}
                        </Link>
                      ),
                    },
                    {
                      key: "transfer-order-list",
                      icon: <ApartmentOutlined />,
                      label: (
                        <Link href="/dashboard/transfer-orders/orders">
                          {tSidebar("order.transferOrdersList")}
                        </Link>
                      ),
                    },
                  ],
                },
              ]
            : []),
        ]
      : []),
    ...(hasTransferOrdersAccess && !isCustomerAdmin
      ? [
          {
            key: "transfer-orders-shortcut",
            icon: <ShoppingCartOutlined />,
            label: tSidebar("order.transferOrders"),
            children: [
              {
                key: "transfer-orders-shortcut-pool",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/transfer-orders">
                    {tSidebar("order.transferOrderPool")}
                  </Link>
                ),
              },
              {
                key: "transfer-orders-shortcut-list",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/transfer-orders/orders">
                    {tSidebar("order.transferOrdersList")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isCompanyAdmin || isPartnerAdmin
      ? [
          {
            key: "orders-affiliated",
            icon: <ShoppingCartOutlined />,
            label: tSidebar("orders.title"),
            children: [
              {
                key: "orders-affiliated-production",
                icon: <ShoppingCartOutlined />,
                label: (
                  <Link href="/dashboard/orders/affiliated/production">
                    {tSidebar("order.inProduction")}
                  </Link>
                ),
              },
              {
                key: "orders-affiliated-completed",
                icon: <ShoppingCartOutlined />,
                label: (
                  <Link href="/dashboard/orders/affiliated/completed">
                    {tSidebar("order.completed")}
                  </Link>
                ),
              },
              {
                key: "orders-affiliated-shipped",
                icon: <ShoppingCartOutlined />,
                label: (
                  <Link href="/dashboard/orders/affiliated/shipped">
                    {tSidebar("order.shipped")}
                  </Link>
                ),
              },
              ...(isCompanyAdmin
                ? [
                    {
                      key: "orders-affiliated-refund-remake",
                      icon: <ShoppingCartOutlined />,
                      label: (
                        <Link href="/dashboard/orders/affiliated/refund-remake">
                          {tSidebar("order.refundRemake")}
                        </Link>
                      ),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...(isCompanyAdmin
      ? [
          {
            type: "divider",
            key: "company-admin-divider",
            // kalınlaştır divider
            style: {  borderBottom: "1.4px solid #f0f0f0", margin: "18px 0" },
          },
          {
            key: "my-company",
            icon: <ApartmentOutlined />,
            label: tSidebar("myCompany.title"),
            children: [
              {
                key: "my-company-users",
                icon: <TeamOutlined />,
                label: (
                  <Link href="/dashboard/company/users">
                    {tSidebar("myCompany.users")}
                  </Link>
                ),
              },
              {
                key: "my-company-settings",
                icon: <SettingOutlined />,
                label: (
                  <Link href="/dashboard/company/permissions">
                    {tSidebar("myCompany.settings")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isPartnerAdmin
      ? [
          {
            key: "partner-product-variation",
            icon: <AppstoreOutlined />,
            label: tSidebar("productVariation.title"),
            children: [
              {
                key: "partner-product-variation-prices",
                icon: <DollarCircleOutlined />,
                label: (
                  <Link href="/dashboard/product-variation/partner-prices">
                    {tSidebar("productVariation.partnerPrices")}
                  </Link>
                ),
              },
              {
                key: "partner-to-customer-product-variation-prices",
                icon: <DollarCircleOutlined />,
                label: (
                  <Link href="/dashboard/product-variation/partner-to-customer-prices">
                    {tSidebar("productVariation.partnerToCustomerPrices")}
                  </Link>
                ),
              },
            ],
          },
          {
            key: "customer",
            icon: <ApartmentOutlined />,
            label: tSidebar("customer.title"),
            children: [
              {
                key: "customer-list",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/customer">
                    {tSidebar("customer.customers")}
                  </Link>
                ),
              },
              {
                key: "customer-admins",
                icon: <TeamOutlined />,
                label: (
                  <Link href="/dashboard/customer/admins">
                    {tSidebar("customer.admins")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isSystemAdmin
      ? [
          {
            key: "company",
            icon: <ApartmentOutlined />,
            label: tSidebar("company.title"),
            children: [
              {
                key: "company-list",
                icon: <ApartmentOutlined />,
                label: (
                  <Link href="/dashboard/company">
                    {tSidebar("company.companies")}
                  </Link>
                ),
              },
              {
                key: "company-admins",
                icon: <TeamOutlined />,
                label: (
                  <Link href="/dashboard/company/admins">
                    {tSidebar("company.admins")}
                  </Link>
                ),
              },
              {
                key: "company-permissions",
                icon: <SettingOutlined />,
                label: (
                  <Link href="/dashboard/company/permissions">
                    {tSidebar("company.permissions")}
                  </Link>
                ),
              },
            ],
          },
        ]
      : []),
    ...(isSystemAdmin
      ? [
          {
            key: "settings",
            icon: <SettingOutlined />,
            label: (
              <Link href="/dashboard/settings">{tSidebar("settings")}</Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      collapsedWidth={64}
      breakpoint="lg"
      style={{
        // background: token.colorBgContainer,
        borderRight: `0px solid ${token.colorSplit}`,
        position: "sticky",
        top: 0,
        height: "100vh",
        background: token.Layout?.headerBg || "#04314b",
      }}
    >
      <div
        style={{
          height: token.Layout?.headerHeight || 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${token.colorSplit}`,
          fontWeight: 600,
        }}
      >
        {collapsed ? (
          <Image src="/logo.png" alt="Logo small" width={32} height={32} />
        ) : (
          <Image
            src="/white_text_logo.png"
            alt="Logo"
            height={35}
            width={150}
          />
        )}
      </div>

      <Menu
        mode="inline"
        items={items}
        style={{
          height: `calc(100% - ${token.Layout?.headerHeight || 56}px)`,
          overflow: "auto",
          padding: 8,
        }}
      />
    </Sider>
  );
}
