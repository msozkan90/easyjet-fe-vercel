"use client";
import { useEffect } from "react";
import { Button } from "antd";
import { reportError } from "@/utils/telemetry.mjs";
import StatusScreen from "@/components/ui/StatusScreen";
import { useTranslations } from "@/i18n/use-translations";

export default function ErrorPage({ error, reset }) {
  const t = useTranslations("common.errorPage");
  useEffect(() => { reportError("react"); }, [error]);
  return (
    <StatusScreen
      tone="warning"
      title={t("title")}
      description={t("body")}
      actions={
        <>
          <Button type="primary" onClick={reset}>
            {t("retry")}
          </Button>
          <Button href="/dashboard">{t("home")}</Button>
        </>
      }
    />
  );
}
