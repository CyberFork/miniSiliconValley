import type { Metadata } from "next";
import AuthShell from "../AuthShell";
import { ResetPasswordForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "设置新密码", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="重新掌握账号。" accent="你的新密码只属于你。" description="一次性链接中的秘密不会进入页面请求、反向代理日志或引用来源；页面读取后会立即从地址栏移除。重置成功后，其他设备全部退出。">
      <ResetPasswordForm />
    </AuthShell>
  );
}
