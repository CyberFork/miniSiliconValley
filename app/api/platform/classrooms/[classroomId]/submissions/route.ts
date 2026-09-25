import { submitClassroomBlockWork } from "../../../../../lib/classroom-platform-store";
import { integerValue, objectValue, parseRunExpectation, stringValue } from "../../../../../lib/platform-validation";
import { readPlatformJson, withPlatformApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }): Promise<Response> {
  return withPlatformApi(request, async ({ db, user }) => {
    const raw = objectValue(await readPlatformJson(request));
    const { classroomId } = await context.params;
    const result = await submitClassroomBlockWork(db, user, classroomId, {
      ...parseRunExpectation(raw),
      blockId: stringValue(raw.blockId, "Block", 64),
      expectedVersion: integerValue(raw.expectedVersion, "作品版本", 0, 1_000_000),
      idempotencyKey: stringValue(raw.idempotencyKey, "幂等键", 128),
      ...(raw.kind == null ? {} : { kind: stringValue(raw.kind, "作品类型", 32) }),
      ...(raw.text == null ? {} : { text: stringValue(raw.text, "作品内容", 4_000) }),
      ...(raw.schemaId == null ? {} : { schemaId: stringValue(raw.schemaId, "作品结构", 96) }),
      ...(raw.values == null ? {} : { values: objectValue(raw.values) }),
      ...(raw.viewAsProfileId == null ? {} : { viewAsProfileId: stringValue(raw.viewAsProfileId, "测试视角账号", 128) }),
    });
    return { submitted: true, ...result };
  });
}
