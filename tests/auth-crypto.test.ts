import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createPasswordDigest,
  hashSecret,
  randomSecret,
  verifyPasswordDigest,
} from "../app/lib/auth-crypto";
import { AuthError } from "../app/lib/auth-errors";
import { parseDisplayName, parsePassword, parseUsername } from "../app/lib/auth-validation";

const authStore = readFileSync(new URL("../app/lib/auth-store.ts", import.meta.url), "utf8");

test("password digests use unique salts and verify without storing plaintext", async () => {
  const one = await createPasswordDigest("Correct horse battery staple 2026", undefined, 1_000);
  const two = await createPasswordDigest("Correct horse battery staple 2026", undefined, 1_000);
  assert.notEqual(one.salt, two.salt);
  assert.notEqual(one.hash, two.hash);
  assert.equal(await verifyPasswordDigest("Correct horse battery staple 2026", one.hash, one.salt, one.iterations), true);
  assert.equal(await verifyPasswordDigest("wrong password phrase", one.hash, one.salt, one.iterations), false);
  assert.doesNotMatch(JSON.stringify(one), /Correct horse/);
});

test("reset tokens are high-entropy URL-safe secrets with deterministic digests", async () => {
  const token = randomSecret(32);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await hashSecret("same"), await hashSecret("same"));
  assert.notEqual(await hashSecret(token), token);
});

test("account validation accepts passphrases and rejects ambiguous identities", () => {
  assert.equal(parseUsername("  Msv-Builder_2 "), "msv-builder_2");
  assert.equal(parseDisplayName("  Young   Builder  "), "Young Builder");
  assert.equal(parsePassword("这是一条足够长而且独特的密码短语"), "这是一条足够长而且独特的密码短语");
  assert.throws(() => parseUsername("2bad"), AuthError);
  assert.throws(() => parseDisplayName("x"), AuthError);
  assert.throws(() => parsePassword("password1234"), AuthError);
});

test("password reset stores only a digest, limits roles and atomically claims once", () => {
  assert.match(authStore, /await hashSecret\(token\)/);
  assert.match(authStore, /target\.role === "learner" \|\| target\.role === "observer"/);
  assert.match(authStore, /consumed_at IS NULL AND expires_at > \?/);
  assert.match(authStore, /WHERE id = \? AND consumed_at IS NULL AND expires_at > \?/);
  assert.match(authStore, /Number\(results\[0\]\?\.meta\?\.changes \?\? 0\) !== 1/);
});
