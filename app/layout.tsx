import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mini-silicon-valley-rpg.cyberforker.chatgpt.site"),
  title: {
    default: "Mini Silicon Valley | 真实科技史创业 RPG",
    template: "%s | Mini Silicon Valley",
  },
  description: "基于可核验科技史的、有限开放世界青少年创业学习 RPG。",
  applicationName: "Mini Silicon Valley",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Mini Silicon Valley",
    description: "开放世界是地图，RPG 是身份，历史情境是关卡，真实创业是主线。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/assets/silicon-valley-base-map.webp", width: 1536, height: 1024, alt: "Mini Silicon Valley 像素风正交投影地图" }],
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
