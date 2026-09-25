/**
 * These identifiers are injected by Vite for a production build.  Direct
 * TypeScript tests do not pass through Vite, so they deliberately fall back to
 * explicit environment values and finally to a visibly non-production value.
 */
declare const __MSV_SOURCE_COMMIT__: string | undefined;
declare const __MSV_APP_BUILD_ID__: string | undefined;

function injected(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const MSV_SOURCE_COMMIT = injected(
  typeof __MSV_SOURCE_COMMIT__ === "undefined" ? undefined : __MSV_SOURCE_COMMIT__,
) ?? injected(process.env.MSV_SOURCE_COMMIT) ?? "development-untracked";

export const MSV_APP_BUILD_ID = injected(
  typeof __MSV_APP_BUILD_ID__ === "undefined" ? undefined : __MSV_APP_BUILD_ID__,
) ?? injected(process.env.MSV_APP_BUILD_ID) ?? "development-unbundled";

export const MSV_BUILD_IDENTITY = Object.freeze({
  sourceCommit: MSV_SOURCE_COMMIT,
  appBuildId: MSV_APP_BUILD_ID,
});
