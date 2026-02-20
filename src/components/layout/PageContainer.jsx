"use client";

import { theme } from "antd";

export default function PageContainer({ children }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
        minHeight: 360,
        padding: 16,
        border: `1px solid ${token.colorSplit}`,
        transition: "box-shadow .2s ease, transform .2s ease",
      }}
    >
      {children}
    </div>
  );
}
