import vinext from "vinext";
import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const publicBase = process.env.MSV_PUBLIC_BASE ?? "/";
if (!publicBase.startsWith("/") || !publicBase.endsWith("/") || publicBase.includes("..") || publicBase.includes("//")) {
  throw new Error(`MSV_PUBLIC_BASE must be a normalized absolute path ending in /: ${publicBase}`);
}

function sourceCommit(): string {
  const explicit = process.env.MSV_SOURCE_COMMIT?.trim();
  if (explicit) {
    if (!/^[0-9a-f]{40}$/.test(explicit)) throw new Error("MSV_SOURCE_COMMIT must be a full lowercase git SHA.");
    return explicit;
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown-source-commit";
  }
}

const buildSourceCommit = sourceCommit();
const buildIsDirty = (() => {
  try { return Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim()); }
  catch { return true; }
})();
const appBuildId = process.env.MSV_APP_BUILD_ID?.trim()
  || `source-${buildSourceCommit.slice(0, 12)}${buildIsDirty ? "-dirty" : ""}`;

const runtimeVars: Record<string, string> = {};
for (const key of [
  "MSV_SELF_HOSTED_AUTH",
  "MSV_APP_BASE_PATH",
  "MSV_SITE_ORIGIN",
  "MSV_CANONICAL_URL",
  "MSV_123456_CANONICAL_URL",
  "MSV_COURSE_REGISTRY_URL",
  "MSV_COURSE_REGISTRY_KEY",
]) {
  if (process.env[key]) runtimeVars[key] = process.env[key]!;
}

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: runtimeVars,
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    base: publicBase,
    define: {
      __MSV_SOURCE_COMMIT__: JSON.stringify(buildSourceCommit),
      __MSV_APP_BUILD_ID__: JSON.stringify(appBuildId),
    },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
        persistState: process.env.MSV_PERSIST_PATH
          ? { path: process.env.MSV_PERSIST_PATH }
          : undefined,
      }),
    ],
  };
});
