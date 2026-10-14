"use client";

import { useEffect } from "react";
import { Button } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import StatusScreen from "@/components/ui/StatusScreen";
import { useTranslations } from "@/i18n/use-translations";

export default function VerifyFailed() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email"); // opsiyonel: ?email=
  const reason = searchParams.get("reason"); // opsiyonel: ?reason=expired|invalid

  useEffect(() => {
    const timer = setTimeout(() => router.push("/auth/login"), 15000);
    return () => clearTimeout(timer);
  }, [router]);

  const base = reason === "expired" ? "expiredBody" : "invalidBody";
  const description = email ? t(`${base}WithEmail`, { email }) : t(base);

  return (
    <StatusScreen
      tone="error"
      title={t("failedTitle")}
      description={description}
      note={t("redirectNote")}
      actions={
        <Button type="primary" href="/auth/login">
          {t("goToLogin")}
        </Button>
      }
    />
  );
}
