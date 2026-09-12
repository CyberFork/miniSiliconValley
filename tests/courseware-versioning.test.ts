import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";

import type { ClassroomD1 } from "../db";
import type { AuthenticatedClassroomUser } from "../app/lib/classroom-api";
import { ClassroomError } from "../app/lib/classroom-errors";
import {
  beginCoursewareBundleUpload,
  finalizeCoursewareBundleUpload,
  loadCoursewareBundleAsset,
  saveCoursewareBundleChunk,
} from "../app/lib/courseware-bundle-store";
import {
  isCoursewareLibraryVisible,
  listCourseware,
  loadCoursewareBySlug,
  loadCoursewareExact,
  releaseCoursewareVersion,
  saveCoursewareVersion,
} from "../app/lib/courseware-store";

type LocalStatement = D1PreparedStatement & { execute(): D1Result };
type LocalDatabase = ClassroomD1 & { raw: DatabaseSync };

function database(maximum = Number.POSITIVE_INFINITY): LocalDatabase {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter((item) => /^\d{4}_.*\.sql$/.test(item) && Number(item.slice(0, 4)) <= maximum).sort()) {
    raw.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const api = {
    raw,
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...input: unknown[]) { values = input as SQLInputValue[]; return statement; },
        async first<T>() { return (raw.prepare(sql).get(...values) as T | undefined) ?? null; },
        async all<T>() { return { results: raw.prepare(sql).all(...values) as T[] }; },
        async run() { return statement.execute(); },
        execute() {
          const result = raw.prepare(sql).run(...values);
          return { success: true, meta: { changes: result.changes } } as unknown as D1Result;
        },
      };
      return statement;
    },
    async batch(statements: LocalStatement[]) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.execute());
        raw.exec("COMMIT");
        return results;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as LocalDatabase;
}

const author: AuthenticatedClassroomUser = { userId: "courseware-author", displayName: "Synthetic Author", platformRole: "mentor" };
const admin: AuthenticatedClassroomUser = { userId: "platform-admin", displayName: "Synthetic Admin", platformRole: "admin" };

function seedProfiles(db: LocalDatabase): void {
  const now = "2026-09-10T00:00:00Z";
  for (const [id, name] of [[author.userId, author.displayName], [admin.userId, admin.displayName]]) {
    db.raw.prepare("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES (?,?,?,?)").run(id, name, now, now);
  }
}

function html(label: string): string {
  return `<!doctype html><html><body><h1>${label}</h1><p>synthetic fixture only</p></body></html>`;
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(hash)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ClassroomError);
    assert.equal(error.code, code);
    return true;
  });
}

const bundledProductR0 = {
  revision: 0,
  digest: "b2852b39462bc05464582b3c36f773e68fa84775b9e7c7673a128fac97d7cda5",
  entryPath: "/courseware/product-mentor-foundations/",
} as const;
const bundledProductR1 = {
  revision: 1,
  digest: "8ade4830d08f901aba7ed4abc3ae73fd39a0a5f4e16a96935ca38603ba395346",
  entryPath: "/courseware/product-mentor-foundations/r1/",
} as const;

test("bundled product-manager r1 is current while the exact r0 remains playable", async () => {
  const db = database();
  try {
    const first = (await listCourseware(db)).find((item) => item.packageId === "cw-product-mentor-foundations");
    assert.equal(first?.latestRevision, bundledProductR1.revision);
    assert.equal(first?.latestDigest, bundledProductR1.digest);
    assert.equal(first?.releasedRevision, bundledProductR1.revision);
    assert.equal(first?.releasedDigest, bundledProductR1.digest);
    assert.deepEqual(first?.versions.map((version) => [version.revision, version.digest, version.releaseStatus]), [
      [bundledProductR1.revision, bundledProductR1.digest, "current"],
      [bundledProductR0.revision, bundledProductR0.digest, "historical"],
    ]);

    const current = await loadCoursewareBySlug(db, "product-mentor-foundations");
    const historical = await loadCoursewareExact(db, current.packageId, bundledProductR0.revision, bundledProductR0.digest);
    assert.equal(current.entryPath, bundledProductR1.entryPath);
    assert.equal(current.releaseStatus, "current");
    assert.equal(historical.entryPath, bundledProductR0.entryPath);
    assert.equal(historical.releaseStatus, "historical");
    assert.equal(historical.released, true);

    // Re-running the bootstrap is deliberately idempotent: no duplicate
    // versions or release-history rows are created.
    await listCourseware(db);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM courseware_versions WHERE package_id = ?").get(current.packageId) as { n: number }).n, 2);
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM courseware_releases WHERE package_id = ?").get(current.packageId) as { n: number }).n, 2);
  } finally { db.raw.close(); }
});

