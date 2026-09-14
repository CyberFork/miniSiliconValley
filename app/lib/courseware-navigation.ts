import type { CoursewareContent } from "./courseware-store";

/**
 * Build the authenticated hand-off from an exact library record to its real
 * teaching surface. Existing package query parameters (for example the
 * product-mentor `view=overview`) are preserved; exact identity and an
 * optional deep link are then overlaid deterministically.
 */
export function coursewarePlayerHref(
  item: Pick<CoursewareContent, "entryPath" | "revision" | "digest">,
  initialSlide?: number,
  initialStep?: number,
): string | null {
  if (!item.entryPath) return null;
  const target = new URL(item.entryPath, "https://minisv.invalid");
  target.searchParams.set("revision", String(item.revision));
  target.searchParams.set("digest", item.digest);
  if (initialSlide !== undefined && initialSlide >= 0) target.searchParams.set("slide", String(initialSlide));
  if (initialStep !== undefined && initialStep >= 0) target.searchParams.set("step", String(initialStep));
  return `${target.pathname}${target.search}${target.hash}`;
}
