// src/app/(auth)/verify-success/page.js
"use client";

import { useEffect } from "react";
import { Result, Button, Card } from "antd";
import { CheckCircleTwoTone } from "@ant-design/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";

export default function VerifySuccess() {
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
    const t = setTimeout(() => router.push("/auth/login"), 15000);
    return () => clearTimeout(t);
  }, [user, router]);

  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-sm">
        <Result
          status="success"
          icon={<CheckCircleTwoTone twoToneColor="#52c41a" />}
          title="E-posta doğrulandı!"
          subTitle={
            <div className="text-gray-600">
              {email ? (
                <div>
                  <b>{email}</b> adresi doğrulandı. Hesabınız aktif; şimdi giriş
                  yapabilirsiniz.
                </div>
              ) : (
                "Hesabınız aktif; şimdi giriş yapabilirsiniz."
              )}
            </div>
          }
          extra={[
            <Link key="login" href="/auth/login">
              <Button type="primary">Girişe Git</Button>
            </Link>,
            <Link key="home" href="/">
              <Button>Ana Sayfa</Button>
            </Link>,
          ]}
        />
      </Card>
    </div>
  );
}
