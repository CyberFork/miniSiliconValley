import type { ClassroomD1 } from "../../db";
import type { AuthenticatedClassroomUser } from "./classroom-api";
import { ClassroomError } from "./classroom-errors";

export type ManagedHomeworkField = {
  id: string;
  label: string;
  kind: "short" | "long" | "single" | "multi";
  required: boolean;
  options?: string[];
};

export type ManagedHomeworkTemplate = {
  id: string;
  title: string;
  description: string;
  revision: number;
  status: "active" | "archived";
  fields: ManagedHomeworkField[];
  createdByProfileId: string;
  createdByName: string;
  updatedAt: string;
};

type AssignmentRow = {
  id: string; template_id: string; template_revision: number; room_id: string; room_title: string;
  title: string; instructions: string; status: "published" | "closed"; recipient_count: number;
  due_at: string | null; published_at: string; fields_json: string; template_description: string;
};

export async function getManagedHomeworkConsole(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  requireStaff(user);
  const [templates, rooms] = await Promise.all([listManagedHomeworkTemplates(db, user), listHomeworkRooms(db, user)]);
  const assignments = await listScopedAssignments(db, user);
  return { templates, rooms, assignments };
}

export async function listManagedHomeworkTemplates(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  requireStaff(user);
  const rows = await db.prepare(
    `SELECT t.id, t.title, t.description, t.current_revision, t.status, t.created_by_profile_id,
            t.updated_at, p.nickname AS created_by_name, v.fields_json
     FROM homework_templates t
     JOIN homework_template_versions v ON v.template_id = t.id AND v.revision = t.current_revision
     JOIN profiles p ON p.id = t.created_by_profile_id
     ORDER BY t.status = 'active' DESC, t.updated_at DESC`,
  ).all<Record<string, unknown>>();
  return (rows.results ?? []).map(templateFromRow);
}

export async function createManagedHomeworkTemplate(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown) {
  requireStaff(user);
  const body = object(input);
  const title = requiredText(body.title, "模板名称", 2, 80);
  const description = optionalText(body.description, "模板说明", 500);
  const fields = homeworkFields(body.fields);
  const requestKey = mutationKey(body.requestKey);
  const replay = await db.prepare(
    "SELECT id FROM homework_templates WHERE created_by_profile_id = ? AND request_key = ?",
  ).bind(user.userId, requestKey).first<{ id: string }>();
  if (replay) {
    const saved = await getTemplate(db, replay.id);
    requireTemplateReplay(saved, title, description, fields);
    return saved;
  }
  await ensureProfile(db, user);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO homework_templates
         (id, title, description, current_revision, status, created_by_profile_id, request_key, created_at, updated_at)
         VALUES (?, ?, ?, 1, 'active', ?, ?, ?, ?)`,
      ).bind(id, title, description, user.userId, requestKey, now, now),
      db.prepare(
        `INSERT INTO homework_template_versions
         (template_id, revision, title, description, fields_json, created_by_profile_id, created_at)
         VALUES (?, 1, ?, ?, ?, ?, ?)`,
      ).bind(id, title, description, JSON.stringify(fields), user.userId, now),
    ]);
  } catch (error) {
    const retry = await db.prepare("SELECT id FROM homework_templates WHERE created_by_profile_id = ? AND request_key = ?").bind(user.userId, requestKey).first<{ id: string }>();
    if (retry) {
      const saved = await getTemplate(db, retry.id);
      requireTemplateReplay(saved, title, description, fields);
      return saved;
    }
    throw writeFailure(error);
  }
  return getTemplate(db, id);
}

export async function updateManagedHomeworkTemplate(db: ClassroomD1, user: AuthenticatedClassroomUser, templateId: string, input: unknown) {
  requireStaff(user);
  const body = object(input);
  const current = await db.prepare(
    "SELECT current_revision, created_by_profile_id FROM homework_templates WHERE id = ?",
  ).bind(templateId).first<{ current_revision: number; created_by_profile_id: string }>();
  if (!current) throw new ClassroomError("HOMEWORK_TEMPLATE_NOT_FOUND", "没有找到这个作业模板。", 404);
  if (user.platformRole !== "admin" && current.created_by_profile_id !== user.userId) {
    throw new ClassroomError("HOMEWORK_TEMPLATE_EDIT_FORBIDDEN", "只有模板创建者或平台管理员可以修改它；其他导师仍可用于发放。", 403);
  }
  const expectedRevision = integer(body.expectedRevision, "模板版本", 1, 1_000_000);
  if (expectedRevision !== current.current_revision) throw new ClassroomError("HOMEWORK_TEMPLATE_STALE", "模板已被其他人更新，请刷新后再编辑。", 409);
  const title = requiredText(body.title, "模板名称", 2, 80);
  const description = optionalText(body.description, "模板说明", 500);
  const fields = homeworkFields(body.fields);
  const nextRevision = current.current_revision + 1;
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `UPDATE homework_templates SET title = ?, description = ?, current_revision = ?, updated_at = ?
         WHERE id = ? AND current_revision = ?`,
      ).bind(title, description, nextRevision, now, templateId, expectedRevision),
      db.prepare(
        `INSERT INTO homework_template_versions
         (template_id, revision, title, description, fields_json, created_by_profile_id, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
      ).bind(templateId, nextRevision, title, description, JSON.stringify(fields), user.userId, now),
    ]);
  } catch (error) { throw writeFailure(error); }
  const saved = await getTemplate(db, templateId);
  if (saved.revision !== nextRevision) throw new ClassroomError("HOMEWORK_TEMPLATE_STALE", "模板已被其他人更新，请刷新后再编辑。", 409);
  return saved;
}

