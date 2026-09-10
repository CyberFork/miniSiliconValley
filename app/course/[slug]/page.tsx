import { notFound, redirect } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../chatgpt-auth";
import { isCoursewareLibraryVisible, loadCoursewareBySlug } from "../../lib/courseware-store";
import { ClassroomError } from "../../lib/classroom-errors";
import CoursewareFrame from "./CoursewareFrame";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

function nonNegativeInteger(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function exactCoursewarePath(slug: string, revision?: number, digest?: string, slide?: number, step?: number): string {
  const query = new URLSearchParams();
  if (revision !== undefined) query.set("revision", String(revision));
  if (digest) query.set("digest", digest);
  if (slide !== undefined && slide >= 1) query.set("slide", String(slide));
  if (step !== undefined) query.set("step", String(step));
  const suffix = query.toString();
  return `/course/${encodeURIComponent(slug)}/${suffix ? `?${suffix}` : ""}`;
}

export default async function CoursewarePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Query>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const revision = nonNegativeInteger(query.revision);
  const digest = typeof query.digest === "string" && /^[0-9a-f]{64}$/.test(query.digest) ? query.digest : undefined;
  const slide = nonNegativeInteger(query.slide);
  const step = nonNegativeInteger(query.step);
  const returnTo = exactCoursewarePath(slug, revision, digest, slide, step);
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor" && user.role !== "learner") notFound();
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  let item;
  try {
    item = await loadCoursewareBySlug(db, slug, revision, digest);
  } catch (error) {
    if (error instanceof ClassroomError && error.status === 404) notFound();
    throw error;
  }
  // /course/ is the Released read-only library for every real signed-in
  // learner and mentor. Candidate/Draft and system fallback field kits remain
  // Studio/factory-only even when somebody guesses their slug.
  if (!isCoursewareLibraryVisible(item)) notFound();
  return <CoursewareFrame
    item={item}
    initialSlide={slide}
    initialStep={step}
    user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }}
  />;
}
