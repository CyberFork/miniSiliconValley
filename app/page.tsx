import type { Metadata } from "next";
import { WorldApp } from "./components/WorldApp";

export const metadata: Metadata = {
  title: "Mini Silicon Valley | 真实科技史创业 RPG",
  description: "滑动 1891—2026 时间轴，让硅谷地图随历史建设；进入 8 场真实史料驱动的创业角色推演。",
};

export default function Home() {
  return <WorldApp />;
}
