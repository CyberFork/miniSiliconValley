"use client";

import type { AuthBrowserAccountSetSummary, AuthUser } from "../lib/auth-model";
import { publicPath } from "../lib/public-path";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

export class BrowserAccountError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "BrowserAccountError";
  }
}

export type BrowserAccountMutationData = {
  user?: AuthUser;
  accountSet: AuthBrowserAccountSetSummary | null;
  signedOut?: boolean;
  idempotent?: boolean;
};

const CHANNEL_NAME = "msv-auth-v1";
let tabId = "";

function currentTabId(): string {
  if (!tabId) {
    tabId = typeof crypto === "object" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}.${Math.random()}`;
  }
  return tabId;
}

export async function readBrowserAccounts(): Promise<AuthBrowserAccountSetSummary | null> {
  const data = await accountRequest<{ accountSet: AuthBrowserAccountSetSummary | null }>("GET");
  return data.accountSet;
}

export async function ensureBrowserAccounts(): Promise<AuthBrowserAccountSetSummary> {
  const data = await accountRequest<{ accountSet: AuthBrowserAccountSetSummary }>("POST", { action: "ensure" });
  return data.accountSet;
}

export async function mutateBrowserAccount(
  action: "switch" | "logout-current" | "logout-all" | "remove",
  state: AuthBrowserAccountSetSummary,
  targetUserId?: string,
): Promise<BrowserAccountMutationData> {
  return accountRequest<BrowserAccountMutationData>("POST", {
    action,
    expectedVersion: state.version,
    idempotencyKey: `${action}.${crypto.randomUUID()}`,
    ...(targetUserId ? { targetUserId } : {}),
  });
}

export function accountLoginPath(returnTo: string, username?: string): string {
  const query = new URLSearchParams({ returnTo: safeAccountReturnTo(returnTo), add: "1" });
  if (username) query.set("username", username);
  return `${publicPath("/auth/login")}?${query.toString()}`;
}

export function safeAccountReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/classroom/";
  try {
    const url = new URL(value, "https://minisv.local");
    if (url.origin !== "https://minisv.local" || url.pathname.startsWith("/auth/")) return "/classroom/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/classroom/";
  }
}

/** Keep an account switch from stranding a learner on a mentor-only route.
 * Fine-grained classroom permissions are still enforced server-side; this
 * only handles the globally role-gated Studio surface that is knowable before
 * navigation. */
export function accountDestination(returnTo: string, user: Pick<AuthUser, "role">): string {
  const safe = safeAccountReturnTo(returnTo);
  const pathname = new URL(safe, "https://minisv.local").pathname;
  if ((user.role === "learner" || user.role === "observer") && pathname.startsWith("/studio")) {
    return "/classroom/?accountNotice=studio-role";
  }
  return safe;
}

export function hasUnsavedAccountWork(): boolean {
  return document.documentElement.dataset.msvUnsaved === "true";
}

export function confirmAccountChange(): boolean {
  return !hasUnsavedAccountWork() || window.confirm("当前页面还有未保存内容。切换账号会离开此页面；确定继续吗？");
}

export function approveAccountNavigation(): void {
  document.documentElement.dataset.msvAccountChangeApproved = "true";
  window.dispatchEvent(new CustomEvent("msv:account-change-approved"));
}

export function announceAccountChange(action: string): void {
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "account-changed", action, source: currentTabId(), at: Date.now() });
  channel.close();
}

export function listenForAccountChanges(onChange: () => void): () => void {
  if (!("BroadcastChannel" in window)) return () => undefined;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const value = event.data as { type?: unknown; source?: unknown } | null;
    if (value?.type === "account-changed" && value.source !== currentTabId()) onChange();
  };
  return () => channel.close();
}

async function accountRequest<T>(method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(publicPath("/api/auth/accounts"), {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const envelope = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok || !envelope?.ok || envelope.data === undefined) {
    throw new BrowserAccountError(
      envelope?.error?.message ?? "账号服务没有完成这次操作，请重试。",
      envelope?.error?.code ?? "ACCOUNT_REQUEST_FAILED",
      response.status,
    );
  }
  return envelope.data;
}
