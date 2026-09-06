import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getAppUser } from "../chatgpt-auth";
import type { AuthUser } from "../lib/auth-model";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "账户中心", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const current = await getAppUser();
  if (!current || !current.role) redirect(chatGPTSignInPath("/account"));
  const user: AuthUser = {
    userId: current.userId,
    username: current.username,
    displayName: current.displayName,
    role: current.role,
    mustChangePassword: false,
  };
  return <AccountClient initialUser={user} />;
}
