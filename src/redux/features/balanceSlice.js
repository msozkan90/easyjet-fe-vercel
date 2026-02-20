"use client";

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  value: null,
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const balanceSlice = createSlice({
  name: "balance",
  initialState,
  reducers: {
    setBalanceLoading: (s) => {
      s.status = "loading";
      s.error = null;
    },
    setBalance: (s, { payload }) => {
      const parsed = Number(payload);
      s.value = Number.isFinite(parsed) ? parsed : 0;
      s.status = "succeeded";
      s.error = null;
    },
    setBalanceError: (s, { payload }) => {
      s.status = "failed";
      s.error = payload || "Balance fetch error";
    },
    resetBalance: () => initialState,
  },
});

export const { setBalance, setBalanceLoading, setBalanceError, resetBalance } =
  balanceSlice.actions;
export default balanceSlice.reducer;
