"use client";

import { Layout, theme } from "antd";
import HeaderBar from "@/components/layout/HeaderBar";
import Sidebar from "@/components/layout/Sidebar";
import PageContainer from "@/components/layout/PageContainer";
import ScrollToTopButton from "@/components/layout/ScrollToTopButton";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const { Content } = Layout;

export default function DashboardLayout({ children }) {
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const pathname = usePathname();
  const { token } = theme.useToken();
  const contentRef = useRef(null);

  return (
    <Layout hasSider style={{ height: "100vh" }}>
      <Sidebar collapsed={collapsed} />
      <Layout
        style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <HeaderBar pathname={pathname} />
        <Content
          ref={contentRef}
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
        <ScrollToTopButton targetRef={contentRef} />
      </Layout>
    </Layout>
  );
}