test("a production-style r0 registry upgrades to bundled r1 without rewriting r0", async () => {
  const db = database();
  try {
    const now = "2026-09-08T00:00:00Z";
    db.raw.prepare("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES (?,?,?,?)").run("system-courseware", "MiniSV 课程组", now, now);
    db.raw.prepare("INSERT INTO courseware_packages (id,slug,title,mentor_role,owner_profile_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)")
      .run("cw-product-mentor-foundations", "product-mentor-foundations", "产品导师｜青少年 AI 创业营", "P", "system-courseware", now, now);
    db.raw.prepare("INSERT INTO courseware_versions (package_id,revision,digest,content_kind,html_content,entry_path,byte_length,created_at,created_by_profile_id) VALUES (?,0,?,'static-bundle',NULL,?,?,?,?)")
      .run("cw-product-mentor-foundations", bundledProductR0.digest, bundledProductR0.entryPath, 135, now, "system-courseware");
    db.raw.prepare("INSERT INTO courseware_releases (package_id,revision,digest,released_at,released_by_profile_id) VALUES (?,0,?,?,?)")
      .run("cw-product-mentor-foundations", bundledProductR0.digest, now, "system-courseware");
    db.raw.prepare("INSERT INTO courseware_release_pointers (package_id,revision,digest,released_at,released_by_profile_id) VALUES (?,0,?,?,?)")
      .run("cw-product-mentor-foundations", bundledProductR0.digest, now, "system-courseware");

    const upgraded = await loadCoursewareBySlug(db, "product-mentor-foundations");
    assert.equal(upgraded.revision, bundledProductR1.revision);
    assert.equal(upgraded.digest, bundledProductR1.digest);
    assert.equal(upgraded.entryPath, bundledProductR1.entryPath);
    const untouched = await loadCoursewareExact(db, upgraded.packageId, bundledProductR0.revision, bundledProductR0.digest);
    assert.equal(untouched.entryPath, bundledProductR0.entryPath);
    assert.equal(untouched.releaseStatus, "historical");
  } finally { db.raw.close(); }
});

test("publishing r1 retains historical r0 while the default pointer becomes r1", async () => {
  const db = database();
  try {
    seedProfiles(db);
    const r0 = await saveCoursewareVersion(db, author, { slug: "synthetic-course", title: "Synthetic Course", mentorRole: "D", html: html("r0") });
    assert.equal(r0.releaseStatus, null);
    await releaseCoursewareVersion(db, author, r0);
    const r1 = await saveCoursewareVersion(db, author, { packageId: r0.packageId, slug: r0.slug, title: r0.title, mentorRole: "D", html: html("r1") });
    await releaseCoursewareVersion(db, author, r1);

    const historical = await loadCoursewareExact(db, r0.packageId, r0.revision, r0.digest);
    const current = await loadCoursewareExact(db, r1.packageId, r1.revision, r1.digest);
    const defaultVersion = await loadCoursewareBySlug(db, r0.slug);
    assert.equal(historical.released, true);
    assert.equal(historical.releaseStatus, "historical");
    assert.equal(current.released, true);
    assert.equal(current.releaseStatus, "current");
    assert.equal(defaultVersion.revision, r1.revision);
    assert.equal(defaultVersion.digest, r1.digest);
    await expectCode(loadCoursewareBySlug(db, r0.slug, r0.revision, r1.digest), "COURSEWARE_VERSION_NOT_FOUND");

    const summary = (await listCourseware(db)).find((item) => item.packageId === r0.packageId);
    assert.deepEqual(summary?.versions.map((version) => [version.revision, version.releaseStatus]), [[1, "current"], [0, "historical"]]);
  } finally { db.raw.close(); }
});

