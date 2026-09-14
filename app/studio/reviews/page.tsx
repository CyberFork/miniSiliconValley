import { redirectLegacyStudio, type LegacySearchParams } from "../legacy-redirect";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams: LegacySearchParams }){ return redirectLegacyStudio("/console/studio/reviews/", searchParams); }
