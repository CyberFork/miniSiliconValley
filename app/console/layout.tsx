import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "MINI硅谷工作台", robots: { index: false, follow: false, noarchive: true } };

export default function ConsoleLayout({ children }: { children: ReactNode }) { return children; }
