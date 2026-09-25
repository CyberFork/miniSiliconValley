import { redirect } from "next/navigation";

/** Compatibility-only application route. New navigation links to /framework/. */
export default function RetiredFrameworkRoute() {
  const origin = process.env.MSV_SITE_ORIGIN ?? "https://minisv.vip";
  redirect(new URL("/framework/", origin).toString());
}
