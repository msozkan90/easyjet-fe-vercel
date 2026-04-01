"use client";
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null, // { id, name, roles: ['admin','staff',...]}
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  isAuthenticated: false, // http-only cookie var/yok kontrolü + me endpoint sonucu
};

const normalizeUser = (raw) => {
  if (!raw) return raw;
  const roleName = raw?.role?.name || ""; // örn: "SystemAdmin"
  // rol isimlerini uniform hale getirelim:
  const roleKey = roleName.trim().toLowerCase(); // "systemadmin" → "systemadmin"
  // İzin setini back-end ileride ekleyene kadar role->perm map ile doldur
  const PERM_MAP = {
    systemadmin: [
      "orders.read",
      "orders.write",
      "settings.read",
      "settings.write",
      "users.read",
      "users.write",
    ],
    admin: ["orders.read", "orders.write", "settings.read", "users.read"],
    manager: ["orders.read", "orders.write"],
    staff: ["orders.read"],
  };
  return {
    ...raw,
    // UI rahat kullansın diye:
    displayName: `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim(),
    roles: [roleKey], // ["systemadmin"]
    permissions: PERM_MAP[roleKey] || [],
  };
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthLoading: (s) => {
      s.status = "loading";
      s.error = null;
    },
    setUser: (s, { payload }) => {
      s.user = normalizeUser(payload?.data) || null;
      s.isAuthenticated = !!payload;
      s.status = "succeeded";
      s.error = null;
    },
    setAuthError: (s, { payload }) => {
      s.status = "failed";
      s.error = payload || "Auth error";
      s.isAuthenticated = false;
      s.user = null;
    },
    logoutLocal: (s) => {
      s.user = null;
      s.isAuthenticated = false;
      s.status = "idle";
      s.error = null;
    },
  },
});

export const { setAuthLoading, setUser, setAuthError, logoutLocal } =
  authSlice.actions;
export default authSlice.reducer;
