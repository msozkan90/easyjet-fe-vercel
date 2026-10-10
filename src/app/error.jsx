"use client";
import { useEffect } from "react";
import { reportError } from "@/utils/telemetry.mjs";

export default function ErrorPage({ error, reset }) {
  useEffect(() => { reportError("react"); }, [error]);
  return (
    <div role="alert" style={{ padding: 32 }}>
      <p>Beklenmeyen bir hata oluştu.</p>
      <button onClick={reset}>Tekrar dene</button>
    </div>
  );
}
