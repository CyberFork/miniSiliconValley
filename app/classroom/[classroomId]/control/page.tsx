import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClassroomControlPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  permanentRedirect(`/console/classrooms/${encodeURIComponent(classroomId)}/control/`);
}
