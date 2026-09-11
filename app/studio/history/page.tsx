import type { Metadata } from "next";

import StudioRoute from "../StudioRoute";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "资料与历史｜Course Studio",
  robots: { index: false, follow: false, noarchive: true },
};

export default function StudioHistoryPage() {
  return <StudioRoute section="history" />;
}
