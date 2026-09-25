/// <reference types="vite/client" />

function normalizePublicBase(value: string | undefined) {
  if (!value || value === "/") return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

const viteBase =
  typeof import.meta.env === "object" && typeof import.meta.env.BASE_URL === "string"
    ? import.meta.env.BASE_URL
    : "/";

export const PUBLIC_BASE = normalizePublicBase(viteBase);

export function publicPath(path: string) {
  if (!path.startsWith("/")) throw new Error(`publicPath expects an absolute path: ${path}`);
  return PUBLIC_BASE === "/" ? path : `${PUBLIC_BASE.slice(0, -1)}${path}`;
}
