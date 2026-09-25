import type { Metadata } from "next";
import AuthShell from "../AuthShell";
import { RecoveryGuide } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "找回账号", robots: { index: false, follow: false } };

export default function RecoverPage() {
  return (
    <AuthShell title="世界线没有丢失。" accent="让导师帮你重新取得访问权。" description="导师只生成一次性重置链接，不会看到你的新密码；你的课堂记录、声望、钱包和作品档案都不会被清除。">
      <RecoveryGuide />
    </AuthShell>
  );
}
