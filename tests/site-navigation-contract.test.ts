import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => fs.existsSync(path.join(root, file));
const expectSource = (file: string, pattern: RegExp, label: string) => {
  assert.match(read(file), pattern, `${label} (${file})`);
};

test("navigation baseline pages exist", () => {
  for (const file of [
    "app/page.tsx", "app/world/page.tsx", "app/studio/page.tsx", "app/studio/editor/page.tsx", "app/studio/history/page.tsx",
    "app/classroom/page.tsx", "app/course/page.tsx", "app/account/page.tsx",
    "app/auth/login/page.tsx", "app/auth/register/page.tsx",
  ]) assert.ok(exists(file), `核心入口缺失: ${file}`);
});

test("core navigation uses real href-capable anchors", () => {
  expectSource("app/components/NavigationLink.tsx", /return <a[\s\S]*href=\{href\}/, "NavigationLink 必须生成真实 href");
  expectSource("app/components/NavigationLink.tsx", /Never preventDefault/, "NavigationLink 不得劫持原生导航");
  for (const file of ["app/classroom/ClassroomHub.tsx", "app/course/page.tsx", "app/course/[slug]/CoursewareFrame.tsx", "app/studio/StudioApp.tsx"]) {
    expectSource(file, /NavigationLink|from ["']\.\.\/components\/NavigationLink|from ["']\.\.\/\.\/components\/NavigationLink/, `核心导航入口 ${file} 应使用 NavigationLink 或其导入`);
  }
  for (const file of ["app/components/NavigationLink.tsx", "app/classroom/ClassroomHub.tsx", "app/course/page.tsx", "app/studio/StudioApp.tsx"]) {
    assert.doesNotMatch(read(file), /href\s*=\s*["']javascript:/i, `入口 ${file} 禁止 javascript URL`);
  }
});

test("studio, editor and classroom return loops retain real hrefs", () => {
  expectSource("app/studio/StudioRoute.tsx", /chatGPTSignInPath\(returnTo\)/, "Studio 登录回跳必须使用 returnTo");
  expectSource("app/studio/editor/page.tsx", /Link href="\/classroom\/"/, "Editor 必须可返回课堂");
  expectSource("app/classroom/ClassroomHub.tsx", /href=\{`\/classroom\/\$\{encodeURIComponent\(room\.id\)\}\/`\}/, "Classroom 房间入口必须构造编码 classroomId");
  expectSource("app/classroom/ClassroomHub.tsx", /Link href="\/studio\/"/, "Classroom 必须可进入 Studio");
  expectSource("app/classroom/ClassroomHub.tsx", /Link href="\/course\/"/, "Classroom 必须可进入 Course");
  expectSource("app/course/page.tsx", /Link href="\/classroom\/"/, "Course 必须可返回 Classroom");
  expectSource("app/course/page.tsx", /revision=\$\{item\.releasedRevision\}&digest=\$\{item\.releasedDigest\}/, "Course 入口必须保留 released revision/digest");
});

test("course exact preview links and auth/account return paths are source-backed", () => {
  expectSource("app/course/[slug]/CoursewareFrame.tsx", /revision=\$\{item\.revision\}&digest=\$\{item\.digest\}/, "CoursewareFrame 必须构造 exact revision/digest");
  expectSource("app/studio/courseware/[packageId]/page.tsx", /returnTo = `\/studio\/courseware\/\$\{encodeURIComponent\(packageId\)\}\/\?revision=\$\{revision\}&digest=\$\{digest\}`/, "Studio preview returnTo 必须包含 exact 参数");
  expectSource("app/account/page.tsx", /chatGPTSignInPath\("\/account"\)/, "Account 未登录必须回到登录入口");
  expectSource("app/account/page.tsx", /requested\.startsWith\("\/"\)/, "Account returnTo 必须限制为站内路径");
  expectSource("app/auth/login/page.tsx", /returnTo/, "Auth 登录页必须接收回跳参数");
});

test("retired routes are not reintroduced as navigation hrefs", () => {
  const files = ["app/components/NavigationLink.tsx", "app/components/BrandHomeLink.tsx", "app/classroom/ClassroomHub.tsx", "app/course/page.tsx", "app/studio/StudioApp.tsx", "app/auth/AuthShell.tsx"];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /href\s*=\s*["'`]\/alpha(?:[/?"'`]|$)/, `退休入口 /alpha 不得出现在 ${file}`);
    assert.doesNotMatch(source, /href\s*=\s*["'`]\/control(?:[/?"'`]|$)/, `全局 /control 不得出现在 ${file}`);
  }
});

test("T-109 separates the public website, teaching services and internal history", () => {
  const portal = read("deploy/minisv/site/index.html");
  const studio = read("app/studio/StudioApp.tsx");
  const archiveAccess = read("app/api/auth/studio-archive-access/route.ts");
  for (const route of ["/world/", "/framework/", "/parents/", "/classroom/", "/course/"]) {
    assert.match(portal, new RegExp(`href=["']${route.replaceAll("/", "\\/")}`), `官网缺少 ${route}`);
  }
  assert.doesNotMatch(portal, /href=["']\/(?:studio|workshop)\//, "公开官网不得暴露内部工作入口");
  assert.match(studio, /href:\s*"\/studio\/history\/"/);
  assert.match(studio, /href="\/workshop\/"/);
  assert.match(studio, /href:\s*"\/classroom\/#factory"/);
  assert.match(archiveAccess, /\["admin", "mentor"\]/);
  assert.match(archiveAccess, /user\.impersonation \|\| user\.mustChangePassword/);
  assert.doesNotMatch(archiveAccess, /"learner"/);
});
