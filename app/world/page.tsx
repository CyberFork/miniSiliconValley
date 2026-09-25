import type { Metadata } from "next";

import { WorldApp } from "../components/WorldApp";

const siteOrigin = process.env.MSV_SITE_ORIGIN ?? "https://minisv.vip";
const canonicalUrl = process.env.MSV_CANONICAL_URL ?? `${siteOrigin}/world/`;

export const metadata: Metadata = {
  title: { absolute: "MINI硅谷历史世界｜真实科技史创业 RPG" },
  description: "滑动 1891—2026 时间轴，让硅谷地图随历史建设；进入真实史料驱动的创业角色推演。",
  alternates: { canonical: canonicalUrl },
};

export default function WorldPage() {
  return <WorldApp />;
}
