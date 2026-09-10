import { notFound, redirect } from "next/navigation";

import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import { chatGPTSignInPath, getChatGPTUser, requireCompletedPasswordSetup } from "../../../chatgpt-auth";
import CoursewareFrame from "../../../course/[slug]/CoursewareFrame";
import { ClassroomError } from "../../../lib/classroom-errors";
import { loadCoursewareExact, SYSTEM_COURSEWARE_PROFILE } from "../../../lib/courseware-store";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

export default async function InternalCoursewarePreview({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<Query>;
}) {
  const { packageId } = await params;
  const query = await searchParams;
  const revision = typeof query.revision === "string" && /^\d+$/.test(query.revision) ? Number(query.revision) : NaN;
  const digest = typeof query.digest === "string" && /^[0-9a-f]{64}$/.test(query.digest) ? query.digest : "";
  if (!Number.isSafeInteger(revision) || revision < 0 || !digest) notFound();
  const returnTo = `/studio/courseware/${encodeURIComponent(packageId)}/?revision=${revision}&digest=${digest}`;
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  requireCompletedPasswordSetup(user, returnTo);
  if (user.impersonation) redirect(`/classroom/${encodeURIComponent(user.impersonation.classroomId)}/`);
  if (user.role !== "admin" && user.role !== "mentor") notFound();
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  let item;
  try { item = await loadCoursewareExact(db, packageId, revision, digest); }
  catch (error) {
    if (error instanceof ClassroomError && error.status === 404) notFound();
    throw error;
  }
  const mayPreview = user.role === "admin"
    || item.ownerProfileId === user.userId
    || (item.ownerProfileId === SYSTEM_COURSEWARE_PROFILE && item.released);
  if (!mayPreview || item.availability === "placeholder") notFound();
  return <CoursewareFrame
    item={item}
    preview
    backHref="/studio/courseware/"
    backLabel="导师课件库"
    user={{ userId: user.userId, username: user.username, displayName: user.displayName, role: user.role, impersonation: null }}
  />;
}
