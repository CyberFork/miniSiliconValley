export class ClassroomError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: string[];

  constructor(code: string, message: string, status = 400, details: string[] = []) {
    super(message);
    this.name = "ClassroomError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function assertClassroom(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new ClassroomError(code, message, status);
}
