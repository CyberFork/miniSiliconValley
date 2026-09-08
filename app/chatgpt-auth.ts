import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureClassroomSchema, getClassroomDb } from "../db";
import { authenticateSession } from "./lib/auth-store";
import type { AuthRole } from "./lib/auth-model";
import { publicPath } from "./lib/public-path";

export type ChatGPTUser = {
  userId: string;
  username: string;
  displayName: string;
  email: string;
  fullName: string | null;
  role: AuthRole | null;
  sessionId: string | null;
  mustChangePassword: boolean;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  if (process.env.MSV_SELF_HOSTED_AUTH === "app-session") {
    const db = getClassroomDb();
    await ensureClassroomSchema(db);
    const session = await authenticateSession(db, requestHeaders.get("cookie"));
    if (!session) return null;
    return {
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: `${session.username}@minisv.vip`,
      fullName: session.displayName,
      role: session.role,
      sessionId: session.sessionId,
      mustChangePassword: session.mustChangePassword,
    };
  }
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    username: email.split("@", 1)[0] || userId,
    displayName: fullName ?? email,
    email,
    fullName,
    role: null,
    sessionId: null,
    mustChangePassword: false,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

/** Keep one-time credentials away from classroom data until the holder
 * replaces the generated password. API guards enforce the same rule. */
export function requireCompletedPasswordSetup(user: ChatGPTUser, returnTo: string): void {
  if (!user.mustChangePassword) return;
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  redirect(`${publicPath("/account")}?first=1&returnTo=${encodeURIComponent(safeReturnTo)}`);
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (process.env.MSV_SELF_HOSTED_AUTH === "app-session") {
    return `${publicPath("/auth/login")}?returnTo=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (process.env.MSV_SELF_HOSTED_AUTH === "app-session") return publicPath("/auth/logout");
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === "/auth" || pathname.startsWith("/auth/") ||
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

export const getAppUser = getChatGPTUser;
export const requireAppUser = requireChatGPTUser;

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
