import assert from "node:assert/strict";

import { GET as bootstrap } from "../app/api/classroom/bootstrap/route";
import { POST as join } from "../app/api/classroom/join/route";
import { POST as createRoom } from "../app/api/classroom/rooms/route";
import { GET as room } from "../app/api/classroom/rooms/[roomId]/route";
import { POST as action } from "../app/api/classroom/rooms/[roomId]/actions/route";
import { GET as exportRoom } from "../app/api/classroom/rooms/[roomId]/export/route";
import { GET as learners } from "../app/api/classroom/rooms/[roomId]/learners/route";

type LegacyHandler = (request: Request, context: { params: Promise<{ roomId: string }> }) => Promise<Response>;

const context = { params: Promise.resolve({ roomId: "retired-fixture-room" }) };
const checks: Array<{ name: string; method: "GET" | "POST"; path: string; handler: LegacyHandler }> = [
  { name: "bootstrap", method: "GET", path: "/api/classroom/bootstrap", handler: (request) => bootstrap(request) },
  { name: "join", method: "POST", path: "/api/classroom/join", handler: (request) => join(request) },
  { name: "rooms", method: "POST", path: "/api/classroom/rooms", handler: (request) => createRoom(request) },
  { name: "room", method: "GET", path: "/api/classroom/rooms/retired-fixture-room", handler: room },
  { name: "actions", method: "POST", path: "/api/classroom/rooms/retired-fixture-room/actions", handler: action },
  { name: "export", method: "GET", path: "/api/classroom/rooms/retired-fixture-room/export", handler: exportRoom },
  { name: "learners", method: "GET", path: "/api/classroom/rooms/retired-fixture-room/learners?q=builder", handler: learners },
];

for (const check of checks) {
  const request = new Request(`https://minisv.vip${check.path}`, {
    method: check.method,
    headers: check.method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: check.method === "POST" ? JSON.stringify({ sentinel: "must-be-drained-before-410" }) : undefined,
  });
  const response = await check.handler(request, context);
  assert.equal(response.status, 410, `${check.name} must be permanently retired`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("link") ?? "", /\/api\/platform\/classrooms/);
  const envelope = await response.json() as { ok: boolean; error?: { code?: string; message?: string } };
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error?.code, "LEGACY_CLASSROOM_API_RETIRED");
  assert.match(envelope.error?.message ?? "", /\/api\/platform\/classrooms/);
  if (check.method === "POST") assert.equal(request.bodyUsed, true, `${check.name} must drain its request body`);
}

console.log(`CLASSROOM_E2E_PASS legacy=${checks.length}-routes-410 successor=/api/platform/classrooms body=drained`);
