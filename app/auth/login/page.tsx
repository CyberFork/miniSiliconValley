import type { Metadata } from "next";
import { getAppUser } from "../../chatgpt-auth";
import type { AuthUser } from "../../lib/auth-model";
import AuthShell from "../AuthShell";
import { LoginForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "登录", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const signedOutParam = single(params.signedOut);
  const current = await getAppUser();
  const initialUser: AuthUser | null = current?.role ? {
    userId: current.userId, username: current.username, displayName: current.displayName, role: current.role, mustChangePassword: current.mustChangePassword,
  } : null;
  return (
    <AuthShell title="不是访客。" accent="你是这段历史里的行动者。" description="登录后，你的身份、私密情报、课堂协作、声望和作品会沿同一条 Young Builder 世界线持续积累。">
      <LoginForm
        returnTo={single(params.returnTo) ?? "/classroom"}
        initialUser={initialUser}
        signedOut={signedOutParam === "all" ? "all" : signedOutParam === "current" || signedOutParam === "1" ? "current" : null}
        addAccount={single(params.add) === "1"}
        initialUsername={single(params.username) ?? ""}
      />
    </AuthShell>
  );
}

function single(value: string | string[] | undefined): string | null { return typeof value === "string" ? value : null; }
