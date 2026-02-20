"use client";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/authSlice";
import uiReducer from "./features/uiSlice";
import balanceReducer from "./features/balanceSlice";
import categoriesReducer from "./features/categoriesSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    balance: balanceReducer,
    categories: categoriesReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});
