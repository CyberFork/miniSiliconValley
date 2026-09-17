import type { CoursewareContent } from "./courseware-store";

export type CoursewarePresenterSurface = {
  href: string;
  label: string;
  description: string;
};

const COURSEWARE_PRESENTER_SURFACES: Readonly<Record<string, CoursewarePresenterSurface>> = Object.freeze({
  "cw-development-mentor-module-thinking": {
    href: "/courseware/development-mentor-module-thinking/teacher/presenter.html",
    label: "打开导师讲解控制台",
    description: "教师屏包含逐页讲稿、可接受回答、常见误区、备课材料、下一页预览和投屏控制。",
  },
});

/**
 * Optional private teaching surface for a released courseware package.
 *
 * This is intentionally separate from `entryPath`: the normal entry is the
 * audience-safe artifact, while the presenter surface is protected by the
 * mentor-courseware auth gateway. UI visibility is only discoverability; the
 * gateway remains the actual authorization boundary.
 */
export function coursewarePresenterSurface(packageId: string): CoursewarePresenterSurface | null {
  return COURSEWARE_PRESENTER_SURFACES[packageId] ?? null;
}

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
