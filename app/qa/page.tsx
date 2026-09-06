import type { Metadata } from "next";
import { QaClient } from "./QaClient";

const siteOrigin = process.env.MSV_SITE_ORIGIN ?? "https://minisv.vip";
const canonicalUrl = process.env.MSV_QA_CANONICAL_URL ?? `${siteOrigin}/parents/`;
const socialImageUrl = `${siteOrigin}/og.png`;
const description = "基于 Mini Silicon Valley 课程资料的家长问答：了解适龄、课程流程、学习成果、AI 使用与隐私安全。";

export const metadata: Metadata = {
  title: "家长问答",
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "Mini Silicon Valley 家长问答",
    description,
    type: "website",
    url: canonicalUrl,
    locale: "zh_CN",
    images: [{
      url: socialImageUrl,
      width: 2048,
      height: 1150,
      alt: "Mini Silicon Valley 课程游戏系统",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mini Silicon Valley 家长问答",
    description,
    images: [socialImageUrl],
  },
};

export default function ParentQaPage() {
  return <QaClient />;
}
