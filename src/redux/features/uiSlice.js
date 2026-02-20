"use client";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sidebarCollapsed: false,
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
  },
});

export const { toggleSidebar, setSidebarCollapsed } = uiSlice.actions;
export default uiSlice.reducer;
