import { coursePackageDigest, validateCoursePackage } from "../../../lib/course-package";
import { resolveLearnerPolicy, validateCourseInstantiation } from "../../../lib/course-platform";
import { objectValue } from "../../../lib/platform-validation";
import { readPlatformJson, requireStudioRole, withPlatformApi } from "../../platform/_shared";

export const dynamic = "force-dynamic";

/** Validate a browser Working Copy without persisting a Candidate. */
export async function POST(request: Request): Promise<Response> {
  return withPlatformApi(request, async ({ user }) => {
    requireStudioRole(user);
    const raw = objectValue(await readPlatformJson(request));
    const course = validateCoursePackage(raw.course);
    const learnerPolicy = resolveLearnerPolicy(course);
    const maximumCapacity = validateCourseInstantiation(course, learnerPolicy.maxCount);
    return {
      macroSteps: course.macroSteps.length,
      blocks: course.blocks.length,
      decks: course.decks.length,
      cards: course.decks.reduce((total, deck) => total + deck.cards.length, 0),
      learnerPolicy,
      maximumCapacity,
      metadata: {
        schemaVersion: course.schemaVersion,
        digest: await coursePackageDigest(course),
      },
    };
  });
}
