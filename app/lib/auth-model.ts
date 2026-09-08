export type AuthRole = "admin" | "mentor" | "learner" | "observer";

export type AuthUser = {
  userId: string;
  username: string;
  displayName: string;
  role: AuthRole;
  mustChangePassword: boolean;
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
