"use client";

import { Layout, theme } from "antd";
import HeaderBar from "@/components/layout/HeaderBar";
import Sidebar from "@/components/layout/Sidebar";
import PageContainer from "@/components/layout/PageContainer";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";

const { Content } = Layout;

export default function DashboardLayout({ children }) {
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const pathname = usePathname();
  const { token } = theme.useToken();

  return (
    <Layout style={{ height: "100vh" }}>
      <Sidebar collapsed={collapsed} />
      <Layout
        style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <HeaderBar pathname={pathname} />
        <Content
          style={{
            minHeight: 0,
            flex: 1,
            overflow: "auto",
            padding: 24,
            background: token.colorBgLayout,
          }}
        >
          <PageContainer>{children}</PageContainer>
        </Content>
      </Layout>
    </Layout>
  );
}
