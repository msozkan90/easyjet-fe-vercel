"use client";

import {
  App as AntdApp,
  Layout,
  Button,
  Dropdown,
  theme,
  Space,
  Input,
  Modal,
  List,
  Tag,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  DollarCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { toggleSidebar } from "@/redux/features/uiSlice";
import { AuthAPI, OrderSearchAPI, WalletAPI } from "@/utils/api";
import { logoutLocal } from "@/redux/features/authSlice";
import { setBalance } from "@/redux/features/balanceSlice";
import { resetCategories } from "@/redux/features/categoriesSlice";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { useTranslations } from "@/i18n/use-translations";

const { Header } = Layout;

export default function HeaderBar({ pathname }) {
  const { message } = AntdApp.useApp();
  const tNavbar = useTranslations("common.navbar");
  const dispatch = useDispatch();
  const router = useRouter();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const user = useSelector((s) => s.auth.user);
  const balance = useSelector((s) => s.balance.value);
  const { token } = theme.useToken();
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchLoading, setOrderSearchLoading] = useState(false);
  const [orderSearchMatches, setOrderSearchMatches] = useState([]);
  const [orderSearchModalOpen, setOrderSearchModalOpen] = useState(false);

  const formattedBalance = useMemo(() => {
    const numericBalance = Number(balance);
    const numberVal = Number.isFinite(numericBalance) ? numericBalance : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(numberVal);
  }, [balance]);

  const onLogout = async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // logout isteği başarısız olsa bile client tarafını sıfırla
    }
    dispatch(logoutLocal());
    dispatch(resetCategories());
    router.replace("/auth/login");
  };

  const menuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link href="/dashboard/profile">{tNavbar("profile")}</Link>,
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: <Link href="/dashboard/settings">{tNavbar("settings")}</Link>,
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: tNavbar("logout"),
      onClick: onLogout,
    },
  ];

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        dispatch(toggleSidebar());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchBalance = async () => {
      try {
        const resp = await WalletAPI.getBalance();
        const candidate = resp?.data?.balance ?? resp?.balance;
        const numeric = Number(candidate);
        if (!cancelled && Number.isFinite(numeric)) {
          dispatch(setBalance(numeric));
        }
      } catch {
        // Balance fetch failure should not block header rendering
      }
    };

    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [dispatch, user?.id]);

  const getOrderSearchRoute = (match) => {
    const orderNumber = encodeURIComponent(match?.order_number || "");
    if (!orderNumber) return null;
    if (match?.type === "transfer_order") {
      return `/dashboard/transfer-orders/orders/${orderNumber}`;
    }
    if (match?.type === "order") {
      return `/dashboard/order/detail/${orderNumber}`;
    }
    return null;
  };

  const handleOrderSearchMatchSelect = (match) => {
    const route = getOrderSearchRoute(match);
    if (!route) return;
    setOrderSearchModalOpen(false);
    setOrderSearchMatches([]);
    setOrderSearch("");
    router.push(route);
  };

  const handleOrderSearch = async (value) => {
    const trimmedValue = String(value || "").trim();
    if (!trimmedValue) return;
    setOrderSearchLoading(true);
    try {
      const response = await OrderSearchAPI.resolve(trimmedValue);
      const matches = Array.isArray(response?.data) ? response.data : [];
      if (!matches.length) {
        message.warning(tNavbar("orderSearchNotFound"));
        return;
      }
      if (matches.length === 1) {
        handleOrderSearchMatchSelect(matches[0]);
        return;
      }
      setOrderSearchMatches(matches);
      setOrderSearchModalOpen(true);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || tNavbar("orderSearchError"),
      );
    } finally {
      setOrderSearchLoading(false);
    }
  };

  return (
    <Header
      style={{
        background: token.Layout?.headerBg || "#04314b",
        height: token.Layout?.headerHeight || 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => dispatch(toggleSidebar())}
          shape="circle"
        />
        {/* <Typography.Text type="secondary" style={{ color: "#ffffffb3" }}>
          {pathname}
        </Typography.Text> */}
      </div>

      <Space size={8} align="center">
        <Space.Compact className="mt-2.5">
          <Input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            onPressEnter={() => handleOrderSearch(orderSearch)}
            allowClear
            disabled={orderSearchLoading}
            placeholder={tNavbar("orderSearchPlaceholder")}
            aria-label={tNavbar("orderSearchAria")}
          />
          <Button
            icon={<SearchOutlined />}
            loading={orderSearchLoading}
            onClick={() => handleOrderSearch(orderSearch)}
            aria-label={tNavbar("orderSearchAria")}
          />
        </Space.Compact>
        <Modal
          title={tNavbar("orderSearchMultipleTitle")}
          open={orderSearchModalOpen}
          footer={null}
          onCancel={() => setOrderSearchModalOpen(false)}
          destroyOnHidden
        >
          <List
            dataSource={orderSearchMatches}
            locale={{ emptyText: tNavbar("orderSearchNotFound") }}
            renderItem={(item) => {
              const typeLabel =
                item?.type === "transfer_order"
                  ? tNavbar("orderTypes.transferOrder")
                  : tNavbar("orderTypes.order");
              return (
                <List.Item
                  actions={[
                    <Button
                      key="open"
                      type="primary"
                      onClick={() => handleOrderSearchMatchSelect(item)}
                    >
                      {tNavbar("openOrder")}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item?.order_number || "-"}</span>
                        <Tag color={item?.type === "transfer_order" ? "blue" : "green"}>
                          {typeLabel}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space wrap>
                        <span>
                          {tNavbar("customer")}: {item?.customer_name || "-"}
                        </span>
                        {item?.status ? <Tag>{item.status}</Tag> : null}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Modal>
        <LanguageSwitcher size="small" />
        <Link
          href="/dashboard/wallet-transactions"
          className="hidden items-center justify-center rounded-3xl px-2 py-1 bg-white sm:flex"
          aria-label={tNavbar("walletTransactions")}
          title={tNavbar("walletTransactions")}
        >
          <DollarCircleOutlined className="text-lg mr-2" />
          <div className="flex flex-col leading-tight">
            <span className="text-base ">{formattedBalance}</span>
          </div>
        </Link>
        <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
          <Button shape="round" icon={<UserOutlined className="text-md" />}>
            <span className="text-base">
              {user?.displayName || tNavbar("unknownUser")}
            </span>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
}
