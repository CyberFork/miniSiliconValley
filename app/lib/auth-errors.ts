export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function assertAuth(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) throw new AuthError(code, message, status, details);
}
