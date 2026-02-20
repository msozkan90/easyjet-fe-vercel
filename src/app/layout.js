// src/app/layout.js
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntdApp, ConfigProvider } from "antd";
import { Roboto_Flex } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { Providers } from "./providers";

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
});

export const metadata = {
  title: "OrderTrack",
  description: "Sipariş takip sistemi",
};

export default async function RootLayout({ children }) {
  const locale = getLocale();
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale} className={`${robotoFlex.variable}`}>
      <body suppressHydrationWarning>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              token: {
                fontFamily: "var(--font-roboto-flex)",
                colorPrimary: "#1677ff",
                colorBgLayout: "#f5f7fa",
                borderRadius: 10,
              },
              components: {
                Layout: {
                  headerBg: "#071E2B",
                  headerHeight: 56,
                },
              },
            }}
          >
            <AntdApp>
              <I18nProvider locale={locale} dictionary={dictionary}>
                <Providers>{children}</Providers>
              </I18nProvider>
            </AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
