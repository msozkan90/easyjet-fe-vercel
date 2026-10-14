"use client";

import { Drawer, Grid, Layout } from "antd";
import HeaderBar from "@/components/layout/HeaderBar";
import Sidebar, { SIDEBAR_WIDTH } from "@/components/layout/Sidebar";
import PageContainer from "@/components/layout/PageContainer";
import RouteHeader from "@/components/layout/RouteHeader";
import ScrollToTopButton from "@/components/layout/ScrollToTopButton";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { setMobileNavOpen } from "@/redux/features/uiSlice";
import { palette } from "@/theme/tokens";

const { Content } = Layout;

export default function DashboardLayout({ children }) {
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const mobileNavOpen = useSelector((s) => s.ui.mobileNavOpen);
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  // Breakpoints are unknown until mount; treat that as desktop to avoid a flash.
  const isMobile = screens.lg === false;
  const contentRef = useRef(null);

  useEffect(() => {
    dispatch(setMobileNavOpen(false));
  }, [dispatch, pathname]);

  const closeMobileNav = () => dispatch(setMobileNavOpen(false));

  return (
    <Layout hasSider={!isMobile} style={{ height: "100vh" }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={closeMobileNav}
          width={SIDEBAR_WIDTH + 16}
          closable={false}
          forceRender
          styles={{
            body: { padding: 0, background: palette.ink900 },
            content: { background: palette.ink900 },
          }}
        >
          <Suspense fallback={null}>
            <Sidebar variant="drawer" onNavigate={closeMobileNav} />
          </Suspense>
        </Drawer>
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                background: palette.ink900,
              }}
            />
          }
        >
          <Sidebar collapsed={collapsed} />
        </Suspense>
      )}
      <Layout
        style={{ minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <HeaderBar isMobile={isMobile} />
        <Content
          ref={contentRef}
          style={{
            minHeight: 0,
            flex: 1,
            overflow: "auto",
            padding: isMobile ? 12 : 24,
            background: "var(--ej-canvas)",
          }}
        >
          <PageContainer>
            <RouteHeader />
            {children}
          </PageContainer>
        </Content>
        <ScrollToTopButton targetRef={contentRef} />
      </Layout>
    </Layout>
  );
}
