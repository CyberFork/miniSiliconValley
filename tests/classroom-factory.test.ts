import assert from "node:assert/strict";
import test from "node:test";

import {
  assertClassroomFactoryRequest,
  buildClassroomFactoryPlan,
  canActorAdministerClassroom,
  controllerTransition,
  type ClassroomFactoryRequest,
} from "../app/lib/classroom-factory";
import { coursewareBundleDigest } from "../app/lib/courseware-store";

const exactCandidate = {
  courseId: "google-1995-2004",
  schemaVersion: 1,
  revision: 8,
  digest: "a".repeat(64),
  status: "candidate" as const,
};
const exactReleased = { ...exactCandidate, status: "released" as const, releasedAt: "2026-09-08T00:00:00Z" };
const courseware = (["P", "D", "M", "O"] as const).map((mentorRole, index) => ({
  mentorRole,
  packageId: `courseware-${mentorRole.toLowerCase()}`,
  slug: `mentor-${mentorRole.toLowerCase()}`,
  revision: index + 1,
  digest: String(index + 1).repeat(64),
}));

function request(overrides: Partial<ClassroomFactoryRequest> = {}): ClassroomFactoryRequest {
  return {
    environment: "test",
    title: "Factory acceptance",
    learnerCount: 4,
    courseRef: exactCandidate,
    viewAcceptanceReceiptId: "view-acceptance-receipt",
    coursewareRefs: courseware,
    adminDmProfileIds: ["admin-external"],
    mentorSeats: [
      { mentorRole: "P", profileId: "mentor-product" },
      { mentorRole: "D", profileId: "mentor-development" },
      { mentorRole: "M", profileId: "mentor-market" },
      { mentorRole: "O", profileId: "mentor-operations" },
    ],
    learnerProfileIds: ["learner-1", "learner-2", "learner-3", "learner-4"],
    ...overrides,
  };
}

test("Test and Production use one factory plan and the same state-machine version", () => {
  const testPlan = buildClassroomFactoryPlan(request(), "factory-seed");
  const productionPlan = buildClassroomFactoryPlan(request({ environment: "production", courseRef: exactReleased, uiAcceptanceReceiptId: "ui-acceptance-receipt" }), "factory-seed");
  assert.equal(testPlan.stateMachineVersion, productionPlan.stateMachineVersion);
  assert.equal(testPlan.initialControllerState.state, "ready");
  assert.equal(productionPlan.initialControllerState.state, "ready");
  assert.deepEqual(testPlan.mentorSeats.map((seat) => seat.mentorRole), ["P", "D", "M", "O"]);
  assert.equal(testPlan.learnerMemberships.length, 4);
  assert.equal(testPlan.adminPermissions.length, 1);
  assert.equal(testPlan.viewAcceptanceReceiptId, "view-acceptance-receipt");
  assert.equal(testPlan.uiAcceptanceReceiptId, null);
  assert.equal(productionPlan.uiAcceptanceReceiptId, "ui-acceptance-receipt");
  assert.ok(!testPlan.mentorSeats.some((seat) => seat.profileId === "admin-external"));
});

test("Production refuses Candidate and Test accepts Candidate", () => {
  assert.doesNotThrow(() => assertClassroomFactoryRequest(request()));
  assert.throws(
    () => assertClassroomFactoryRequest(request({ environment: "production", courseRef: exactCandidate })),
    /正式课堂只能绑定 Released/,
  );
  assert.throws(
    () => assertClassroomFactoryRequest(request({ environment: "production", courseRef: exactReleased })),
    /真实课堂 UI 验收回执/,
  );
  assert.throws(
    () => assertClassroomFactoryRequest(request({ uiAcceptanceReceiptId: "ui-must-not-bind-to-test" })),
    /Test Classroom 不应绑定/,
  );
});

test("every classroom requires an exact ViewAcceptanceReceipt", () => {
  assert.throws(
    () => assertClassroomFactoryRequest({ ...request(), viewAcceptanceReceiptId: "" }),
    /多角色视图验收回执/,
  );
});

test("factory requires exact four distinct mentor roles and exact learner count", () => {
  assert.throws(() => assertClassroomFactoryRequest(request({ mentorSeats: request().mentorSeats.slice(0, 3) })), /P、D、M、O 四个导师席/);
  assert.throws(() => assertClassroomFactoryRequest(request({ learnerCount: 2 })), /学员账号数量必须等于 learnerCount/);
});

test("courseware binding is exact and covers P/D/M/O before creation", () => {
  assert.throws(() => assertClassroomFactoryRequest(request({ coursewareRefs: courseware.slice(0, 3) })), /四位导师都必须绑定 exact 课件版本/);
  assert.throws(() => assertClassroomFactoryRequest(request({ coursewareRefs: [{ ...courseware[0], digest: "bad" }, ...courseware.slice(1)] })), /课件 digest/);
});

test("courseware bundle digest is canonical across API and DB property order", async () => {
  const databaseShaped = courseware.map((ref) => ({
    mentorRole: ref.mentorRole,
    packageId: ref.packageId,
    revision: ref.revision,
    digest: ref.digest,
    slug: ref.slug,
  }));
  assert.equal(await coursewareBundleDigest(courseware), await coursewareBundleDigest(databaseShaped));
});

test("Admin DM is a permission and can overlap a mentor without creating a fifth role", () => {
  const input = request({ adminDmProfileIds: ["mentor-product", "admin-external"] });
  const plan = buildClassroomFactoryPlan(input, "factory-seed");
  assert.equal(plan.mentorSeats.length, 4);
  assert.equal(plan.adminPermissions.length, 2);
  assert.equal(canActorAdministerClassroom("mentor-product", plan.adminPermissions), true);
  assert.equal(canActorAdministerClassroom("mentor-development", plan.adminPermissions), false);
});

test("controller state machine is versioned and classroom-local", () => {
  const left = buildClassroomFactoryPlan(request({ title: "Left" }), "left");
  const right = buildClassroomFactoryPlan(request({ title: "Right" }), "right");
  const executing = controllerTransition(left.initialControllerState, { type: "execute" }, "2026-09-08T00:00:00Z");
  assert.equal(executing.state, "executing");
  assert.equal(right.initialControllerState.state, "ready");
  assert.throws(() => controllerTransition(left.initialControllerState, { type: "accept" }, "2026-09-08T00:00:00Z"), /不能直接验收/);

  const awaitingAcceptance = controllerTransition(executing, { type: "submit-for-acceptance" }, "2026-09-08T00:01:00Z");
  const accepted = controllerTransition(awaitingAcceptance, { type: "accept" }, "2026-09-08T00:02:00Z");
  assert.throws(() => controllerTransition(accepted, { type: "execute" }, "2026-09-08T00:03:00Z"), /不能开始执行/);
  const nextBlock = controllerTransition(accepted, { type: "advance", nextBlockId: "B02" }, "2026-09-08T00:03:00Z");
  assert.deepEqual({ state: nextBlock.state, blockId: nextBlock.blockId, blockIndex: nextBlock.blockIndex }, { state: "ready", blockId: "B02", blockIndex: 1 });
});