test("Candidate and system fallback visibility remain fail-closed", () => {
  assert.equal(isCoursewareLibraryVisible({ ownerProfileId: author.userId, contentKind: "inline-html", availability: "playable", released: false }), false);
  assert.equal(isCoursewareLibraryVisible({ ownerProfileId: "system-courseware", contentKind: "inline-html", availability: "placeholder", released: true }), false);
  assert.equal(isCoursewareLibraryVisible({ ownerProfileId: "system-courseware", contentKind: "static-bundle", availability: "playable", released: true }), true);
});

test("a directory bundle round-trips exact bytes and finalization is idempotent", async () => {
  const db = database();
  try {
    seedProfiles(db);
    const source = [
      { path: "index.html", mediaType: "text/html", bytes: new TextEncoder().encode("<!doctype html><html><body><img src=\"assets/pixel.txt\"></body></html>") },
      { path: "assets/pixel.txt", mediaType: "text/plain", bytes: new TextEncoder().encode("unchanged original bytes\n") },
    ];
    const files = await Promise.all(source.map(async (file) => ({ path: file.path, mediaType: file.mediaType, byteLength: file.bytes.byteLength, digest: await digest(file.bytes) })));
    const upload = await beginCoursewareBundleUpload(db, author, { slug: "synthetic-bundle", title: "Synthetic Bundle", mentorRole: "O", entryFile: "index.html", files });
    for (const file of source) {
      const chunkDigest = await digest(file.bytes);
      const first = await saveCoursewareBundleChunk(db, author, upload.uploadId, { path: file.path, chunkIndex: 0, digest: chunkDigest, dataBase64: base64(file.bytes) });
      assert.equal(first.accepted, true);
      const retry = await saveCoursewareBundleChunk(db, author, upload.uploadId, { path: file.path, chunkIndex: 0, digest: chunkDigest, dataBase64: base64(file.bytes) });
      assert.equal(retry.duplicate, true);
    }
    const exact = await finalizeCoursewareBundleUpload(db, author, upload.uploadId);
    const retry = await finalizeCoursewareBundleUpload(db, author, upload.uploadId);
    assert.deepEqual([retry.packageId, retry.revision, retry.digest, retry.treeDigest], [exact.packageId, exact.revision, exact.digest, exact.treeDigest]);
    assert.match(exact.entryPath ?? "", new RegExp(`^/courseware-assets/${exact.packageId}/${exact.revision}/${exact.digest}/index\\.html$`));
    for (const file of source) {
      const asset = await loadCoursewareBundleAsset(db, { packageId: exact.packageId, revision: exact.revision, digest: exact.digest, path: file.path });
      assert.deepEqual(asset.bytes, file.bytes);
      assert.equal(asset.digest, await digest(file.bytes));
    }
    assert.equal((db.raw.prepare("SELECT COUNT(*) AS n FROM courseware_bundle_versions WHERE package_id = ?").get(exact.packageId) as { n: number }).n, 1);
  } finally { db.raw.close(); }
});

