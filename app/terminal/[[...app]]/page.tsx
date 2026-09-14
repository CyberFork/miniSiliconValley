import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import TerminalClient, { type TerminalAppId } from "../TerminalClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的时空终端", robots: { index: false, follow: false } };

const APPS = new Set<TerminalAppId>(["home", "identity", "courses", "space", "wallet", "shop", "homework", "games", "grants"]);

export default async function TerminalPage({ params }: { params: Promise<{ app?: string[] }> }) {
  const user = await getChatGPTUser();
  if (!user || !user.role) redirect(chatGPTSignInPath("/terminal/"));
  requireCompletedPasswordSetup(user, "/terminal/");
  const path = (await params).app ?? [];
  const requested = path.length === 0 ? "home" : path.length === 1 && APPS.has(path[0] as TerminalAppId) ? path[0] as TerminalAppId : null;
  if (!requested) redirect("/terminal/");
  if (requested === "grants" && user.role !== "admin" && user.role !== "mentor") redirect("/terminal/");
  return <TerminalClient
    initialApp={requested}
    initialUser={{
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      impersonation: user.impersonation,
    }}
  />;
}
