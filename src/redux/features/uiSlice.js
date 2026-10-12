"use client";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
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
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  toggleMobileNav,
  setMobileNavOpen,
} = uiSlice.actions;
export default uiSlice.reducer;
