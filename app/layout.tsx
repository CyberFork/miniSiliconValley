import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { publicPath } from "./lib/public-path";
import "./globals.css";

const siteOrigin = process.env.MSV_SITE_ORIGIN ?? "https://minisv.vip";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "Mini Silicon Valley | 真实科技史创业 RPG",
    template: "%s | Mini Silicon Valley",
  },
  description: "基于可核验科技史的、有限开放世界青少年创业学习 RPG。",
  applicationName: "Mini Silicon Valley",
  icons: { icon: publicPath("/favicon.svg"), shortcut: publicPath("/favicon.svg") },
  manifest: publicPath("/site.webmanifest"),
  openGraph: {
    title: "Mini Silicon Valley",
    description: "开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: publicPath("/og.png"), width: 1200, height: 630, alt: "Mini Silicon Valley · 把科技史玩成一次创业" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mini Silicon Valley",
    description: "真实科技史驱动的有限开放世界创业学习 RPG。",
    images: [publicPath("/og.png")],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#142125",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
