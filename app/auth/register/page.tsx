import type { Metadata } from "next";
import AuthShell from "../AuthShell";
import { RegisterForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "注册 Young Builder", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthShell title="领取身份。" accent="建立你自己的成长世界线。" description="任何学员都可以直接注册；账号属于个人，课堂归属由队伍申请和导师审批决定。无需手机号、邮箱或外部社交身份。">
      <RegisterForm returnTo={typeof params.returnTo === "string" ? params.returnTo : "/classroom"} />
    </AuthShell>
  );
}
