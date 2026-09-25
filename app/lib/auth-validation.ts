import { AuthError } from "./auth-errors";
import type { AuthRole } from "./auth-model";

const COMMON_PASSWORDS = new Set([
  "123456789012", "password1234", "qwertyuiop12", "letmein123456", "admin12345678",
]);

export function parseUsername(value: unknown): string {
  const username = requiredString(value, "用户名").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) {
    throw new AuthError("USERNAME_INVALID", "用户名需为3–32位，以字母开头，只包含小写字母、数字、- 或 _。", 400);
  }
  return username;
}

export function parseDisplayName(value: unknown): string {
  const displayName = requiredString(value, "显示名称").trim().replace(/\s+/g, " ");
  const length = Array.from(displayName).length;
  if (length < 2 || length > 40) throw new AuthError("DISPLAY_NAME_INVALID", "显示名称需为2–40个字符。", 400);
  if (Array.from(displayName).some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)) {
    throw new AuthError("DISPLAY_NAME_INVALID", "显示名称包含不可用字符。", 400);
  }
  return displayName;
}

export function parsePassword(value: unknown): string {
  const password = requiredString(value, "密码");
  const length = Array.from(password).length;
  if (length < 12) throw new AuthError("PASSWORD_TOO_SHORT", "密码至少需要12个字符；推荐使用易记的长句。", 400);
  if (length > 128 || new TextEncoder().encode(password).byteLength > 512) {
    throw new AuthError("PASSWORD_TOO_LONG", "密码最多128个字符。", 400);
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || /^(.)\1{11,}$/.test(password)) {
    throw new AuthError("PASSWORD_TOO_COMMON", "这个密码过于常见，请换一条更长且独特的密码短语。", 400);
  }
  return password;
}

export function parseRole(value: unknown): AuthRole {
  if (value === "admin" || value === "mentor" || value === "learner" || value === "observer") return value;
  throw new AuthError("ROLE_INVALID", "账号角色无效。", 400);
}

export function parseBoolean(value: unknown): boolean {
  return value === true;
}

export function requiredString(value: unknown, label: string, max = 512): string {
  if (typeof value !== "string" || value.length === 0) throw new AuthError("FIELD_REQUIRED", `请填写${label}。`, 400);
  if (value.length > max) throw new AuthError("FIELD_TOO_LONG", `${label}内容过长。`, 400);
  return value;
}

export function optionalString(value: unknown, label: string, max = 120): string | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = requiredString(value, label, max).trim();
  return parsed || null;
}

export function parsePositiveInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new AuthError("NUMBER_INVALID", `${label}需为${minimum}–${maximum}之间的整数。`, 400);
  }
  return Number(value);
}
