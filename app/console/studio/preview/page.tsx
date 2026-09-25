import { ConsoleStudioRoute } from "../ConsoleStudioRoute";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const courseId = typeof query.course === "string" ? query.course : null;
  const revision = typeof query.revision === "string" && /^\d+$/.test(query.revision) ? Number(query.revision) : null;
  const digest = typeof query.digest === "string" ? query.digest : undefined;
  return <ConsoleStudioRoute section="preview" initialCourseRef={courseId && revision !== null ? { courseId, revision, ...(digest ? { digest } : {}) } : null} />;
}
