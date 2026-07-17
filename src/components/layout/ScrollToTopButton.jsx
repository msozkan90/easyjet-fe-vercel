"use client";

import { useCallback, useEffect, useState } from "react";
import { UpOutlined } from "@ant-design/icons";
import { FloatButton, Grid, theme } from "antd";
import { useTranslations } from "@/i18n/use-translations";

export default function ScrollToTopButton({ targetRef }) {
  const [visible, setVisible] = useState(false);
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const tActions = useTranslations("common.actions");

  const updateVisibility = useCallback(() => {
    const target = targetRef?.current;
    if (!target) {
      setVisible(false);
      return;
    }
    setVisible(target.scrollTop > target.clientHeight);
  }, [targetRef]);

  useEffect(() => {
    const target = targetRef?.current;
    if (!target) return undefined;

    updateVisibility();
    target.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      target.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [targetRef, updateVisibility]);

  const handleClick = () => {
    targetRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  const isMobile = screens.xs && !screens.sm;

  return (
    <FloatButton
      aria-label={tActions("backToTop")}
      icon={<UpOutlined />}
      tooltip={tActions("backToTop")}
      onClick={handleClick}
      style={{
        right: isMobile ? 12 : 24,
        bottom: isMobile ? 76 : 96,
        width: isMobile ? 44 : 48,
        height: isMobile ? 44 : 48,
        color: token.colorPrimary,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
        zIndex: 1190,
      }}
    />
  );
}
