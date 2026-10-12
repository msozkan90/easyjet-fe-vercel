"use client";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
  // Title/breadcrumb of the current route, resolved from the sidebar.
  activeNav: { title: "", trail: [], exact: false },
  // Number of mounted pages that render their own PageHeader.
  customHeaderCount: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar: (s) => {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    },
    setSidebarCollapsed: (s, a) => {
      s.sidebarCollapsed = !!a.payload;
    },
    toggleMobileNav: (s) => {
      s.mobileNavOpen = !s.mobileNavOpen;
    },
    setMobileNavOpen: (s, a) => {
      s.mobileNavOpen = !!a.payload;
    },
    setActiveNav: (s, a) => {
      s.activeNav = {
        title: a.payload?.title || "",
        trail: Array.isArray(a.payload?.trail) ? a.payload.trail : [],
        exact: !!a.payload?.exact,
      };
    },
    registerCustomHeader: (s) => {
      s.customHeaderCount += 1;
    },
    unregisterCustomHeader: (s) => {
      s.customHeaderCount = Math.max(0, s.customHeaderCount - 1);
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobileNav,
  setMobileNavOpen,
  setActiveNav,
  registerCustomHeader,
  unregisterCustomHeader,
} = uiSlice.actions;
export default uiSlice.reducer;
