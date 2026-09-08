import type { Metadata } from "next";
import AuthShell from "../AuthShell";
import { RegisterForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "注册 Young Builder", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthShell title="领取身份。" accent="建立你自己的成长世界线。" description="这里可创建独立体验账号。正式 Classroom 由 Admin DM 预创建账号并直接配置 Membership；无需手机号、邮箱或外部社交身份。">
      <RegisterForm returnTo={typeof params.returnTo === "string" ? params.returnTo : "/classroom"} />
    </AuthShell>
  );
}
