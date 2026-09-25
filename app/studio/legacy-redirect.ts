import { permanentRedirect } from "next/navigation";

export type LegacySearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Preserve exact deep-link query state while retiring the old /studio tree. */
export async function redirectLegacyStudio(target: string, searchParams: LegacySearchParams): Promise<never> {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (typeof value === "string") params.set(key, value);
  }
  permanentRedirect(`${target}${params.size ? `?${params.toString()}` : ""}`);
}
