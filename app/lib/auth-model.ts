export type AuthRole = "admin" | "mentor" | "learner" | "observer";

export type AuthIdentitySummary = {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
};

export type AuthImpersonationContext = {
  id: string;
  classroomId: string;
  expiresAt: string;
  actor: AuthIdentitySummary & { role: "admin" };
  effective: AuthIdentitySummary & { role: Exclude<AuthRole, "admin"> };
};

export type AuthUser = {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  mustChangePassword: boolean;
  impersonation?: AuthImpersonationContext | null;
};

export type AuthSessionUser = AuthUser & {
  sessionId: string;
  sessionExpiresAt: string;
};

export type AuthSessionSummary = {
  id: string;
  current: boolean;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AuthBrowserAccountStatus = "available" | "expired" | "disabled" | "reauthenticate";

/** Minimal identity projection for accounts explicitly verified in this one
 * browser.  It never contains a password, cookie, session token or platform
 * directory entry. */
export type AuthBrowserAccountSummary = AuthIdentitySummary & {
  current: boolean;
  status: AuthBrowserAccountStatus;
  mustChangePassword: boolean;
  remember: boolean;
  expiresAt: string;
  lastUsedAt: string;
};

export type AuthBrowserAccountSetSummary = {
  version: number;
  currentUserId: string | null;
  accounts: AuthBrowserAccountSummary[];
};

export type ManagedAuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
  status: "active" | "disabled";
  activeSessions: number;
  createdAt: string;
  lastSeenAt: string | null;
};

export type IssuedPasswordResetLink = {
  username: string;
  displayName: string;
  resetUrl: string;
  expiresAt: string;
};

export type IssuedManagedCredential = {
  userId: string;
  username: string;
  displayName: string;
  role: Exclude<AuthRole, "admin">;
  initialPassword: string;
  mustChangePassword: true;
};
