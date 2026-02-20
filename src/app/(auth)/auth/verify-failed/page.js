"use client";

import { useEffect } from "react";
import { Result, Button, Card } from "antd";
import { CloseCircleTwoTone } from "@ant-design/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyFailed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email"); // opsiyonel: ?email=
  const reason = searchParams.get("reason"); // opsiyonel: ?reason=expired|invalid

  useEffect(() => {
    const t = setTimeout(() => router.push("/auth/login"), 15000);
    return () => clearTimeout(t);
  }, [router]);

  const subtitle = (() => {
    if (reason === "expired") {
      return (
        <>
          Doğrulama bağlantısının süresi dolmuş.
          {email ? (
            <>
              {" "}
              <b>{email}</b> için yeni bir doğrulama isteyin.
            </>
          ) : (
            " Lütfen yeni bir doğrulama isteyin."
          )}
        </>
      );
    }
    return (
      <>
        Doğrulama bağlantısı geçersiz veya daha önce kullanılmış olabilir.
        {email ? (
          <>
            {" "}
            <b>{email}</b> için yeni bir doğrulama isteyin.
          </>
        ) : (
          ""
        )}
      </>
    );
  })();

  return (
    <div className="w-full min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-sm">
        <Result
          status="error"
          icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />}
          title="Doğrulama başarısız"
          subTitle={<div className="text-gray-600">{subtitle}</div>}
          extra={[
            <Link key="login" href="/auth/login">
              <Button type="primary">Girişe Git</Button>
            </Link>,
          ]}
        />
      </Card>
    </div>
  );
}
