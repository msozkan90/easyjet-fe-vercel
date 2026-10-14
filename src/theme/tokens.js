// Design tokens for the EasyJet panel.
// Single source of truth for colors, type, radii and the Ant Design theme.
// CSS variables with the same values live in src/app/globals.css (:root),
// so Tailwind classes and antd components stay in sync.

export const palette = {
  ink950: "#0A1A24",
  ink900: "#0F2433",
  ink800: "#1A3446",
  ink700: "#2E4A5D",
  ink500: "#4E6373",
  ink400: "#6F8494",
  ink300: "#8696A2",
  ink200: "#B9C6CF",
  ink100: "#D5DEE4",

  orange800: "#7E3606",
  orange700: "#A3470A",
  orange600: "#C4560B",
  orange500: "#F57A1F",
  orange200: "#FFC9A0",
  orange100: "#FFE4CF",
  orange50: "#FFF4EB",

  canvas: "#F3F5F6",
  surface: "#FFFFFF",
  subtle: "#F7F9FA",
  muted: "#EEF1F3",
  border: "#E3E8EC",
  borderStrong: "#C9D2D9",

  success: "#1E7A4C",
  successBg: "#E8F5EE",
  warning: "#8A5300",
  warningSolid: "#B98900",
  warningBg: "#FFF4DB",
  danger: "#B42318",
  dangerBg: "#FDECEA",
  info: "#1F5F99",
  infoBg: "#E8F1FA",
};

export const fontStack = {
  sans: "var(--font-geist-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
};

const p = palette;

const baseToken = {
  fontFamily: fontStack.sans,
  fontFamilyCode: fontStack.mono,
  fontSize: 14,

  colorPrimary: p.orange600,
  colorPrimaryHover: p.orange700,
  colorPrimaryActive: p.orange800,
  colorPrimaryBg: p.orange50,
  colorPrimaryBgHover: p.orange100,
  colorPrimaryBorder: p.orange200,
  colorPrimaryBorderHover: p.orange500,
  colorPrimaryText: p.orange700,
  colorPrimaryTextHover: p.orange800,
  colorLink: p.orange700,
  colorLinkHover: p.orange800,
  colorLinkActive: p.orange800,

  colorInfo: p.info,
  colorSuccess: p.success,
  colorWarning: p.warningSolid,
  colorError: p.danger,

  colorTextBase: p.ink900,
  colorText: p.ink900,
  colorTextSecondary: p.ink500,
  colorTextTertiary: p.ink400,
  colorTextQuaternary: p.ink300,
  colorTextHeading: p.ink900,

  colorBgLayout: p.canvas,
  colorBgContainer: p.surface,
  colorBorder: p.borderStrong,
  colorBorderSecondary: p.border,
  colorSplit: p.muted,
  colorFillAlter: p.subtle,

  borderRadius: 6,
  borderRadiusSM: 4,
  borderRadiusLG: 12,
  controlHeight: 36,
  controlHeightSM: 30,
  controlHeightLG: 44,

  boxShadow: "0 16px 40px rgba(15, 36, 51, 0.18)",
  boxShadowSecondary: "0 12px 32px rgba(15, 36, 51, 0.16)",
  boxShadowTertiary: "0 1px 2px rgba(15, 36, 51, 0.06)",
};

