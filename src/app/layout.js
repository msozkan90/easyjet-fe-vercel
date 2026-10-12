// src/app/layout.js
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { Providers } from "./providers";

const geistSans = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: "Easyjet Connect",
  description: "Sipariş takip sistemi",
};

export default async function RootLayout({ children }) {
  const locale = getLocale();
  const dictionary = await getDictionary(locale);

  return (
    <html
      lang={locale}
      data-theme="light"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning>
        <AntdRegistry>
          <I18nProvider locale={locale} dictionary={dictionary}>
            <Providers>{children}</Providers>
          </I18nProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
