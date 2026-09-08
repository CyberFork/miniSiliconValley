import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getAppUser } from "../chatgpt-auth";
import type { AuthUser } from "../lib/auth-model";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "账户中心", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const current = await getAppUser();
  if (!current || !current.role) redirect(chatGPTSignInPath("/account"));
  const user: AuthUser = {
    userId: current.userId,
    username: current.username,
    displayName: current.displayName,
    role: current.role,
    mustChangePassword: current.mustChangePassword,
  };
  const requested = typeof params.returnTo === "string" ? params.returnTo : "/classroom/";
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/auth") && !requested.startsWith("/account") ? requested : "/classroom/";
  return <AccountClient initialUser={user} firstLogin={params.first === "1"} returnTo={returnTo} />;
}
