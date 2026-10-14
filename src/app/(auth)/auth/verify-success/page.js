// src/app/(auth)/verify-success/page.js
"use client";

import { useEffect } from "react";
import { Button } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import StatusScreen from "@/components/ui/StatusScreen";
import { useTranslations } from "@/i18n/use-translations";

export default function VerifySuccess() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email"); // backend isterse ?email=... geçebilir
  const user = useSelector((s) => s.auth.user);

  useEffect(() => {
    if (user) {
      // Zaten girişliyse panele al
      router.replace("/dashboard");
      return;
    }
    // Değilse bir süre sonra login'e gönder
    const timer = setTimeout(() => router.push("/auth/login"), 15000);
    return () => clearTimeout(timer);
  }, [user, router]);

  return (
    <StatusScreen
      tone="success"
      title={t("successTitle")}
      description={
        email ? t("successBodyWithEmail", { email }) : t("successBody")
      }
      note={t("redirectNote")}
      actions={
        <>
          <Button type="primary" href="/auth/login">
            {t("goToLogin")}
          </Button>
          <Button href="/">{t("home")}</Button>
        </>
      }
    />
  );
}