const baseComponents = {
  Layout: {
    headerBg: p.surface,
    headerHeight: 60,
    headerPadding: "0 24px",
    siderBg: p.ink900,
    bodyBg: p.canvas,
  },
  Menu: {
    darkItemBg: p.ink900,
    darkSubMenuItemBg: p.ink950,
    darkPopupBg: p.ink900,
    darkItemColor: p.ink200,
    darkItemHoverColor: "#FFFFFF",
    darkItemHoverBg: p.ink800,
    darkItemSelectedBg: p.ink800,
    darkItemSelectedColor: "#FFFFFF",
    darkGroupTitleColor: p.ink400,
    itemHeight: 38,
    itemBorderRadius: 6,
    itemMarginInline: 8,
    iconSize: 16,
    collapsedIconSize: 18,
  },
  Button: {
    fontWeight: 500,
    primaryShadow: "none",
    defaultShadow: "none",
    dangerShadow: "none",
  },
  Card: {
    headerFontSize: 15,
    headerHeight: 52,
  },
  Table: {
    headerBg: p.subtle,
    headerColor: p.ink500,
    headerSplitColor: "transparent",
    headerSortActiveBg: p.muted,
    rowHoverBg: p.subtle,
    rowSelectedBg: p.orange50,
    rowSelectedHoverBg: p.orange100,
    borderColor: p.muted,
    footerBg: p.subtle,
  },
  Modal: {
    titleFontSize: 18,
  },
  Tabs: {
    inkBarColor: p.orange600,
    itemColor: p.ink500,
    itemSelectedColor: p.ink900,
    itemHoverColor: p.ink900,
    itemActiveColor: p.ink900,
  },
  Tag: {
    defaultBg: p.muted,
    defaultColor: p.ink700,
  },
  Tooltip: {
    colorBgSpotlight: p.ink900,
  },
  Statistic: {
    contentFontSize: 26,
  },
};

// Dark surfaces; mirrored by the [data-theme="dark"] block in globals.css.
export const darkPalette = {
  canvas: "#0A1A24",
  surface: "#102231",
  subtle: "#15293A",
  muted: "#1A3446",
  border: "#22394B",
  borderStrong: "#2E4A5D",
  text: "#E6ECF0",
  textSecondary: "#A9B8C3",
  textTertiary: "#7F93A2",
  link: "#F7934A",
  linkHover: "#FFB27A",
};

const dp = darkPalette;

const darkToken = {
  colorTextBase: dp.text,
  colorText: dp.text,
  colorTextSecondary: dp.textSecondary,
  colorTextTertiary: dp.textTertiary,
  colorTextQuaternary: p.ink400,
  colorTextHeading: "#FFFFFF",
  colorBgLayout: dp.canvas,
  colorBgContainer: dp.surface,
  colorBgElevated: dp.subtle,
  colorBorder: dp.borderStrong,
  colorBorderSecondary: dp.border,
  colorSplit: dp.border,
  colorFillAlter: dp.subtle,
  colorLink: dp.link,
  colorLinkHover: dp.linkHover,
  colorLinkActive: dp.linkHover,
  colorPrimaryText: dp.link,
  colorPrimaryTextHover: dp.linkHover,
  colorPrimaryBg: "rgba(245, 122, 31, 0.14)",
  colorPrimaryBgHover: "rgba(245, 122, 31, 0.22)",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
  boxShadowSecondary: "0 12px 32px rgba(0, 0, 0, 0.4)",
};

const darkComponents = {
  Layout: { headerBg: dp.surface, bodyBg: dp.canvas },
  Table: {
    headerBg: dp.subtle,
    headerColor: dp.textSecondary,
    headerSortActiveBg: dp.muted,
    rowHoverBg: dp.subtle,
    rowSelectedBg: "rgba(245, 122, 31, 0.12)",
    rowSelectedHoverBg: "rgba(245, 122, 31, 0.18)",
    borderColor: dp.border,
    footerBg: dp.subtle,
  },
  Tabs: {
    itemColor: dp.textSecondary,
    itemSelectedColor: "#FFFFFF",
    itemHoverColor: "#FFFFFF",
    itemActiveColor: "#FFFFFF",
  },
  Tag: { defaultBg: dp.muted, defaultColor: dp.text },
};

export const THEME_MODES = Object.freeze({ LIGHT: "light", DARK: "dark" });

const mergeComponents = (base, overrides) =>
  Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([name]) => [
      name,
      { ...(base[name] || {}), ...(overrides[name] || {}) },
    ]),
  );

export function getAntdTheme(algorithms, mode = THEME_MODES.LIGHT) {
  const isDark = mode === THEME_MODES.DARK;
  return {
    algorithm: isDark ? algorithms.darkAlgorithm : algorithms.defaultAlgorithm,
    token: isDark ? { ...baseToken, ...darkToken } : baseToken,
    components: isDark
      ? mergeComponents(baseComponents, darkComponents)
      : baseComponents,
  };
}
