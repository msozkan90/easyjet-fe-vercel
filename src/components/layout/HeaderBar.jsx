"use client";

import { Layout, Button, Typography, Dropdown, theme, Space, Input } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  DollarCircleOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { toggleSidebar } from "@/redux/features/uiSlice";
import { AuthAPI, WalletAPI } from "@/utils/api";
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
  const tNavbar = useTranslations("common.navbar");
  const dispatch = useDispatch();
  const router = useRouter();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const user = useSelector((s) => s.auth.user);
  const balance = useSelector((s) => s.balance.value);
  const { token } = theme.useToken();
  const [orderSearch, setOrderSearch] = useState("");

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

  const handleOrderSearch = (value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    router.push(`/dashboard/order/detail/${encodeURIComponent(trimmedValue)}`);
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
        <Input.Search
          value={orderSearch}
          onChange={(event) => setOrderSearch(event.target.value)}
          onSearch={handleOrderSearch}
          allowClear
          placeholder={tNavbar("orderSearchPlaceholder")}
          aria-label={tNavbar("orderSearchAria")}
          className="mt-2.5"
        />
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