test("bundle validation rejects traversal, archives, private keys, bad chunks and incomplete uploads", async () => {
  const db = database();
  try {
    seedProfiles(db);
    const bytes = new TextEncoder().encode("<!doctype html><html><body>fixture</body></html>");
    const fileDigest = await digest(bytes);
    const basic = { slug: "invalid-bundle", title: "Invalid Bundle", mentorRole: "P", entryFile: "index.html" };
    await expectCode(beginCoursewareBundleUpload(db, author, { ...basic, files: [{ path: "../index.html", byteLength: bytes.byteLength, digest: fileDigest }] }), "COURSEWARE_BUNDLE_PATH_INVALID");
    await expectCode(beginCoursewareBundleUpload(db, author, { ...basic, entryFile: "deck.zip", files: [{ path: "deck.zip", byteLength: bytes.byteLength, digest: fileDigest }] }), "COURSEWARE_BUNDLE_FILE_FORBIDDEN");
    await expectCode(beginCoursewareBundleUpload(db, author, { ...basic, entryFile: "secret.key", files: [{ path: "secret.key", byteLength: bytes.byteLength, digest: fileDigest }] }), "COURSEWARE_BUNDLE_FILE_FORBIDDEN");

    const upload = await beginCoursewareBundleUpload(db, author, { ...basic, files: [{ path: "index.html", mediaType: "text/html", byteLength: bytes.byteLength, digest: fileDigest }] });
    await expectCode(saveCoursewareBundleChunk(db, author, upload.uploadId, { path: "index.html", chunkIndex: 0, digest: "0".repeat(64), dataBase64: base64(bytes) }), "COURSEWARE_BUNDLE_CHUNK_DIGEST_MISMATCH");
    await expectCode(finalizeCoursewareBundleUpload(db, author, upload.uploadId), "COURSEWARE_BUNDLE_CHUNKS_INCOMPLETE");
  } finally { db.raw.close(); }
});

test("migration fails closed on mismatched legacy refs and installs immutable exact guards", () => {
  const db = database(8);
  try {
    const now = "2026-09-10T00:00:00Z";
    db.raw.prepare("INSERT INTO profiles (id,nickname,created_at,updated_at) VALUES (?,?,?,?)").run(author.userId, author.displayName, now, now);
    db.raw.prepare("INSERT INTO courseware_packages (id,slug,title,mentor_role,owner_profile_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").run("cw-mismatch", "mismatch", "Mismatch", "P", author.userId, now, now);
    db.raw.prepare("INSERT INTO courseware_versions (package_id,revision,digest,content_kind,html_content,entry_path,byte_length,created_at,created_by_profile_id) VALUES (?,0,?,'inline-html',?,NULL,?,?,?)").run("cw-mismatch", "a".repeat(64), html("mismatch"), 100, now, author.userId);
    db.raw.prepare("INSERT INTO courseware_release_pointers (package_id,revision,digest,released_at,released_by_profile_id) VALUES (?,0,?,?,?)").run("cw-mismatch", "b".repeat(64), now, author.userId);
    const migration = readFileSync(new URL("../drizzle/0009_courseware_release_history_and_bundles.sql", import.meta.url), "utf8");
    assert.throws(() => db.raw.exec(migration), /CHECK constraint failed/);
    assert.equal((db.raw.prepare("SELECT digest FROM courseware_release_pointers WHERE package_id = ?").get("cw-mismatch") as { digest: string }).digest, "b".repeat(64));
  } finally { db.raw.close(); }

  const guarded = database();
  try {
    seedProfiles(guarded);
    const now = "2026-09-10T00:00:00Z";
    guarded.raw.prepare("INSERT INTO courseware_packages (id,slug,title,mentor_role,owner_profile_id,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").run("cw-guard", "guard", "Guard", "P", author.userId, now, now);
    guarded.raw.prepare("INSERT INTO courseware_versions (package_id,revision,digest,content_kind,html_content,entry_path,byte_length,created_at,created_by_profile_id) VALUES (?,0,?,'inline-html',?,NULL,?,?,?)").run("cw-guard", "c".repeat(64), html("guard"), 100, now, author.userId);
    assert.throws(() => guarded.raw.prepare("UPDATE courseware_versions SET digest = ? WHERE package_id = ? AND revision = 0").run("d".repeat(64), "cw-guard"), /COURSEWARE_VERSION_IMMUTABLE/);
    assert.throws(() => guarded.raw.prepare("INSERT INTO courseware_releases (package_id,revision,digest,released_at,released_by_profile_id) VALUES (?,0,?,?,?)").run("cw-guard", "e".repeat(64), now, author.userId), /COURSEWARE_EXACT_REF_INVALID/);
  } finally { guarded.raw.close(); }
});
