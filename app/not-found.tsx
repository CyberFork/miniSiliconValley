import { BrandHomeLink } from "./components/BrandHomeLink";

export default function NotFound() {
  return (
    <main className="msv-not-found">
      <BrandHomeLink subtitle="HOME · 返回总导航" />
      <section>
        <span>404 · WORLDLINE NOT FOUND</span>
        <h1>这条世界线<br />还没有被建立。</h1>
        <p>地址可能已迁移，回到 Mini Silicon Valley 总导航继续探索。</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">回到主页 →</a>
      </section>
    </main>
  );
}
