"use client";

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  listWithSubCategories: null,
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const normalizePayload = (payload) => payload?.data ?? payload ?? null;

const categoriesSlice = createSlice({
  name: "categories",
  initialState,
  reducers: {
    setCategoriesLoading: (s) => {
      s.status = "loading";
      s.error = null;
    },
    setListWithSubCategories: (s, { payload }) => {
    console.log("setListWithSubCategories",payload);
      s.listWithSubCategories = normalizePayload(payload);
      s.status = "succeeded";
      s.error = null;
    },
    setCategoriesError: (s, { payload }) => {
      s.status = "failed";
      s.error = payload || "Categories fetch error";
    },
    resetCategories: () => initialState,
  },
});

export const {
  setCategoriesLoading,
  setListWithSubCategories,
  setCategoriesError,
  resetCategories,
} = categoriesSlice.actions;
export default categoriesSlice.reducer;