export async function publishManagedHomeworkAssignment(db: ClassroomD1, user: AuthenticatedClassroomUser, input: unknown) {
  requireStaff(user);
  const body = object(input);
  const roomId = identifier(body.roomId, "课堂");
  await requireRoomScope(db, user, roomId);
  const templateId = identifier(body.templateId, "模板");
  const template = await getTemplate(db, templateId);
  if (template.status !== "active") throw new ClassroomError("HOMEWORK_TEMPLATE_ARCHIVED", "已归档模板不能继续发放。", 409);
  const title = optionalText(body.title, "作业标题", 100) || template.title;
  const instructions = optionalText(body.instructions, "发放说明", 800);
  const dueAt = optionalDate(body.dueAt);
  const requestKey = mutationKey(body.requestKey);
  const replay = await db.prepare(
    "SELECT id FROM homework_assignments WHERE created_by_profile_id = ? AND request_key = ?",
  ).bind(user.userId, requestKey).first<{ id: string }>();
  if (replay) {
    const saved = await getManagedAssignment(db, user, replay.id);
    requireAssignmentReplay(saved, { templateId, roomId, title, instructions, dueAt });
    return saved;
  }
  const recipients = await db.prepare(
    `SELECT DISTINCT m.profile_id FROM memberships m JOIN auth_users u ON u.id = m.profile_id
     WHERE m.room_id = ? AND m.role = 'learner' AND m.status = 'active' AND u.status = 'active'
     ORDER BY m.profile_id`,
  ).bind(roomId).all<{ profile_id: string }>();
  const ids = (recipients.results ?? []).map((row) => row.profile_id);
  if (!ids.length) throw new ClassroomError("HOMEWORK_ASSIGNMENT_EMPTY", "这场课堂没有可接收作业的在读学员。", 409);
  await ensureProfile(db, user);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [db.prepare(
    `INSERT INTO homework_assignments
     (id, template_id, template_revision, room_id, title, instructions, status, recipient_count, due_at,
      created_by_profile_id, request_key, published_at, closed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).bind(id, template.id, template.revision, roomId, title, instructions, ids.length, dueAt, user.userId, requestKey, now, now, now)];
  for (const profileId of ids) statements.push(db.prepare(
    "INSERT INTO homework_assignment_recipients (assignment_id, profile_id, created_at) VALUES (?, ?, ?)",
  ).bind(id, profileId, now));
  try { await db.batch(statements); }
  catch (error) {
    const retry = await db.prepare("SELECT id FROM homework_assignments WHERE created_by_profile_id = ? AND request_key = ?").bind(user.userId, requestKey).first<{ id: string }>();
    if (retry) {
      const saved = await getManagedAssignment(db, user, retry.id);
      requireAssignmentReplay(saved, { templateId, roomId, title, instructions, dueAt });
      return saved;
    }
    throw writeFailure(error);
  }
  return getManagedAssignment(db, user, id);
}

export async function listOwnHomeworkAssignments(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  requireLearner(user);
  const rows = await db.prepare(
    `${assignmentSelect()}
     JOIN homework_assignment_recipients recipient ON recipient.assignment_id = a.id AND recipient.profile_id = ?
     ORDER BY a.status = 'published' DESC, a.published_at DESC`,
  ).bind(user.userId).all<AssignmentRow>();
  const output = [];
  for (const row of rows.results ?? []) output.push(await learnerAssignmentFromRow(db, user.userId, row));
  return output;
}

export async function getOwnHomeworkAssignment(db: ClassroomD1, user: AuthenticatedClassroomUser, assignmentId: string) {
  requireLearner(user);
  const row = await db.prepare(
    `${assignmentSelect()}
     JOIN homework_assignment_recipients recipient ON recipient.assignment_id = a.id AND recipient.profile_id = ?
     WHERE a.id = ?`,
  ).bind(user.userId, assignmentId).first<AssignmentRow>();
  if (!row) throw new ClassroomError("HOMEWORK_ASSIGNMENT_NOT_FOUND", "没有找到发给你的这份作业。", 404);
  return learnerAssignmentFromRow(db, user.userId, row);
}

export async function saveOwnHomeworkResponse(db: ClassroomD1, user: AuthenticatedClassroomUser, assignmentId: string, input: unknown) {
  requireLearner(user);
  const assignment = await getOwnHomeworkAssignment(db, user, assignmentId);
  if (assignment.status !== "published") throw new ClassroomError("HOMEWORK_ASSIGNMENT_CLOSED", "这份作业已经截止，当前答案不会被覆盖。", 409);
  if (assignment.dueAt && Date.parse(assignment.dueAt) < Date.now()) throw new ClassroomError("HOMEWORK_ASSIGNMENT_DUE", "这份作业已经超过截止时间，请联系导师。", 409);
  const body = object(input);
  const status = body.status === "draft" || body.status === "submitted" ? body.status : null;
  if (!status) throw new ClassroomError("HOMEWORK_RESPONSE_STATUS_INVALID", "只能保存草稿或正式提交。", 400);
  const answers = normalizeManagedAnswers(assignment.fields, body.answers, status === "submitted");
  const now = new Date().toISOString();
  const existing = await db.prepare(
    "SELECT id, created_at FROM homework_assignment_responses WHERE assignment_id = ? AND profile_id = ?",
  ).bind(assignmentId, user.userId).first<{ id: string; created_at: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  await db.prepare(
    `INSERT INTO homework_assignment_responses
     (id, assignment_id, profile_id, answers_json, status, submitted_at, feedback, feedback_by_profile_id, feedback_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '', NULL, NULL, ?, ?)
     ON CONFLICT(assignment_id, profile_id) DO UPDATE SET answers_json = excluded.answers_json,
       status = excluded.status, submitted_at = excluded.submitted_at, updated_at = excluded.updated_at`,
  ).bind(id, assignmentId, user.userId, JSON.stringify(answers), status, status === "submitted" ? now : null, existing?.created_at ?? now, now).run();
  return getOwnHomeworkAssignment(db, user, assignmentId);
}

export async function closeManagedHomeworkAssignment(db: ClassroomD1, user: AuthenticatedClassroomUser, assignmentId: string) {
  requireStaff(user);
  const assignment = await getManagedAssignment(db, user, assignmentId);
  if (assignment.status === "closed") return assignment;
  const now = new Date().toISOString();
  await db.prepare("UPDATE homework_assignments SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, assignmentId).run();
  return getManagedAssignment(db, user, assignmentId);
}

export async function saveManagedHomeworkFeedback(db: ClassroomD1, user: AuthenticatedClassroomUser, assignmentId: string, profileId: string, input: unknown) {
  requireStaff(user);
  await getManagedAssignment(db, user, assignmentId);
  const body = object(input);
  const feedback = optionalText(body.feedback, "导师反馈", 1_200);
  const now = new Date().toISOString();
  const row = await db.prepare(
    `SELECT r.id FROM homework_assignment_responses r
     JOIN homework_assignment_recipients recipient ON recipient.assignment_id = r.assignment_id AND recipient.profile_id = r.profile_id
     WHERE r.assignment_id = ? AND r.profile_id = ?`,
  ).bind(assignmentId, profileId).first<{ id: string }>();
  if (!row) throw new ClassroomError("HOMEWORK_RESPONSE_NOT_FOUND", "这名学员还没有保存过作业。", 404);
  await db.prepare(
    "UPDATE homework_assignment_responses SET feedback = ?, feedback_by_profile_id = ?, feedback_at = ?, updated_at = ? WHERE id = ?",
  ).bind(feedback, user.userId, feedback ? now : null, now, row.id).run();
  return getManagedAssignment(db, user, assignmentId);
}

async function listHomeworkRooms(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  const query = user.platformRole === "admin"
    ? db.prepare(
      `SELECT r.id, r.title, ci.environment, COUNT(m.id) AS learner_count
       FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id
       LEFT JOIN memberships m ON m.room_id = r.id AND m.role = 'learner' AND m.status = 'active'
       WHERE ci.lifecycle != 'deleted' GROUP BY r.id ORDER BY ci.updated_at DESC`,
    )
    : db.prepare(
      `SELECT r.id, r.title, ci.environment, COUNT(DISTINCT learners.id) AS learner_count
       FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id
       LEFT JOIN memberships self ON self.room_id = r.id AND self.profile_id = ? AND self.role = 'dm' AND self.status = 'active'
       LEFT JOIN classroom_admin_dm_grants g ON g.room_id = r.id AND g.profile_id = ? AND g.revoked_at IS NULL
       LEFT JOIN memberships learners ON learners.room_id = r.id AND learners.role = 'learner' AND learners.status = 'active'
       WHERE ci.lifecycle != 'deleted' AND (self.id IS NOT NULL OR g.id IS NOT NULL)
       GROUP BY r.id ORDER BY ci.updated_at DESC`,
    ).bind(user.userId, user.userId);
  const rows = await query.all<{ id: string; title: string; environment: "test" | "production"; learner_count: number }>();
  return (rows.results ?? []).map((row) => ({ id: row.id, title: row.title, environment: row.environment, learnerCount: Number(row.learner_count) }));
}

async function listScopedAssignments(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  const scope = user.platformRole === "admin" ? "" : `AND (EXISTS(SELECT 1 FROM memberships self WHERE self.room_id = a.room_id AND self.profile_id = ? AND self.role = 'dm' AND self.status = 'active')
    OR EXISTS(SELECT 1 FROM classroom_admin_dm_grants g WHERE g.room_id = a.room_id AND g.profile_id = ? AND g.revoked_at IS NULL))`;
  const statement = db.prepare(`${assignmentSelect()} WHERE 1=1 ${scope} ORDER BY a.published_at DESC LIMIT 200`);
  const rows = user.platformRole === "admin" ? await statement.all<AssignmentRow>() : await statement.bind(user.userId, user.userId).all<AssignmentRow>();
  const output = [];
  for (const row of rows.results ?? []) output.push(await managedAssignmentFromRow(db, row));
  return output;
}

async function getManagedAssignment(db: ClassroomD1, user: AuthenticatedClassroomUser, assignmentId: string) {
  const row = await db.prepare(`${assignmentSelect()} WHERE a.id = ?`).bind(assignmentId).first<AssignmentRow>();
  if (!row) throw new ClassroomError("HOMEWORK_ASSIGNMENT_NOT_FOUND", "没有找到这份课堂作业。", 404);
  await requireRoomScope(db, user, row.room_id);
  return managedAssignmentFromRow(db, row);
}

async function managedAssignmentFromRow(db: ClassroomD1, row: AssignmentRow) {
  const responses = await db.prepare(
    `SELECT recipient.profile_id, u.username, u.display_name, r.id AS response_id, r.status, r.answers_json,
            r.submitted_at, r.feedback, r.feedback_at
     FROM homework_assignment_recipients recipient JOIN auth_users u ON u.id = recipient.profile_id
     LEFT JOIN homework_assignment_responses r ON r.assignment_id = recipient.assignment_id AND r.profile_id = recipient.profile_id
     WHERE recipient.assignment_id = ? ORDER BY u.display_name, u.username`,
  ).bind(row.id).all<Record<string, unknown>>();
  return {
    ...assignmentBase(row),
    fields: parseFields(row.fields_json),
    responses: (responses.results ?? []).map((item) => ({
      profileId: String(item.profile_id), username: String(item.username), displayName: String(item.display_name),
      responseId: item.response_id ? String(item.response_id) : null, status: item.status ? String(item.status) : "not-started",
      answers: parseAnswers(item.answers_json), submittedAt: item.submitted_at ? String(item.submitted_at) : null,
      feedback: String(item.feedback ?? ""), feedbackAt: item.feedback_at ? String(item.feedback_at) : null,
    })),
  };
}

async function learnerAssignmentFromRow(db: ClassroomD1, profileId: string, row: AssignmentRow) {
  const response = await db.prepare(
    "SELECT answers_json, status, submitted_at, feedback, feedback_at, updated_at FROM homework_assignment_responses WHERE assignment_id = ? AND profile_id = ?",
  ).bind(row.id, profileId).first<Record<string, unknown>>();
  return {
    ...assignmentBase(row), fields: parseFields(row.fields_json),
    response: response ? { answers: parseAnswers(response.answers_json), status: String(response.status), submittedAt: response.submitted_at ? String(response.submitted_at) : null, feedback: String(response.feedback ?? ""), feedbackAt: response.feedback_at ? String(response.feedback_at) : null, updatedAt: String(response.updated_at) } : null,
  };
}

function assignmentSelect() {
  return `SELECT a.id, a.template_id, a.template_revision, a.room_id, room.title AS room_title,
          a.title, a.instructions, a.status, a.recipient_count, a.due_at, a.published_at,
          version.fields_json, version.description AS template_description
   FROM homework_assignments a JOIN rooms room ON room.id = a.room_id
   JOIN homework_template_versions version ON version.template_id = a.template_id AND version.revision = a.template_revision`;
}

function assignmentBase(row: AssignmentRow) {
  return { id: row.id, templateId: row.template_id, templateRevision: Number(row.template_revision), roomId: row.room_id,
    roomTitle: row.room_title, title: row.title, instructions: row.instructions, templateDescription: row.template_description,
    status: row.status, recipientCount: Number(row.recipient_count), dueAt: row.due_at, publishedAt: row.published_at };
}

async function getTemplate(db: ClassroomD1, id: string): Promise<ManagedHomeworkTemplate> {
  const row = await db.prepare(
    `SELECT t.id, t.title, t.description, t.current_revision, t.status, t.created_by_profile_id,
            t.updated_at, p.nickname AS created_by_name, v.fields_json
     FROM homework_templates t JOIN homework_template_versions v ON v.template_id = t.id AND v.revision = t.current_revision
     JOIN profiles p ON p.id = t.created_by_profile_id WHERE t.id = ?`,
  ).bind(id).first<Record<string, unknown>>();
  if (!row) throw new ClassroomError("HOMEWORK_TEMPLATE_NOT_FOUND", "没有找到这个作业模板。", 404);
  return templateFromRow(row);
}

function templateFromRow(row: Record<string, unknown>): ManagedHomeworkTemplate {
  return { id: String(row.id), title: String(row.title), description: String(row.description ?? ""), revision: Number(row.current_revision),
    status: row.status === "archived" ? "archived" : "active", fields: parseFields(row.fields_json), createdByProfileId: String(row.created_by_profile_id),
    createdByName: String(row.created_by_name), updatedAt: String(row.updated_at) };
}

async function requireRoomScope(db: ClassroomD1, user: AuthenticatedClassroomUser, roomId: string) {
  requireStaff(user);
  const row = await db.prepare(
    `SELECT r.id,
      EXISTS(SELECT 1 FROM memberships m WHERE m.room_id = r.id AND m.profile_id = ? AND m.role = 'dm' AND m.status = 'active') AS dm,
      EXISTS(SELECT 1 FROM classroom_admin_dm_grants g WHERE g.room_id = r.id AND g.profile_id = ? AND g.revoked_at IS NULL) AS admin_dm
     FROM rooms r JOIN classroom_instances ci ON ci.room_id = r.id WHERE r.id = ? AND ci.lifecycle != 'deleted'`,
  ).bind(user.userId, user.userId, roomId).first<{ id: string; dm: number; admin_dm: number }>();
  if (!row) throw new ClassroomError("HOMEWORK_CLASSROOM_NOT_FOUND", "没有找到这场可发放作业的课堂。", 404);
  if (user.platformRole !== "admin" && !row.dm && !row.admin_dm) throw new ClassroomError("HOMEWORK_CLASSROOM_FORBIDDEN", "你不是这场课堂的导师或 Admin DM。", 403);
}

function requireStaff(user: AuthenticatedClassroomUser) {
  if (user.impersonationId || (user.platformRole !== "admin" && user.platformRole !== "mentor")) throw new ClassroomError("HOMEWORK_STAFF_REQUIRED", "只有真实登录的导师或管理员可以管理课堂作业。", 403);
}

function requireLearner(user: AuthenticatedClassroomUser) {
  if (user.impersonationId || user.platformRole !== "learner") throw new ClassroomError("HOMEWORK_LEARNER_REQUIRED", "只有真实登录的学员账号可以填写定向作业。", 403);
}

async function ensureProfile(db: ClassroomD1, user: AuthenticatedClassroomUser) {
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO profiles (id, nickname, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(user.userId, user.displayName, now, now).run();
}

function homeworkFields(value: unknown): ManagedHomeworkField[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new ClassroomError("HOMEWORK_FIELDS_INVALID", "模板需包含 1—30 个题目。", 400);
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const raw = object(entry);
    const fallback = `q${index + 1}`;
    const id = typeof raw.id === "string" && /^[a-z][a-z0-9_-]{0,39}$/.test(raw.id) ? raw.id : fallback;
    if (seen.has(id)) throw new ClassroomError("HOMEWORK_FIELD_ID_DUPLICATE", `题目标识 ${id} 重复。`, 400);
    seen.add(id);
    const label = requiredText(raw.label, `第 ${index + 1} 题`, 1, 160);
    const kind = raw.kind === "short" || raw.kind === "long" || raw.kind === "single" || raw.kind === "multi" ? raw.kind : null;
    if (!kind) throw new ClassroomError("HOMEWORK_FIELD_KIND_INVALID", `“${label}”的题型不受支持。`, 400);
    const options = kind === "single" || kind === "multi" ? choiceOptions(raw.options, label) : undefined;
    return { id, label, kind, required: raw.required === true, ...(options ? { options } : {}) };
  });
}

function choiceOptions(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) throw new ClassroomError("HOMEWORK_OPTIONS_INVALID", `“${label}”需有 2—20 个选项。`, 400);
  const options = [...new Set(value.map((item) => requiredText(item, "选项", 1, 80)))];
  if (options.length < 2) throw new ClassroomError("HOMEWORK_OPTIONS_INVALID", `“${label}”至少需要两个不同选项。`, 400);
  return options;
}

function normalizeManagedAnswers(fields: ManagedHomeworkField[], value: unknown, requireComplete: boolean) {
  const source = object(value);
  const answers: Record<string, string | string[]> = {};
  for (const field of fields) {
    if (field.kind === "short" || field.kind === "long") {
      const answer = optionalText(source[field.id], field.label, field.kind === "short" ? 300 : 2_000);
      if (requireComplete && field.required && !answer) throw new ClassroomError("HOMEWORK_REQUIRED_MISSING", `请完成“${field.label}”。`, 400);
      if (answer) answers[field.id] = answer;
    } else {
      const raw: string[] = Array.isArray(source[field.id])
        ? (source[field.id] as unknown[]).map((item) => String(item))
        : typeof source[field.id] === "string" ? [source[field.id] as string] : [];
      const allowed = new Set(field.options ?? []);
      const selected = [...new Set(raw.filter((item) => allowed.has(item)))];
      if (raw.length !== selected.length) throw new ClassroomError("HOMEWORK_CHOICE_INVALID", `“${field.label}”包含无效选项。`, 400);
      if (field.kind === "single" && selected.length > 1) throw new ClassroomError("HOMEWORK_CHOICE_INVALID", `“${field.label}”只能选择一项。`, 400);
      if (requireComplete && field.required && !selected.length) throw new ClassroomError("HOMEWORK_REQUIRED_MISSING", `请完成“${field.label}”。`, 400);
      if (selected.length) answers[field.id] = selected;
    }
  }
  return answers;
}

function parseFields(value: unknown): ManagedHomeworkField[] {
  try { return homeworkFields(typeof value === "string" ? JSON.parse(value) : value); } catch { return []; }
}

function parseAnswers(value: unknown): Record<string, string | string[]> {
  try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string | string[]> : {}; } catch { return {}; }
}

function requireTemplateReplay(saved: ManagedHomeworkTemplate, title: string, description: string, fields: ManagedHomeworkField[]) {
  if (saved.title !== title || saved.description !== description || JSON.stringify(saved.fields) !== JSON.stringify(fields)) {
    throw new ClassroomError("HOMEWORK_REQUEST_CONFLICT", "这个操作编号已经用于另一份模板，请刷新后重试。", 409);
  }
}

function requireAssignmentReplay(saved: { templateId: string; roomId: string; title: string; instructions: string; dueAt: string | null }, expected: { templateId: string; roomId: string; title: string; instructions: string; dueAt: string | null }) {
  if (saved.templateId !== expected.templateId || saved.roomId !== expected.roomId || saved.title !== expected.title || saved.instructions !== expected.instructions || saved.dueAt !== expected.dueAt) {
    throw new ClassroomError("HOMEWORK_REQUEST_CONFLICT", "这个操作编号已经用于另一次发放，请刷新后重试。", 409);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassroomError("HOMEWORK_INPUT_INVALID", "提交内容格式不正确。", 400);
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new ClassroomError("HOMEWORK_TEXT_INVALID", `${label}格式不正确。`, 400);
  const text = value.trim();
  if (text.length < min || text.length > max) throw new ClassroomError("HOMEWORK_TEXT_INVALID", `${label}需为 ${min}—${max} 个字符。`, 400);
  return text;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ClassroomError("HOMEWORK_TEXT_INVALID", `${label}格式不正确。`, 400);
  const text = value.trim();
  if (text.length > max) throw new ClassroomError("HOMEWORK_TEXT_INVALID", `${label}不能超过 ${max} 个字符。`, 400);
  return text;
}

function identifier(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 128) throw new ClassroomError("HOMEWORK_ID_INVALID", `${label}标识无效。`, 400);
  return value.trim();
}

function mutationKey(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new ClassroomError("HOMEWORK_REQUEST_INVALID", "操作编号无效，请刷新后重试。", 400);
  return value;
}

function integer(value: unknown, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new ClassroomError("HOMEWORK_NUMBER_INVALID", `${label}无效。`, 400);
  return Number(value);
}

function optionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new ClassroomError("HOMEWORK_DUE_INVALID", "截止时间格式无效。", 400);
  return new Date(value).toISOString();
}

function writeFailure(error: unknown) {
  console.error("[managed-homework-write]", error);
  return new ClassroomError("HOMEWORK_WRITE_FAILED", "课堂作业暂时没有保存成功，请刷新后重试。", 503);
}
