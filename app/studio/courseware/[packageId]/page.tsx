import { permanentRedirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ packageId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { packageId } = await params;
  const query = await searchParams;
  const target = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") target.set(key, value);
  permanentRedirect(`/console/courseware/${encodeURIComponent(packageId)}/${target.size ? `?${target.toString()}` : ""}`);
}
