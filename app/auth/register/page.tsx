import type { Metadata } from "next";
import AuthShell from "../AuthShell";
import { RegisterForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "注册 Young Builder", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthShell title="领取身份。" accent="建立你自己的成长世界线。" description="任何人都可以自行创建 Young Builder 学员账号，无需手机号、邮箱或外部社交身份。注册后可探索 World 和已发布课件；具体 Classroom 由 Admin DM 明确配置 Membership。">
      <RegisterForm returnTo={typeof params.returnTo === "string" ? params.returnTo : "/course/"} />
    </AuthShell>
  );
}
