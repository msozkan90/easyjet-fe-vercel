"use client";

import {
  App as AntdApp,
  Avatar,
  Layout,
  Button,
  Dropdown,
  Space,
  Input,
  Modal,
  List,
  Tag,
} from "antd";
import {
  DownOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  SearchOutlined,
  MoonOutlined,
  SunOutlined,
  ArrowRightOutlined,
  LoadingOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { toggleMobileNav, toggleSidebar } from "@/redux/features/uiSlice";
import { AuthAPI, OrderSearchAPI, WalletAPI } from "@/utils/api";
import { logoutLocal } from "@/redux/features/authSlice";
import { setBalance } from "@/redux/features/balanceSlice";
import { resetCategories } from "@/redux/features/categoriesSlice";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLanguageMenuItem } from "@/components/common/LanguageSwitcher";
import { useTranslations } from "@/i18n/use-translations";
import { hasAnyRole, isEntityAdmin } from "@/utils/rbac";
import { useThemeMode } from "@/theme/ThemeModeProvider";
import { THEME_MODES } from "@/theme/tokens";

const { Header } = Layout;

export default function HeaderBar({ isMobile = false }) {
  const { message } = AntdApp.useApp();
  const { mode: themeMode, toggleMode } = useThemeMode();
  const isDarkMode = themeMode === THEME_MODES.DARK;
  const tNavbar = useTranslations("common.navbar");
  const dispatch = useDispatch();
  const router = useRouter();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const user = useSelector((s) => s.auth.user);
  const balance = useSelector((s) => s.balance.value);
  // Wallet balance belongs to the entity; only its admins may see it.
  const canSeeBalance = isEntityAdmin(user);
  const languageMenuItem = useLanguageMenuItem();
  const [orderSearch, setOrderSearch] = useState("");
  const [orderSearchLoading, setOrderSearchLoading] = useState(false);
  const [orderSearchMatches, setOrderSearchMatches] = useState([]);
  const [orderSearchModalOpen, setOrderSearchModalOpen] = useState(false);
  const searchInputRef = useRef(null);
  // Platform-specific hint is resolved after mount to keep SSR markup stable.
  const [searchShortcut, setSearchShortcut] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) {
      setSearchShortcut("⌘K");
    }
  }, []);

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
    // Settings is only available to entity admins (see settings/page.js).
    ...(hasAnyRole(user, ["companyAdmin", "partnerAdmin", "customerAdmin"])
      ? [
          {
            key: "settings",
            icon: <SettingOutlined />,
            label: (
              <Link href="/dashboard/settings">{tNavbar("settings")}</Link>
            ),
          },
        ]
      : []),
    languageMenuItem,
    {
      key: "theme",
      icon: isDarkMode ? <SunOutlined /> : <MoonOutlined />,
      label: isDarkMode ? tNavbar("lightMode") : tNavbar("darkMode"),
      onClick: toggleMode,
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
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "b") {
        event.preventDefault();
        dispatch(isMobile ? toggleMobileNav() : toggleSidebar());
        return;
      }
      // Ctrl/⌘+K anywhere, or "/" outside text fields, jumps to order search.
      const target = event.target;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (
        ((event.ctrlKey || event.metaKey) && key === "k") ||
        (key === "/" && !typing && !event.ctrlKey && !event.metaKey)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus({ cursor: "all" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, isMobile]);

  const userDisplayName = user?.displayName || tNavbar("unknownUser");
  const userInitials =
    [user?.first_name, user?.last_name]
      .filter(Boolean)
      .map((part) => String(part).trim().charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || userDisplayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!user?.id || !canSeeBalance) return;
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
  }, [dispatch, user?.id, canSeeBalance]);

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
      className="ej-topbar"
      style={{
        background: "var(--ej-surface)",
        height: 64,
        lineHeight: "normal",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 8 : 14,
        padding: isMobile ? "0 12px" : "0 24px",
      }}
    >
      <Button
        type="text"
        icon={
          isMobile ? (
            <MenuOutlined />
          ) : collapsed ? (
            <MenuUnfoldOutlined />
          ) : (
            <MenuFoldOutlined />
          )
        }
        onClick={() => dispatch(isMobile ? toggleMobileNav() : toggleSidebar())}
        aria-label={
          isMobile ? tNavbar("openNavigation") : tNavbar("toggleSidebar")
        }
        title={isMobile ? tNavbar("openNavigation") : tNavbar("toggleSidebar")}
      />

      <div className="min-w-0 flex-1" style={{ maxWidth: 480 }}>
        <Input
          ref={searchInputRef}
          className="ej-command-search"
          value={orderSearch}
          onChange={(event) => setOrderSearch(event.target.value)}
          onPressEnter={() => handleOrderSearch(orderSearch)}
          readOnly={orderSearchLoading}
          prefix={<SearchOutlined className="ej-command-search__icon" />}
          suffix={
            orderSearchLoading ? (
              <LoadingOutlined className="text-brand-600" />
            ) : orderSearch.trim() ? (
              <Button
                type="text"
                size="small"
                className="ej-command-search__go"
                icon={<ArrowRightOutlined />}
                onClick={() => handleOrderSearch(orderSearch)}
                aria-label={tNavbar("search")}
                title={tNavbar("search")}
              />
            ) : !isMobile ? (
              <kbd className="ej-kbd" aria-hidden="true">
                {searchShortcut}
              </kbd>
            ) : null
          }
          placeholder={tNavbar("orderSearchPlaceholder")}
          aria-label={tNavbar("orderSearchAria")}
          aria-keyshortcuts="Control+K Meta+K /"
        />
      </div>

      <div
        className="flex shrink-0 items-center gap-2"
        style={{ marginInlineStart: "auto" }}
      >
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
                        <Tag
                          color={
                            item?.type === "transfer_order" ? "blue" : "green"
                          }
                        >
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
        {canSeeBalance ? (
          <Link
            href="/dashboard/wallet-transactions"
            className="ej-balance-ticket hidden items-center gap-2 text-sm no-underline sm:flex"
            aria-label={`${tNavbar("walletTransactions")}: ${formattedBalance}`}
            title={tNavbar("walletTransactions")}
          >
            <WalletOutlined className="ej-balance-ticket__icon" />
            {!isMobile ? (
              <span className="ej-balance-ticket__label">
                {tNavbar("balance")}
              </span>
            ) : null}
            <span className="ej-mono font-semibold">{formattedBalance}</span>
          </Link>
        ) : null}
        {!isMobile ? (
          <span className="ej-topbar__divider" aria-hidden="true" />
        ) : null}
        <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
          <Button
            type="text"
            aria-label={`${tNavbar("userMenu")}: ${userDisplayName}`}
            style={{
              height: 40,
              paddingInline: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Avatar
              className="ej-avatar ej-hex"
              size={34}
              src={user?.avatar_url || undefined}
              icon={!userInitials ? <UserOutlined /> : undefined}
              style={{
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {!user?.avatar_url ? userInitials : null}
            </Avatar>
            {!isMobile ? (
              <>
                <span className="max-w-[160px] truncate text-sm font-medium">
                  {userDisplayName}
                </span>
                <DownOutlined className="text-xs text-ink-400" />
              </>
            ) : null}
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
}
