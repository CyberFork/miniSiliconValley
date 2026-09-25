import { notFound, redirect } from "next/navigation";

import { ensureClassroomSchema, getClassroomDb } from "../../../../db";
import CoursewareFrame from "../../../course/[slug]/CoursewareFrame";
import { ClassroomError } from "../../../lib/classroom-errors";
import { coursewarePlayerHref } from "../../../lib/courseware-navigation";
import { loadCoursewareExact, SYSTEM_COURSEWARE_PROFILE } from "../../../lib/courseware-store";
import { ConsoleShell } from "../../ConsoleShell";
import { ConsoleForbidden, consoleUser } from "../../console-auth";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;

export default async function InternalCoursewarePreview({ params, searchParams }: { params: Promise<{ packageId: string }>; searchParams: Promise<Query> }) {
  const { packageId } = await params;
  const query = await searchParams;
  const revision = typeof query.revision === "string" && /^\d+$/.test(query.revision) ? Number(query.revision) : NaN;
  const digest = typeof query.digest === "string" && /^[0-9a-f]{64}$/.test(query.digest) ? query.digest : "";
  if (!Number.isSafeInteger(revision) || revision < 0 || !digest) notFound();
  const returnTo = `/console/courseware/${encodeURIComponent(packageId)}/?revision=${revision}&digest=${digest}`;
  const user = await consoleUser(returnTo);
  if (!user) return <ConsoleForbidden />;
  const db = getClassroomDb();
  await ensureClassroomSchema(db);
  let item;
  try { item = await loadCoursewareExact(db, packageId, revision, digest); }
  catch (error) {
    if (error instanceof ClassroomError && error.status === 404) notFound();
    throw error;
  }
  const mayPreview = user.role === "admin" || item.ownerProfileId === user.userId || (item.ownerProfileId === SYSTEM_COURSEWARE_PROFILE && item.released);
  if (!mayPreview || item.availability === "placeholder") notFound();
  if (item.contentKind === "static-bundle") {
    const player = coursewarePlayerHref(item);
    if (!player) notFound();
    redirect(player);
  }
  return <ConsoleShell user={user} returnTo={returnTo}><CoursewareFrame item={item} preview backHref="/console/courseware/" backLabel="导师课件库" user={user} /></ConsoleShell>;
}
