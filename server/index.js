const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { renderPrivateMvpHtml } = require("./private-mvp");
const { renderPrivateProjectHtml } = require("./private-project");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(ROOT_DIR, "data"));
const DB_FILE = path.join(DATA_DIR, "database.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PORT = Number(process.env.PORT || 4173);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 6) * 1024 * 1024;
const MULTI_UPLOAD_BODY_BYTES = Math.max(16 * 1024 * 1024, MAX_UPLOAD_BYTES * 8);
const SESSION_DAYS = 7;
const EVIDENCE_RETENTION_DAYS = 7;
const TASK_VALIDATION_HOURS = 12;
const VALIDATION_REMINDER_HOURS_BEFORE = 2;
const FINAL_TASK_EVIDENCE_MIN = 3;
const WORKER_PROFILE_EXPERIENCE_LIMIT = 8;
const WORKER_PROFILE_REFERENCE_LIMIT = 6;
const WORKER_PROFILE_SKILL_LIMIT = 30;
const SESSION_COOKIE = "meo_session";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SUPABASE_EVIDENCE_BUCKET = String(process.env.SUPABASE_EVIDENCE_BUCKET || "meo-evidence");
const CRON_SECRET = String(process.env.CRON_SECRET || "");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "");
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "");
const GOOGLE_REDIRECT_URI = String(process.env.GOOGLE_REDIRECT_URI || "");
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const APP_STORAGE_DRIVER = String(
  process.env.APP_STORAGE_DRIVER || (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local")
).toLowerCase();

const ROLES = new Set(["manager", "employee", "contractor", "worker", "company", "client", "developer"]);
const MANAGED_ROLES = new Set(["manager", "employee", "contractor", "client", "developer"]);
const OPERATIONAL_ROLES = new Set(["manager", "employee", "contractor", "company"]);
const PROJECT_VIEWER_ROLES = new Set(["client", "developer"]);
const TASK_STATUSES = new Set([
  "planned",
  "assigned",
  "in_progress",
  "blocked",
  "pending_validation",
  "approved",
  "rejected"
]);

const PUBLIC_STATUS_LABELS = {
  planned: "Planeada",
  assigned: "Atribuida",
  in_progress: "Em execucao",
  blocked: "Bloqueada / espera material",
  pending_validation: "Concluida a aguardar validacao",
  approved: "Aprovada",
  rejected: "Rejeitada"
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

let writeQueue = Promise.resolve();

const TABLES = [
  {
    key: "companies",
    table: "meo_companies",
    idKey: "id",
    fields: {
      id: "id",
      name: "name",
      location: "location",
      website: "website",
      sector: "sector",
      description: "description",
      createdAt: "created_at"
    }
  },
  {
    key: "users",
    table: "meo_users",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      name: "name",
      email: "email",
      role: "role",
      passwordHash: "password_hash",
      active: "active",
      profile: "profile",
      createdBy: "created_by",
      invitedBy: "invited_by",
      createdAt: "created_at"
    }
  },
  {
    key: "sessions",
    table: "meo_sessions",
    idKey: "tokenHash",
    fields: {
      tokenHash: "token_hash",
      userId: "user_id",
      createdAt: "created_at",
      expiresAt: "expires_at"
    }
  },
  {
    key: "invites",
    table: "meo_invites",
    idKey: "id",
    fields: {
      id: "id",
      tokenHash: "token_hash",
      companyId: "company_id",
      role: "role",
      email: "email",
      name: "name",
      createdBy: "created_by",
      createdAt: "created_at",
      expiresAt: "expires_at",
      usedAt: "used_at"
    }
  },
  {
    key: "workOrders",
    table: "meo_work_orders",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      title: "title",
      address: "address",
      description: "description",
      createdBy: "created_by",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  },
  {
    key: "tasks",
    table: "meo_tasks",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      workOrderId: "work_order_id",
      title: "title",
      description: "description",
      assigneeId: "assignee_id",
      assigneeName: "assignee_name",
      dueDate: "due_date",
      status: "status",
      blockReason: "block_reason",
      validationComment: "validation_comment",
      createdBy: "created_by",
      createdAt: "created_at",
      updatedAt: "updated_at",
      startedAt: "started_at",
      completedAt: "completed_at",
      validationDueAt: "validation_due_at",
      approvedAt: "approved_at",
      rejectedAt: "rejected_at"
    }
  },
  {
    key: "evidences",
    table: "meo_evidences",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      taskId: "task_id",
      workOrderId: "work_order_id",
      userId: "user_id",
      userName: "user_name",
      kind: "kind",
      originalName: "original_name",
      mimeType: "mime_type",
      storedName: "stored_name",
      note: "note",
      location: "location",
      capturedAt: "captured_at",
      uploadedAt: "uploaded_at",
      expiresAt: "expires_at",
      fileHash: "file_hash",
      metadata: "metadata",
      authenticity: "authenticity",
      createdAt: "created_at"
    }
  },
  {
    key: "auditLogs",
    table: "meo_audit_logs",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      actorId: "actor_id",
      actorName: "actor_name",
      actorRole: "actor_role",
      entityType: "entity_type",
      entityId: "entity_id",
      action: "action",
      detail: "detail",
      ip: "ip",
      createdAt: "created_at"
    }
  },
  {
    key: "jobOffers",
    table: "meo_job_offers",
    idKey: "id",
    fields: {
      id: "id",
      companyId: "company_id",
      companyName: "company_name",
      title: "title",
      position: "position",
      location: "location",
      contractType: "contract_type",
      salary: "salary",
      schedule: "schedule",
      description: "description",
      requirements: "requirements",
      status: "status",
      createdBy: "created_by",
      createdAt: "created_at",
      updatedAt: "updated_at",
      closedAt: "closed_at"
    }
  },
  {
    key: "jobApplications",
    table: "meo_job_applications",
    idKey: "id",
    fields: {
      id: "id",
      jobOfferId: "job_offer_id",
      companyId: "company_id",
      workerId: "worker_id",
      workerName: "worker_name",
      workerEmail: "worker_email",
      message: "message",
      status: "status",
      decisionReason: "decision_reason",
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
];

function now() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function cleanString(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function cleanDate(value) {
  const text = cleanString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const timestamp = new Date(`${text}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return "";
  return text;
}

function cleanStringList(value, maxItems = WORKER_PROFILE_SKILL_LIMIT, maxLength = 80) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,;]+/)
        .map((item) => item.trim());
  const unique = new Map();
  source.forEach((item) => {
    const cleaned = cleanString(item, maxLength);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!unique.has(key)) unique.set(key, cleaned);
  });
  return Array.from(unique.values()).slice(0, maxItems);
}

function cleanWorkerExperience(items) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, WORKER_PROFILE_EXPERIENCE_LIMIT)
    .map((item) => ({
      title: cleanString(item?.title, 140),
      company: cleanString(item?.company, 140),
      location: cleanString(item?.location, 140),
      startDate: cleanDate(item?.startDate),
      endDate: cleanDate(item?.endDate),
      description: cleanString(item?.description, 900)
    }))
    .filter((item) => item.title || item.company || item.description);
}

function cleanWorkerReferences(items) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, WORKER_PROFILE_REFERENCE_LIMIT)
    .map((item) => ({
      name: cleanString(item?.name, 140),
      company: cleanString(item?.company, 140),
      role: cleanString(item?.role, 140),
      phone: cleanString(item?.phone, 80),
      email: normalizeEmail(item?.email),
      relationship: cleanString(item?.relationship, 180)
    }))
    .filter((item) => item.name || item.company || item.phone || item.email);
}

function addHours(value, hours) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function addDays(value, days) {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isPast(value, reference = Date.now()) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= reference;
}

function hoursUntil(value, reference = Date.now()) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (timestamp - reference) / (60 * 60 * 1000);
}

function googleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function requestOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || (req.socket.encrypted ? "https" : "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host || `localhost:${PORT}`}`;
}

function googleRedirectUri(req) {
  return GOOGLE_REDIRECT_URI || `${requestOrigin(req)}/api/auth/google/callback`;
}

function safeReturnPath(value) {
  const pathValue = String(value || "/").trim();
  if (!pathValue.startsWith("/") || pathValue.startsWith("//") || pathValue.startsWith("/api/")) return "/";
  return pathValue.slice(0, 300);
}

function addQueryParam(pathValue, key, value) {
  const url = new URL(safeReturnPath(pathValue), "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function googleStateSecret() {
  return GOOGLE_CLIENT_SECRET || "google-oauth-not-configured";
}

function signGoogleState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", googleStateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyGoogleState(value) {
  const [body, signature] = String(value || "").split(".");
  if (!body || !signature) {
    const error = new Error("Invalid Google login state.");
    error.status = 400;
    throw error;
  }
  const expected = crypto.createHmac("sha256", googleStateSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    const error = new Error("Invalid Google login state.");
    error.status = 400;
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    const error = new Error("Invalid Google login state.");
    error.status = 400;
    throw error;
  }
  if (!payload?.createdAt || Date.now() - Number(payload.createdAt) > GOOGLE_STATE_TTL_MS) {
    const error = new Error("Google login expired. Try again.");
    error.status = 400;
    throw error;
  }
  return {
    next: safeReturnPath(payload.next),
    intent: payload.intent === "worker" ? "worker" : "login"
  };
}

function createEmptyDb() {
  return {
    meta: {
      version: 1,
      createdAt: now(),
      nextIds: {
        companies: 1,
        users: 1,
        invites: 1,
        workOrders: 1,
        tasks: 1,
        evidences: 1,
        auditLogs: 1,
        jobOffers: 1,
        jobApplications: 1
      }
    },
    companies: [],
    users: [],
    sessions: [],
    invites: [],
    workOrders: [],
    tasks: [],
    evidences: [],
    auditLogs: [],
    jobOffers: [],
    jobApplications: []
  };
}

function ensureShape(db) {
  const empty = createEmptyDb();
  db.meta = db.meta || empty.meta;
  db.meta.nextIds = db.meta.nextIds || empty.meta.nextIds;
  for (const [key, value] of Object.entries(empty.meta.nextIds)) {
    if (!db.meta.nextIds[key]) db.meta.nextIds[key] = value;
  }
  for (const key of [
    "companies",
    "users",
    "sessions",
    "invites",
    "workOrders",
    "tasks",
    "evidences",
    "auditLogs",
    "jobOffers",
    "jobApplications"
  ]) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  db.users.forEach((user) => {
    if (!user.profile || typeof user.profile !== "object") user.profile = {};
  });
  return db;
}

async function ensureStorage() {
  validateStorageDriver();
  if (APP_STORAGE_DRIVER === "supabase") {
    await ensureSupabaseStorage();
    return;
  }
  await ensureLocalStorage();
}

async function readDb() {
  validateStorageDriver();
  if (APP_STORAGE_DRIVER === "supabase") {
    return readSupabaseDb();
  }
  await ensureLocalStorage();
  const raw = await fsp.readFile(DB_FILE, "utf-8");
  return ensureShape(JSON.parse(raw));
}

async function writeDb(db, previousDb) {
  validateStorageDriver();
  if (APP_STORAGE_DRIVER === "supabase") {
    await writeSupabaseDb(db, previousDb);
    return;
  }
  await ensureLocalStorage();
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(db, null, 2));
  await fsp.rename(tmpFile, DB_FILE);
}

function mutateDb(handler) {
  const run = writeQueue.then(async () => {
    const db = await readDb();
    const previousDb = JSON.parse(JSON.stringify(db));
    const result = await handler(db);
    await writeDb(db, previousDb);
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}

async function ensureLocalStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    await fsp.writeFile(DB_FILE, JSON.stringify(createEmptyDb(), null, 2));
  }
}

function validateStorageDriver() {
  if (!["local", "supabase"].includes(APP_STORAGE_DRIVER)) {
    const error = new Error('APP_STORAGE_DRIVER must be "local" or "supabase".');
    error.status = 500;
    throw error;
  }
}

function requireSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error(
      "Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    error.status = 500;
    throw error;
  }
}

async function ensureSupabaseStorage() {
  requireSupabaseConfig();
  try {
    await supabaseRest("meo_app_meta?select=key&limit=1");
  } catch (error) {
    error.message = `${error.message} Run supabase/migrations/20260810000000_initial_phase1_schema.sql before starting with APP_STORAGE_DRIVER=supabase.`;
    throw error;
  }
}

async function supabaseRest(pathname, options = {}) {
  requireSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Supabase REST ${options.method || "GET"} ${pathname} failed: ${text}`);
    error.status = 500;
    throw error;
  }
  if (!text) return null;
  return JSON.parse(text);
}

async function supabaseStorage(pathname, options = {}) {
  requireSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/${pathname}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    },
    body: options.body
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Supabase Storage ${options.method || "GET"} ${pathname} failed: ${text}`);
    error.status = 500;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

function toRow(record, fields) {
  const row = {};
  for (const [appKey, column] of Object.entries(fields)) {
    row[column] = record[appKey] === undefined && appKey === "profile" ? {} : record[appKey] === undefined ? null : record[appKey];
  }
  return row;
}

function fromRow(row, fields) {
  const record = {};
  for (const [appKey, column] of Object.entries(fields)) {
    record[appKey] = row[column] === undefined ? null : row[column];
  }
  return record;
}

async function readSupabaseDb() {
  await ensureSupabaseStorage();
  const db = createEmptyDb();
  const metaRows = await supabaseRest("meo_app_meta?key=eq.state_meta&select=value&limit=1");
  if (metaRows?.[0]?.value) {
    db.meta = metaRows[0].value;
  }
  if (!db.meta.createdAt) db.meta.createdAt = now();

  for (const definition of TABLES) {
    const rows = await supabaseRest(`${definition.table}?select=*`);
    db[definition.key] = (rows || []).map((row) => fromRow(row, definition.fields));
  }

  return ensureShape(db);
}

async function writeSupabaseDb(db, previousDb = createEmptyDb()) {
  await ensureSupabaseStorage();

  for (const definition of [...TABLES].reverse()) {
    await deleteRemovedRows(definition, previousDb[definition.key] || [], db[definition.key] || []);
  }

  await supabaseRest("meo_app_meta?on_conflict=key", {
    method: "POST",
    body: [{ key: "state_meta", value: db.meta, updated_at: now() }],
    prefer: "resolution=merge-duplicates,return=minimal"
  });

  for (const definition of TABLES) {
    await upsertRows(definition, db[definition.key] || []);
  }
}

async function upsertRows(definition, records) {
  if (!records.length) return;
  const rows = records.map((record) => toRow(record, definition.fields));
  const conflictColumn = definition.fields[definition.idKey];
  await supabaseRest(`${definition.table}?on_conflict=${conflictColumn}`, {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

async function deleteRemovedRows(definition, previousRecords, currentRecords) {
  const idColumn = definition.fields[definition.idKey];
  const currentIds = new Set(currentRecords.map((record) => record[definition.idKey]));
  const removed = previousRecords.filter((record) => !currentIds.has(record[definition.idKey]));
  for (const record of removed) {
    await supabaseRest(`${definition.table}?${idColumn}=eq.${encodeURIComponent(record[definition.idKey])}`, {
      method: "DELETE",
      prefer: "return=minimal"
    });
  }
}

function nextId(db, key, prefix) {
  const current = db.meta.nextIds[key] || 1;
  db.meta.nextIds[key] = current + 1;
  return `${prefix}_${String(current).padStart(4, "0")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), actual);
}

function createSession(db, userId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.sessions.push({
    tokenHash: sha256(token),
    userId,
    createdAt: now(),
    expiresAt
  });
  return { token, expiresAt };
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function getRequestToken(req) {
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return parseCookies(req)[SESSION_COOKIE] || "";
}

function sessionCookie(session) {
  const maxAge = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function getAuthContext(db, req) {
  const token = getRequestToken(req);
  if (!token) return null;
  const tokenHash = sha256(token);
  const session = db.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  const user = db.users.find((item) => item.id === session.userId && item.active !== false);
  if (!user) return null;
  const company = db.companies.find((item) => item.id === user.companyId);
  if (!company) return null;
  return { tokenHash, session, user, company };
}

function requireAuth(db, req) {
  const auth = getAuthContext(db, req);
  if (!auth) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  return auth;
}

function requireManager(auth) {
  if (!isCompanyAdmin(auth.user)) {
    const error = new Error("Company or manager role required.");
    error.status = 403;
    throw error;
  }
}

function requireProjectViewer(auth) {
  if (!isProjectViewer(auth.user)) {
    const error = new Error("Client or developer role required.");
    error.status = 403;
    throw error;
  }
}

function requireWorker(auth) {
  if (auth.user.role !== "worker") {
    const error = new Error("Conta de trabalhador obrigatoria para candidatura.");
    error.status = 403;
    throw error;
  }
}

function requireCompanyAccount(auth) {
  if (!isCompanyAdmin(auth.user)) {
    const error = new Error("Company registration is required to create vacancies.");
    error.status = 403;
    throw error;
  }
}

function requireCronAuth(req) {
  if (!CRON_SECRET) {
    const error = new Error("CRON_SECRET is required for scheduled maintenance.");
    error.status = 500;
    throw error;
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    const error = new Error("Unauthorized scheduled maintenance request.");
    error.status = 401;
    throw error;
  }
}

function isCompanyAdmin(user) {
  return user?.role === "manager" || user?.role === "company";
}

function isOperationalUser(user) {
  return OPERATIONAL_ROLES.has(user?.role);
}

function isProjectViewer(user) {
  return PROJECT_VIEWER_ROLES.has(user?.role);
}

function existingWorkerCv(user) {
  const profile = user?.profile && typeof user.profile === "object" ? user.profile : {};
  const cv = profile.workerCv && typeof profile.workerCv === "object" ? profile.workerCv : {};
  return {
    published: cv.published === true,
    headline: cleanString(cv.headline || profile.headline, 160),
    location: cleanString(cv.location || profile.location, 160),
    birthDate: cleanDate(cv.birthDate),
    phone: cleanString(cv.phone, 80),
    availability: cleanString(cv.availability, 160),
    bio: cleanString(cv.bio || profile.bio, 1600),
    skills: cleanStringList(Array.isArray(cv.skills) ? cv.skills : profile.skills),
    experience: cleanWorkerExperience(cv.experience),
    references: cleanWorkerReferences(cv.references),
    profilePhoto: cv.profilePhoto && typeof cv.profilePhoto === "object" ? cv.profilePhoto : null,
    publishedAt: cv.publishedAt || null,
    updatedAt: cv.updatedAt || user?.createdAt || null
  };
}

function workerProfilePhotoUrl(user, cv = existingWorkerCv(user)) {
  return cv.profilePhoto?.storedName ? `/api/workers/${encodeURIComponent(user.id)}/profile-photo` : "";
}

function publicWorkerProfile(user, options = {}) {
  if (!user || user.role !== "worker") return null;
  const cv = existingWorkerCv(user);
  if (!options.includeUnpublished && !cv.published) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    published: cv.published,
    headline: cv.headline,
    location: cv.location,
    birthDate: cv.birthDate,
    phone: cv.phone,
    availability: cv.availability,
    bio: cv.bio,
    skills: cv.skills,
    experience: cv.experience,
    references: cv.references,
    profilePhotoUrl: workerProfilePhotoUrl(user, cv),
    publishedAt: cv.publishedAt,
    updatedAt: cv.updatedAt
  };
}

function publicProfileForUser(user) {
  const profile = user?.profile && typeof user.profile === "object" ? { ...user.profile } : {};
  if (user?.role === "worker") {
    profile.workerCv = publicWorkerProfile(user, { includeUnpublished: true });
  }
  return profile;
}

function isWorkerProfilePublished(user) {
  return publicWorkerProfile(user, { includeUnpublished: false }) !== null;
}

function validatePublishedWorkerProfile(profile) {
  const missing = [];
  if (!profile.headline) missing.push("titulo profissional");
  if (!profile.location) missing.push("localizacao");
  if (!profile.birthDate) missing.push("data de nascimento");
  if (!profile.skills.length) missing.push("competencias");
  if (!profile.experience.length) missing.push("experiencia anterior");
  if (!profile.references.length) missing.push("referencias");
  if (missing.length) {
    const error = new Error(`Complete o CV de trabalhador antes de publicar: ${missing.join(", ")}.`);
    error.status = 400;
    throw error;
  }
}

function buildWorkerProfileUpdate(user, body, photoRecord = null) {
  const current = existingWorkerCv(user);
  const published = body.published !== false;
  const next = {
    published,
    headline: cleanString(body.headline, 160),
    location: cleanString(body.location, 160),
    birthDate: cleanDate(body.birthDate),
    phone: cleanString(body.phone, 80),
    availability: cleanString(body.availability, 160),
    bio: cleanString(body.bio, 1600),
    skills: cleanStringList(body.skills),
    experience: cleanWorkerExperience(body.experience),
    references: cleanWorkerReferences(body.references),
    profilePhoto: photoRecord || current.profilePhoto || null,
    publishedAt: published ? current.publishedAt || now() : null,
    updatedAt: now()
  };
  if (published) validatePublishedWorkerProfile(next);
  return next;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    companyId: user.companyId,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active !== false,
    profile: publicProfileForUser(user),
    createdAt: user.createdAt,
    invitedBy: user.invitedBy || null
  };
}

function publicCompany(company) {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    location: company.location || "",
    website: company.website || "",
    sector: company.sector || "",
    description: company.description || "",
    createdAt: company.createdAt
  };
}

function publicWorkOrder(order) {
  return { ...order };
}

function publicTask(task) {
  return {
    ...task,
    validationDueAt: task.validationDueAt || null
  };
}

function publicEvidence(evidence) {
  const { storedName, ...safe } = evidence;
  return {
    ...safe,
    capturedAt: evidence.capturedAt || evidence.createdAt,
    uploadedAt: evidence.uploadedAt || evidence.createdAt,
    expiresAt: evidence.expiresAt || addDays(evidence.createdAt || now(), EVIDENCE_RETENTION_DAYS),
    metadata: evidence.metadata || {},
    authenticity: evidence.authenticity || legacyAuthenticity(evidence),
    fileUrl: `/api/evidence/${evidence.id}/file`,
    downloadUrl: `/api/evidence/${evidence.id}/download`
  };
}

function publicInvite(invite) {
  return {
    id: invite.id,
    companyId: invite.companyId,
    role: invite.role,
    email: invite.email,
    name: invite.name,
    createdBy: invite.createdBy,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    usedAt: invite.usedAt || null
  };
}

function publicJobOffer(job) {
  return { ...job };
}

function publicJobApplication(application, db = null, options = {}) {
  const payload = { ...application };
  if (options.includeWorkerProfile && db) {
    const worker = db.users.find((user) => user.id === application.workerId);
    payload.workerProfile = publicWorkerProfile(worker, { includeUnpublished: false });
  }
  return payload;
}

function audit(db, auth, entityType, entityId, action, detail = {}, req) {
  const entry = {
    id: nextId(db, "auditLogs", "log"),
    companyId: auth.company.id,
    actorId: auth.user.id,
    actorName: auth.user.name,
    actorRole: auth.user.role,
    entityType,
    entityId,
    action,
    detail,
    ip: req?.socket?.remoteAddress || null,
    createdAt: now()
  };
  db.auditLogs.unshift(entry);
  return entry;
}

function auditSystem(db, companyId, entityType, entityId, action, detail = {}, req) {
  const entry = {
    id: nextId(db, "auditLogs", "log"),
    companyId,
    actorId: null,
    actorName: "Sistema",
    actorRole: "system",
    entityType,
    entityId,
    action,
    detail,
    ip: req?.socket?.remoteAddress || null,
    createdAt: now()
  };
  db.auditLogs.unshift(entry);
  return entry;
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
}

function sendRedirect(res, location, headers = {}) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end();
}

function sendError(res, error) {
  const status = error.status || 500;
  const message = status >= 500 ? "Internal server error." : error.message;
  if (status >= 500) {
    console.error(error);
  }
  sendJson(res, status, { error: message, details: error.details || null });
}

function readBody(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("Request body too large.");
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const error = new Error("Invalid JSON body.");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function validatePassword(password) {
  if (String(password || "").length < 8) {
    const error = new Error("Password must have at least 8 characters.");
    error.status = 400;
    throw error;
  }
}

function validateRole(role) {
  if (!ROLES.has(role)) {
    const error = new Error("Invalid role.");
    error.status = 400;
    throw error;
  }
}

function validateManagedRole(role) {
  validateRole(role);
  if (!MANAGED_ROLES.has(role)) {
    const error = new Error("Managed users must be manager, employee, contractor, client, or developer.");
    error.status = 400;
    throw error;
  }
}

function assertSameCompany(auth, record) {
  if (!record || record.companyId !== auth.company.id) {
    const error = new Error("Record not found.");
    error.status = 404;
    throw error;
  }
}

function canAccessTask(auth, task) {
  if (!task || task.companyId !== auth.company.id) return false;
  if (isCompanyAdmin(auth.user)) return true;
  if (!isOperationalUser(auth.user)) return false;
  return task.assigneeId === auth.user.id;
}

function canAccessWorkOrder(auth, db, order) {
  if (!order || order.companyId !== auth.company.id) return false;
  if (isCompanyAdmin(auth.user)) return true;
  if (!isOperationalUser(auth.user)) return false;
  return db.tasks.some((task) => task.workOrderId === order.id && task.assigneeId === auth.user.id);
}

function validationAlertStatus(task, reference = Date.now()) {
  if (task.status !== "pending_validation" || !task.validationDueAt) return null;
  const remainingHours = hoursUntil(task.validationDueAt, reference);
  if (remainingHours === null) return null;
  if (remainingHours <= 0) return "overdue";
  if (remainingHours <= VALIDATION_REMINDER_HOURS_BEFORE) return "due_soon";
  return "pending";
}

function lastValidationReminder(db, taskId) {
  return db.auditLogs.find(
    (entry) => entry.entityType === "task" && entry.entityId === taskId && entry.action === "task.validation_reminder"
  );
}

function buildValidationAlerts(db, companyId, reference = Date.now()) {
  return db.tasks
    .filter((task) => task.companyId === companyId && task.status === "pending_validation")
    .map((task) => {
      const remainingHours = hoursUntil(task.validationDueAt, reference);
      const reminder = lastValidationReminder(db, task.id);
      return {
        taskId: task.id,
        title: task.title,
        assigneeName: task.assigneeName,
        validationDueAt: task.validationDueAt,
        completedAt: task.completedAt || null,
        hoursRemaining: remainingHours === null ? null : Number(remainingHours.toFixed(2)),
        status: validationAlertStatus(task, reference) || "pending",
        lastReminderAt: reminder?.createdAt || null
      };
    })
    .sort((a, b) => String(a.validationDueAt).localeCompare(String(b.validationDueAt)));
}

function buildBootstrap(db, auth) {
  const isManager = isCompanyAdmin(auth.user);
  const companyUsers = db.users
    .filter((user) => user.companyId === auth.company.id)
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tasks = db.tasks.filter((task) => canAccessTask(auth, task));
  const taskIds = new Set(tasks.map((task) => task.id));
  const workOrderIds = new Set(tasks.map((task) => task.workOrderId));

  let workOrders;
  if (isManager) {
    workOrders = db.workOrders.filter((order) => order.companyId === auth.company.id);
  } else {
    workOrders = db.workOrders.filter((order) => workOrderIds.has(order.id));
  }

  const visibleOrderIds = new Set(workOrders.map((order) => order.id));
  const evidences = db.evidences.filter((evidence) => {
    if (evidence.companyId !== auth.company.id) return false;
    if (evidence.taskId && taskIds.has(evidence.taskId)) return true;
    return !evidence.taskId && visibleOrderIds.has(evidence.workOrderId);
  });

  const logs = db.auditLogs.filter((entry) => {
    if (entry.companyId !== auth.company.id) return false;
    if (isManager) return true;
    if (entry.entityType === "task" && taskIds.has(entry.entityId)) return true;
    if (entry.entityType === "evidence") {
      const evidence = db.evidences.find((item) => item.id === entry.entityId);
      return evidence && evidence.taskId && taskIds.has(evidence.taskId);
    }
    return false;
  });

  const invites = isManager
    ? db.invites
        .filter((invite) => invite.companyId === auth.company.id)
        .map(publicInvite)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const jobOffers = isManager
    ? db.jobOffers.filter((job) => job.companyId === auth.company.id)
    : db.jobOffers.filter((job) => job.status === "open");

  const jobApplications = isManager
    ? db.jobApplications.filter((application) => application.companyId === auth.company.id)
    : auth.user.role === "worker"
      ? db.jobApplications.filter((application) => application.workerId === auth.user.id)
      : [];
  const workerProfiles = isManager
    ? db.users
        .filter((user) => user.role === "worker")
        .map((user) => publicWorkerProfile(user, { includeUnpublished: false }))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
    : auth.user.role === "worker"
      ? [publicWorkerProfile(auth.user, { includeUnpublished: true })].filter(Boolean)
      : [];

  return {
    user: publicUser(auth.user),
    company: publicCompany(auth.company),
    users: isManager ? companyUsers : companyUsers.filter((user) => user.id === auth.user.id),
    workOrders: workOrders.map(publicWorkOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: tasks.map(publicTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    evidences: evidences.map(publicEvidence).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditLogs: logs.slice(0, 250),
    invites,
    validationAlerts: isManager ? buildValidationAlerts(db, auth.company.id) : [],
    jobOffers: jobOffers.map(publicJobOffer).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    jobApplications: jobApplications
      .map((application) => publicJobApplication(application, db, { includeWorkerProfile: isManager }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    workerProfiles,
    statusLabels: PUBLIC_STATUS_LABELS
  };
}

function buildPrivateMvpData(db, auth) {
  const companyId = auth.company.id;
  return {
    user: publicUser(auth.user),
    company: publicCompany(auth.company),
    users: db.users
      .filter((user) => user.companyId === companyId)
      .map(publicUser)
      .sort((a, b) => a.name.localeCompare(b.name)),
    workOrders: db.workOrders
      .filter((order) => order.companyId === companyId)
      .map(publicWorkOrder)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: db.tasks
      .filter((task) => task.companyId === companyId)
      .map(publicTask)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    evidences: db.evidences
      .filter((evidence) => evidence.companyId === companyId)
      .map(publicEvidence)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditLogs: db.auditLogs.filter((entry) => entry.companyId === companyId).slice(0, 250),
    invites: [],
    jobOffers: db.jobOffers
      .filter((job) => job.companyId === companyId)
      .map(publicJobOffer)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    jobApplications: db.jobApplications
      .filter((application) => application.companyId === companyId)
      .map((application) => publicJobApplication(application, db, { includeWorkerProfile: true }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    workerProfiles: db.users
      .filter((user) => user.role === "worker")
      .map((user) => publicWorkerProfile(user, { includeUnpublished: false }))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name)),
    statusLabels: PUBLIC_STATUS_LABELS
  };
}

function parsePhotoDataUrl(photo) {
  const dataUrl = String(photo?.dataUrl || "");
  const name = cleanString(photo?.name || "photo", 160);
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) {
    const error = new Error("Photo must be a PNG, JPEG, or WEBP data URL.");
    error.status = 400;
    throw error;
  }
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
    const error = new Error(`Photo exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`);
    error.status = 400;
    throw error;
  }
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return { buffer, mimeType, ext, name };
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") {
    return { status: "not_requested" };
  }
  const status = cleanString(location.status || "not_requested", 40);
  if (status === "granted") {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    const accuracy = Number(location.accuracy || 0);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return { status: "unavailable" };
    }
    const capturedAt = normalizeTimestamp(location.capturedAt || location.timestamp);
    return {
      status,
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      capturedAt: capturedAt.value
    };
  }
  if (["denied", "unavailable", "not_requested"].includes(status)) {
    return { status };
  }
  return { status: "unavailable" };
}

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return { value: new Date(value).toISOString(), source: "client_epoch_ms" };
  }
  const parsed = new Date(String(value || ""));
  if (Number.isFinite(parsed.getTime())) {
    return { value: parsed.toISOString(), source: "client_iso" };
  }
  return { value: null, source: "missing" };
}

function photoCaptureTimestamp(photo, uploadTime) {
  const fromLastModified = normalizeTimestamp(photo?.lastModified);
  if (fromLastModified.value) {
    return { value: fromLastModified.value, source: "browser_file_last_modified" };
  }
  const fromClient = normalizeTimestamp(photo?.capturedAt || photo?.lastModifiedDate);
  if (fromClient.value) {
    return { value: fromClient.value, source: fromClient.source };
  }
  return { value: uploadTime, source: "server_upload_time" };
}

function buildEvidenceAuthenticity(evidence, options = {}) {
  const requiresGps = options.requireGps === true;
  const checks = {
    privateStorage: true,
    acceptedMimeType: ["image/png", "image/jpeg", "image/webp"].includes(evidence.mimeType),
    serverFileHash: Boolean(evidence.fileHash),
    serverUploadTime: Boolean(evidence.uploadedAt),
    evidenceTime: Boolean(evidence.capturedAt || evidence.uploadedAt),
    gpsLocation: !requiresGps || evidence.location?.status === "granted"
  };
  const warnings = [];
  if (requiresGps && evidence.location?.status !== "granted") warnings.push("missing_required_gps");
  if (!evidence.metadata?.clientFileLastModified) warnings.push("client_capture_time_not_supplied");
  return {
    status: Object.values(checks).every(Boolean) ? "accepted" : "incomplete",
    hashAlgorithm: "sha256",
    checks,
    warnings,
    verifiedAt: evidence.uploadedAt
  };
}

function legacyAuthenticity(evidence) {
  return buildEvidenceAuthenticity({
    ...evidence,
    uploadedAt: evidence.uploadedAt || evidence.createdAt,
    capturedAt: evidence.capturedAt || evidence.createdAt,
    fileHash: evidence.fileHash || "",
    metadata: evidence.metadata || {}
  }, { requireGps: false });
}

function isEvidenceExpired(evidence, reference = Date.now()) {
  return isPast(evidence.expiresAt || addDays(evidence.createdAt || now(), EVIDENCE_RETENTION_DAYS), reference);
}

function isEvidenceAccepted(evidence) {
  return (evidence.authenticity || legacyAuthenticity(evidence)).status === "accepted";
}

function qualifyingTaskEvidence(db, task) {
  return db.evidences.filter(
    (evidence) =>
      evidence.taskId === task.id &&
      evidence.kind === "task_evidence" &&
      !isEvidenceExpired(evidence) &&
      evidence.location?.status === "granted" &&
      isEvidenceAccepted(evidence)
  );
}

async function storePhoto(db, auth, body, options) {
  const parsed = parsePhotoDataUrl(body.photo);
  const uploadedAt = now();
  const location = normalizeLocation(body.location);
  if (options.requireGps && location.status !== "granted") {
    const error = new Error("GPS location is required for final task evidence.");
    error.status = 400;
    throw error;
  }
  const capturedAt = photoCaptureTimestamp(body.photo, uploadedAt);
  const fileHash = crypto.createHash("sha256").update(parsed.buffer).digest("hex");
  const evidence = {
    id: nextId(db, "evidences", "ev"),
    companyId: auth.company.id,
    taskId: options.taskId || null,
    workOrderId: options.workOrderId || null,
    userId: auth.user.id,
    userName: auth.user.name,
    kind: options.kind,
    originalName: parsed.name,
    mimeType: parsed.mimeType,
    storedName: "",
    note: cleanString(body.note, 1000),
    location,
    capturedAt: capturedAt.value,
    uploadedAt,
    expiresAt: addDays(uploadedAt, EVIDENCE_RETENTION_DAYS),
    fileHash,
    metadata: {
      source: "webapp",
      originalName: parsed.name,
      mimeType: parsed.mimeType,
      byteSize: parsed.buffer.length,
      clientDeclaredType: cleanString(body.photo?.type, 120),
      clientFileLastModified: capturedAt.source === "browser_file_last_modified" ? capturedAt.value : null,
      captureTimeSource: capturedAt.source,
      requestIp: options.req?.socket?.remoteAddress || null,
      retentionDays: EVIDENCE_RETENTION_DAYS
    },
    authenticity: null,
    createdAt: uploadedAt
  };
  evidence.authenticity = buildEvidenceAuthenticity(evidence, {
    requireGps: options.requireGps === true
  });
  evidence.storedName = `${evidence.companyId}/${evidence.id}.${parsed.ext}`;
  await saveEvidenceFile(evidence, parsed.buffer);
  db.evidences.push(evidence);
  return evidence;
}

async function storeWorkerProfilePhoto(user, photo) {
  if (!photo?.dataUrl) return null;
  const parsed = parsePhotoDataUrl(photo);
  const uploadedAt = now();
  const fileHash = crypto.createHash("sha256").update(parsed.buffer).digest("hex");
  const storedName = `worker-profiles/${user.id}/${Date.now()}-${fileHash.slice(0, 12)}.${parsed.ext}`;
  await savePrivateUploadFile(storedName, parsed.mimeType, parsed.buffer);
  return {
    originalName: parsed.name,
    mimeType: parsed.mimeType,
    storedName,
    fileHash,
    byteSize: parsed.buffer.length,
    uploadedAt
  };
}

async function saveEvidenceFile(evidence, buffer) {
  return savePrivateUploadFile(evidence.storedName, evidence.mimeType, buffer);
}

async function readEvidenceFile(evidence) {
  return readPrivateUploadFile(evidence.storedName);
}

async function deleteEvidenceFile(evidence) {
  return deletePrivateUploadFile(evidence.storedName);
}

async function savePrivateUploadFile(storedName, mimeType, buffer) {
  if (APP_STORAGE_DRIVER === "supabase") {
    const objectPath = encodeObjectPath(storedName);
    await supabaseStorage(`object/${encodeURIComponent(SUPABASE_EVIDENCE_BUCKET)}/${objectPath}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "cache-control": "3600",
        "x-upsert": "true"
      },
      body: buffer
    });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, buffer);
}

async function readPrivateUploadFile(storedName) {
  if (APP_STORAGE_DRIVER === "supabase") {
    const objectPath = encodeObjectPath(storedName);
    return supabaseStorage(`object/authenticated/${encodeURIComponent(SUPABASE_EVIDENCE_BUCKET)}/${objectPath}`);
  }
  return fsp.readFile(path.join(UPLOAD_DIR, storedName));
}

async function deletePrivateUploadFile(storedName) {
  if (APP_STORAGE_DRIVER === "supabase") {
    const objectPath = encodeObjectPath(storedName);
    await supabaseStorage(`object/${encodeURIComponent(SUPABASE_EVIDENCE_BUCKET)}/${objectPath}`, {
      method: "DELETE"
    });
    return;
  }
  await fsp.rm(path.join(UPLOAD_DIR, storedName), { force: true });
}

function encodeObjectPath(storedName) {
  return String(storedName)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function svgEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeFileName(value) {
  return cleanString(value || "evidence", 80).replace(/[^a-z0-9._-]+/gi, "-") || "evidence";
}

function buildEvidenceDownloadMetadata(evidence, task, order) {
  return {
    format: "luistrata-evidence-download-v1",
    generatedAt: now(),
    evidence: {
      id: evidence.id,
      kind: evidence.kind,
      companyId: evidence.companyId,
      taskId: evidence.taskId || null,
      workOrderId: evidence.workOrderId || null,
      userId: evidence.userId,
      userName: evidence.userName,
      originalName: evidence.originalName,
      mimeType: evidence.mimeType,
      capturedAt: evidence.capturedAt || evidence.createdAt,
      uploadedAt: evidence.uploadedAt || evidence.createdAt,
      expiresAt: evidence.expiresAt || null,
      fileHash: evidence.fileHash || "",
      hashAlgorithm: "sha256",
      note: evidence.note || "",
      location: evidence.location || { status: "not_requested" },
      metadata: evidence.metadata || {},
      authenticity: evidence.authenticity || legacyAuthenticity(evidence)
    },
    task: task
      ? {
          id: task.id,
          title: task.title,
          assigneeId: task.assigneeId,
          assigneeName: task.assigneeName,
          status: task.status,
          completedAt: task.completedAt || null,
          validationDueAt: task.validationDueAt || null,
          approvedAt: task.approvedAt || null,
          rejectedAt: task.rejectedAt || null
        }
      : null,
    workOrder: order
      ? {
          id: order.id,
          title: order.title,
          address: order.address,
          createdAt: order.createdAt
        }
      : null
  };
}

function buildWatermarkedEvidenceSvg(evidence, task, order, buffer) {
  const location = evidence.location?.status === "granted"
    ? `${Number(evidence.location.latitude).toFixed(6)}, ${Number(evidence.location.longitude).toFixed(6)}`
    : "GPS indisponivel";
  const metadataJson = JSON.stringify(buildEvidenceDownloadMetadata(evidence, task, order), null, 2);
  const lines = [
    "LuisTrata evidence",
    `Evidence: ${evidence.id}`,
    `Task: ${task?.title || "work order evidence"}`,
    `Order: ${order?.title || evidence.workOrderId || ""}`,
    `User: ${evidence.userName}`,
    `Captured: ${evidence.capturedAt || evidence.createdAt}`,
    `Uploaded: ${evidence.uploadedAt || evidence.createdAt}`,
    `GPS: ${location}`,
    `Hash: ${String(evidence.fileHash || "").slice(0, 24)}`
  ].filter(Boolean);
  const text = lines
    .map((line, index) => `<text x="28" y="${40 + index * 24}">${svgEscape(line)}</text>`)
    .join("");
  const encoded = buffer.toString("base64");
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <metadata id="luistrata-evidence-metadata" data-format="application/json">${svgEscape(metadataJson)}</metadata>
  <desc>${svgEscape(`LuisTrata evidence ${evidence.id}. Full metadata is embedded in the luistrata-evidence-metadata node.`)}</desc>
  <rect width="1600" height="1200" fill="#111827"/>
  <image href="data:${svgEscape(evidence.mimeType)};base64,${encoded}" x="0" y="0" width="1600" height="1200" preserveAspectRatio="xMidYMid meet"/>
  <rect x="0" y="0" width="1600" height="260" fill="rgba(17,24,39,0.78)"/>
  <g fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${text}</g>
  <text x="800" y="620" fill="rgba(255,255,255,0.22)" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="900" text-anchor="middle" transform="rotate(-28 800 620)">LUISTRATA VERIFIED</text>
</svg>`.trim());
}

async function purgeExpiredEvidence(db, req) {
  const expired = db.evidences.filter((evidence) => isEvidenceExpired(evidence));
  for (const evidence of expired) {
    await deleteEvidenceFile(evidence);
    auditSystem(db, evidence.companyId, "evidence", evidence.id, "evidence.retention_deleted", {
      expiresAt: evidence.expiresAt || null,
      taskId: evidence.taskId || null,
      workOrderId: evidence.workOrderId || null
    }, req);
  }
  if (expired.length) {
    const expiredIds = new Set(expired.map((evidence) => evidence.id));
    db.evidences = db.evidences.filter((evidence) => !expiredIds.has(evidence.id));
  }
  return expired.length;
}

function applyValidationDeadlines(db, req) {
  const timestamp = Date.now();
  let approved = 0;
  for (const task of db.tasks) {
    if (task.status !== "pending_validation" || !task.validationDueAt || !isPast(task.validationDueAt, timestamp)) {
      continue;
    }
    task.status = "approved";
    task.updatedAt = now();
    task.approvedAt = task.updatedAt;
    task.validationComment = "Auto-approved after the 12-hour employer validation window.";
    auditSystem(db, task.companyId, "task", task.id, "task.auto_approved", {
      validationDueAt: task.validationDueAt
    }, req);
    approved += 1;
  }
  return approved;
}

function hasValidationReminder(db, taskId, reminderType) {
  return db.auditLogs.some(
    (entry) =>
      entry.entityType === "task" &&
      entry.entityId === taskId &&
      entry.action === "task.validation_reminder" &&
      entry.detail?.reminderType === reminderType
  );
}

function validationReminderTypes(task, reference = Date.now()) {
  if (task.status !== "pending_validation" || !task.validationDueAt) return [];
  const remainingHours = hoursUntil(task.validationDueAt, reference);
  if (remainingHours === null || remainingHours <= 0) return [];
  const types = ["submitted"];
  if (remainingHours <= VALIDATION_REMINDER_HOURS_BEFORE) {
    types.push("due_soon");
  }
  return types;
}

function createValidationReminders(db, req) {
  const timestamp = Date.now();
  let created = 0;
  for (const task of db.tasks) {
    for (const reminderType of validationReminderTypes(task, timestamp)) {
      if (hasValidationReminder(db, task.id, reminderType)) continue;
      const remainingHours = hoursUntil(task.validationDueAt, timestamp);
      auditSystem(db, task.companyId, "task", task.id, "task.validation_reminder", {
        reminderType,
        validationDueAt: task.validationDueAt,
        hoursRemaining: remainingHours === null ? null : Number(remainingHours.toFixed(2)),
        assigneeId: task.assigneeId,
        assigneeName: task.assigneeName
      }, req);
      created += 1;
    }
  }
  return created;
}

async function maintainOperationalEvidence(db, req) {
  const expiredEvidenceDeleted = await purgeExpiredEvidence(db, req);
  const tasksAutoApproved = applyValidationDeadlines(db, req);
  const validationRemindersCreated = createValidationReminders(db, req);
  return {
    expiredEvidenceDeleted,
    tasksAutoApproved,
    validationRemindersCreated
  };
}

function needsOperationalMaintenance(db) {
  return (
    db.evidences.some((evidence) => isEvidenceExpired(evidence)) ||
    db.tasks.some((task) => task.status === "pending_validation" && task.validationDueAt && isPast(task.validationDueAt)) ||
    db.tasks.some((task) =>
      validationReminderTypes(task).some((reminderType) => !hasValidationReminder(db, task.id, reminderType))
    )
  );
}

async function withMaintainedAuth(req, build) {
  const db = await readDb();
  const auth = requireAuth(db, req);
  if (!needsOperationalMaintenance(db)) {
    return build(db, auth);
  }
  return mutateDb(async (currentDb) => {
    const currentAuth = requireAuth(currentDb, req);
    await maintainOperationalEvidence(currentDb, req);
    return build(currentDb, currentAuth);
  });
}

function ensureWorkerPoolCompany(db) {
  let company = db.companies.find((item) => item.id === "co_workers");
  if (!company) {
    company = {
      id: "co_workers",
      name: "Trabalhadores independentes",
      location: "",
      website: "",
      sector: "Mercado de trabalho",
      description: "Conta logica para perfis individuais de trabalhadores.",
      createdAt: now()
    };
    db.companies.push(company);
  }
  return company;
}

async function exchangeGoogleCode(req, code) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(req),
      grant_type: "authorization_code"
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const error = new Error("Google token exchange failed.");
    error.status = 502;
    error.details = payload;
    throw error;
  }
  return payload;
}

async function fetchGoogleUser(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.sub) {
    const error = new Error("Google profile lookup failed.");
    error.status = 502;
    error.details = payload;
    throw error;
  }
  return payload;
}

function attachGoogleIdentity(user, googleUser) {
  const profile = { ...(user.profile || {}) };
  const authProviders = { ...(profile.authProviders || {}) };
  authProviders.google = {
    sub: cleanString(googleUser.sub, 255),
    emailVerified: googleUser.email_verified === true,
    picture: cleanString(googleUser.picture, 500),
    linkedAt: authProviders.google?.linkedAt || now(),
    lastLoginAt: now()
  };
  user.profile = {
    ...profile,
    avatarUrl: profile.avatarUrl || cleanString(googleUser.picture, 500),
    authProviders
  };
}

function completeGoogleAuth(db, googleUser, intent, req) {
  const email = normalizeEmail(googleUser.email);
  if (!email || googleUser.email_verified !== true) {
    const error = new Error("Google account must have a verified email.");
    error.status = 403;
    throw error;
  }

  let user = db.users.find((item) => item.email === email);
  if (user && user.active === false) {
    const error = new Error("This account is inactive.");
    error.status = 403;
    throw error;
  }

  let company;
  let action = "auth.google_login";
  if (!user) {
    if (intent !== "worker") {
      const error = new Error("No account exists for this Google email.");
      error.status = 404;
      throw error;
    }
    company = ensureWorkerPoolCompany(db);
    user = {
      id: nextId(db, "users", "usr"),
      companyId: company.id,
      name: cleanString(googleUser.name || email, 120),
      email,
      role: "worker",
      passwordHash: hashPassword(randomToken(48)),
      active: true,
      profile: {
        workerCv: {
          published: false,
          headline: "",
          location: "",
          birthDate: "",
          phone: "",
          availability: "",
          bio: "",
          skills: [],
          experience: [],
          references: [],
          profilePhoto: null,
          publishedAt: null,
          updatedAt: now()
        }
      },
      createdAt: now()
    };
    db.users.push(user);
    action = "worker.google_registered";
  } else {
    company = db.companies.find((item) => item.id === user.companyId);
    if (!company) {
      const error = new Error("Account company was not found.");
      error.status = 403;
      throw error;
    }
    const linkedSub = user.profile?.authProviders?.google?.sub;
    if (linkedSub && linkedSub !== googleUser.sub) {
      const error = new Error("This app account is linked to a different Google account.");
      error.status = 403;
      throw error;
    }
  }

  attachGoogleIdentity(user, googleUser);
  const auth = { user, company };
  audit(db, auth, "session", user.id, action, { provider: "google" }, req);
  const session = createSession(db, user.id);
  return { session, bootstrap: buildBootstrap(db, { ...auth, session }) };
}

function publicJobsPayload(db) {
  return {
    jobs: db.jobOffers
      .filter((job) => job.status === "open")
      .map(publicJobOffer)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  };
}

function publicJobsSetupFallback(error) {
  console.error(`Public jobs unavailable: ${error.message}`);
  return {
    jobs: [],
    warning:
      "Database setup is incomplete. Run the Supabase reset/current schema SQL and verify the server environment variables."
  };
}

function createMarketplaceSessionResponse(db, user, company) {
  const session = createSession(db, user.id);
  return {
    session,
    bootstrap: buildBootstrap(db, { user, company, session })
  };
}

function routeNotFound() {
  const error = new Error("Route not found.");
  error.status = 404;
  throw error;
}

async function handleApi(req, res, pathname) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "motor-evidencia-operacional",
      storageDriver: APP_STORAGE_DRIVER,
      time: now()
    });
    return;
  }

  if ((req.method === "GET" || req.method === "POST") && pathname === "/api/cron/operational-maintenance") {
    requireCronAuth(req);
    const result = await mutateDb(async (db) => maintainOperationalEvidence(db, req));
    sendJson(res, 200, {
      ok: true,
      ranAt: now(),
      ...result
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/google/start") {
    const next = safeReturnPath(url.searchParams.get("next") || "/");
    const intent = url.searchParams.get("intent") === "worker" ? "worker" : "login";
    if (!googleAuthConfigured()) {
      sendRedirect(res, addQueryParam(next, "auth_error", "google_not_configured"));
      return;
    }
    const state = signGoogleState({
      createdAt: Date.now(),
      nonce: randomToken(16),
      next,
      intent
    });
    const googleUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    googleUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    googleUrl.searchParams.set("redirect_uri", googleRedirectUri(req));
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", "openid profile email");
    googleUrl.searchParams.set("state", state);
    googleUrl.searchParams.set("prompt", "select_account");
    sendRedirect(res, googleUrl.toString());
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/google/callback") {
    let next = "/";
    try {
      if (!googleAuthConfigured()) {
        sendRedirect(res, addQueryParam(next, "auth_error", "google_not_configured"));
        return;
      }
      const googleError = url.searchParams.get("error");
      if (googleError) {
        sendRedirect(res, addQueryParam(next, "auth_error", "google_cancelled"));
        return;
      }
      const statePayload = verifyGoogleState(url.searchParams.get("state"));
      next = statePayload.next;
      const code = url.searchParams.get("code");
      if (!code) {
        sendRedirect(res, addQueryParam(next, "auth_error", "google_missing_code"));
        return;
      }
      const tokens = await exchangeGoogleCode(req, code);
      const googleUser = await fetchGoogleUser(tokens.access_token);
      const result = await mutateDb((db) => completeGoogleAuth(db, googleUser, statePayload.intent, req));
      sendRedirect(res, addQueryParam(next, "auth", "google"), { "Set-Cookie": sessionCookie(result.session) });
    } catch (error) {
      if (error.status >= 500) console.error(error);
      const code = error.status === 404
        ? "google_account_not_registered"
        : error.status === 403
          ? "google_forbidden"
          : "google_failed";
      sendRedirect(res, addQueryParam(next, "auth_error", code));
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/setup/status") {
    const db = await readDb();
    sendJson(res, 200, { initialized: db.users.some((user) => user.active !== false) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/jobs/public") {
    try {
      const db = await readDb();
      sendJson(res, 200, publicJobsPayload(db));
    } catch (error) {
      if (APP_STORAGE_DRIVER === "supabase") {
        sendJson(res, 200, publicJobsSetupFallback(error));
      } else {
        throw error;
      }
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/project/private") {
    const payload = await withMaintainedAuth(req, (db, auth) => {
      requireProjectViewer(auth);
      return { html: renderPrivateProjectHtml() };
    });
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "GET" && pathname === "/api/mvp/private") {
    const payload = await withMaintainedAuth(req, (db, auth) => {
      requireProjectViewer(auth);
      return { html: renderPrivateMvpHtml(buildPrivateMvpData(db, auth)) };
    });
    sendJson(res, 200, payload);
    return;
  }

  if (req.method === "POST" && pathname === "/api/register/worker") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const name = cleanString(body.name, 120);
      const email = normalizeEmail(body.email);
      validatePassword(body.password);
      if (!name || !email) {
        const error = new Error("Name, email, and password are required.");
        error.status = 400;
        throw error;
      }
      if (db.users.some((user) => user.email === email)) {
        const error = new Error("A user with this email already exists.");
        error.status = 409;
        throw error;
      }
      const company = ensureWorkerPoolCompany(db);
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: company.id,
        name,
        email,
        role: "worker",
        passwordHash: hashPassword(body.password),
        active: true,
        profile: {
          workerCv: {
            published: false,
            headline: cleanString(body.headline, 160),
            location: cleanString(body.location, 160),
            birthDate: "",
            phone: "",
            availability: "",
            bio: cleanString(body.bio, 1600),
            skills: cleanStringList(body.skills),
            experience: [],
            references: [],
            profilePhoto: null,
            publishedAt: null,
            updatedAt: now()
          }
        },
        createdAt: now()
      };
      db.users.push(user);
      const auth = { user, company };
      audit(db, auth, "user", user.id, "worker.registered", {}, req);
      return createMarketplaceSessionResponse(db, user, company);
    });
    sendJson(res, 201, result, { "Set-Cookie": sessionCookie(result.session) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/register/company") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const companyName = cleanString(body.companyName, 180);
      const name = cleanString(body.name, 120);
      const email = normalizeEmail(body.email);
      validatePassword(body.password);
      if (!companyName || !name || !email) {
        const error = new Error("Company, name, email, and password are required.");
        error.status = 400;
        throw error;
      }
      if (db.users.some((user) => user.email === email)) {
        const error = new Error("A user with this email already exists.");
        error.status = 409;
        throw error;
      }
      const company = {
        id: nextId(db, "companies", "co"),
        name: companyName,
        location: cleanString(body.location, 160),
        website: cleanString(body.website, 240),
        sector: cleanString(body.sector, 160),
        description: cleanString(body.description, 1200),
        createdAt: now()
      };
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: company.id,
        name,
        email,
        role: "company",
        passwordHash: hashPassword(body.password),
        active: true,
        profile: {},
        createdAt: now()
      };
      db.companies.push(company);
      db.users.push(user);
      const auth = { user, company };
      audit(db, auth, "company", company.id, "company.registered", { companyName }, req);
      return createMarketplaceSessionResponse(db, user, company);
    });
    sendJson(res, 201, result, { "Set-Cookie": sessionCookie(result.session) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/setup") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      if (db.users.some((user) => user.active !== false)) {
        const error = new Error("Setup is already complete.");
        error.status = 409;
        throw error;
      }
      const companyName = cleanString(body.companyName, 180);
      const name = cleanString(body.name, 120);
      const email = normalizeEmail(body.email);
      validatePassword(body.password);
      if (!companyName || !name || !email) {
        const error = new Error("Company, name, email, and password are required.");
        error.status = 400;
        throw error;
      }
      const company = {
        id: nextId(db, "companies", "co"),
        name: companyName,
        createdAt: now()
      };
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: company.id,
        name,
        email,
        role: "manager",
        passwordHash: hashPassword(body.password),
        active: true,
        createdAt: now()
      };
      db.companies.push(company);
      db.users.push(user);
      const auth = { user, company };
      audit(db, auth, "company", company.id, "setup.completed", { companyName }, req);
      const session = createSession(db, user.id);
      return { session, bootstrap: buildBootstrap(db, { ...auth, session }) };
    });
    sendJson(res, 201, result, { "Set-Cookie": sessionCookie(result.session) });
    return;
  }

  const inviteMatch = pathname.match(/^\/api\/invites\/([^/]+)$/);
  const inviteAcceptMatch = pathname.match(/^\/api\/invites\/([^/]+)\/accept$/);

  if (req.method === "GET" && inviteMatch) {
    const token = decodeURIComponent(inviteMatch[1]);
    const db = await readDb();
    const invite = db.invites.find(
      (item) =>
        item.tokenHash === sha256(token) &&
        !item.usedAt &&
        new Date(item.expiresAt).getTime() > Date.now()
    );
    if (!invite) {
      const error = new Error("Invite is invalid or expired.");
      error.status = 404;
      throw error;
    }
    const company = db.companies.find((item) => item.id === invite.companyId);
    sendJson(res, 200, { invite: publicInvite(invite), company: publicCompany(company) });
    return;
  }

  if (req.method === "POST" && inviteAcceptMatch) {
    const token = decodeURIComponent(inviteAcceptMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const invite = db.invites.find(
        (item) =>
          item.tokenHash === sha256(token) &&
          !item.usedAt &&
          new Date(item.expiresAt).getTime() > Date.now()
      );
      if (!invite) {
        const error = new Error("Invite is invalid or expired.");
        error.status = 404;
        throw error;
      }
      const company = db.companies.find((item) => item.id === invite.companyId);
      const name = cleanString(body.name || invite.name, 120);
      const email = normalizeEmail(body.email || invite.email);
      validatePassword(body.password);
      if (!name || !email) {
        const error = new Error("Name, email, and password are required.");
        error.status = 400;
        throw error;
      }
      if (db.users.some((user) => user.email === email)) {
        const error = new Error("A user with this email already exists.");
        error.status = 409;
        throw error;
      }
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: invite.companyId,
        name,
        email,
        role: invite.role,
        passwordHash: hashPassword(body.password),
        active: true,
        invitedBy: invite.createdBy,
        createdAt: now()
      };
      db.users.push(user);
      invite.usedAt = now();
      const auth = { user, company };
      audit(db, auth, "user", user.id, "invite.accepted", { role: invite.role }, req);
      const session = createSession(db, user.id);
      return { session, bootstrap: buildBootstrap(db, { ...auth, session }) };
    });
    sendJson(res, 201, result, { "Set-Cookie": sessionCookie(result.session) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const email = normalizeEmail(body.email);
      const user = db.users.find((item) => item.email === email && item.active !== false);
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        const error = new Error("Invalid email or password.");
        error.status = 401;
        throw error;
      }
      const company = db.companies.find((item) => item.id === user.companyId);
      const auth = { user, company };
      audit(db, auth, "session", user.id, "auth.login", {}, req);
      const session = createSession(db, user.id);
      return { session, bootstrap: buildBootstrap(db, { ...auth, session }) };
    });
    sendJson(res, 200, result, { "Set-Cookie": sessionCookie(result.session) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/session") {
    const db = await readDb();
    const auth = requireAuth(db, req);
    sendJson(res, 200, { user: publicUser(auth.user), company: publicCompany(auth.company) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    await mutateDb((db) => {
      const auth = requireAuth(db, req);
      db.sessions = db.sessions.filter((session) => session.tokenHash !== auth.tokenHash);
      return {};
    });
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const bootstrap = await withMaintainedAuth(req, (db, auth) => buildBootstrap(db, auth));
    sendJson(res, 200, bootstrap);
    return;
  }

  if (req.method === "PATCH" && pathname === "/api/workers/profile") {
    const body = await readBody(req, MULTI_UPLOAD_BODY_BYTES);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      requireWorker(auth);
      const previousCv = existingWorkerCv(auth.user);
      const workerCv = buildWorkerProfileUpdate(auth.user, body, previousCv.profilePhoto);
      const photoRecord = body.photo ? await storeWorkerProfilePhoto(auth.user, body.photo) : null;
      if (photoRecord) {
        workerCv.profilePhoto = photoRecord;
        workerCv.updatedAt = now();
      }
      auth.user.profile = {
        ...(auth.user.profile || {}),
        headline: workerCv.headline,
        location: workerCv.location,
        skills: workerCv.skills.join(", "),
        bio: workerCv.bio,
        workerCv
      };
      if (
        photoRecord &&
        previousCv.profilePhoto?.storedName &&
        previousCv.profilePhoto.storedName !== photoRecord.storedName
      ) {
        await deletePrivateUploadFile(previousCv.profilePhoto.storedName).catch(() => {});
      }
      audit(db, auth, "worker_profile", auth.user.id, workerCv.published ? "worker_profile.published" : "worker_profile.updated", {
        published: workerCv.published,
        experienceCount: workerCv.experience.length,
        referenceCount: workerCv.references.length,
        skillCount: workerCv.skills.length,
        hasPhoto: Boolean(workerCv.profilePhoto?.storedName)
      }, req);
      return {
        profile: publicWorkerProfile(auth.user, { includeUnpublished: true }),
        bootstrap: buildBootstrap(db, auth)
      };
    });
    sendJson(res, 200, result);
    return;
  }

  const workerPhotoMatch = pathname.match(/^\/api\/workers\/([^/]+)\/profile-photo$/);
  if (req.method === "GET" && workerPhotoMatch) {
    const workerId = decodeURIComponent(workerPhotoMatch[1]);
    const { photo } = await withMaintainedAuth(req, (db, auth) => {
      const worker = db.users.find((user) => user.id === workerId && user.role === "worker");
      if (!worker) {
        const error = new Error("Perfil de trabalhador nao encontrado.");
        error.status = 404;
        throw error;
      }
      const cv = existingWorkerCv(worker);
      const allowed = worker.id === auth.user.id || (isCompanyAdmin(auth.user) && cv.published);
      if (!allowed || !cv.profilePhoto?.storedName) {
        const error = new Error("Foto de perfil de trabalhador nao encontrada.");
        error.status = 404;
        throw error;
      }
      return { photo: cv.profilePhoto };
    });
    const buffer = await readPrivateUploadFile(photo.storedName);
    res.writeHead(200, {
      "Content-Type": photo.mimeType,
      "Content-Length": buffer.length,
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(buffer);
    return;
  }

  if (req.method === "POST" && pathname === "/api/job-offers") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireCompanyAccount(auth);
      const title = cleanString(body.title, 180);
      const location = cleanString(body.location, 180);
      const description = cleanString(body.description, 2400);
      if (!title || !location || !description) {
        const error = new Error("Vacancy title, location, and description are required.");
        error.status = 400;
        throw error;
      }
      const jobOffer = {
        id: nextId(db, "jobOffers", "job"),
        companyId: auth.company.id,
        companyName: auth.company.name,
        title,
        position: cleanString(body.position, 160) || title,
        location,
        contractType: cleanString(body.contractType, 100) || "A combinar",
        salary: cleanString(body.salary, 140),
        schedule: cleanString(body.schedule, 140),
        description,
        requirements: cleanString(body.requirements, 1600),
        status: "open",
        createdBy: auth.user.id,
        createdAt: now(),
        updatedAt: now(),
        closedAt: null
      };
      db.jobOffers.push(jobOffer);
      audit(db, auth, "job_offer", jobOffer.id, "job_offer.created", { title }, req);
      return { jobOffer: publicJobOffer(jobOffer), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const jobPatchMatch = pathname.match(/^\/api\/job-offers\/([^/]+)$/);
  if (req.method === "PATCH" && jobPatchMatch) {
    const jobOfferId = decodeURIComponent(jobPatchMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireCompanyAccount(auth);
      const jobOffer = db.jobOffers.find((job) => job.id === jobOfferId);
      assertSameCompany(auth, jobOffer);
      if (body.status) {
        const status = cleanString(body.status, 30);
        if (!["open", "closed"].includes(status)) {
          const error = new Error("Vacancy status must be open or closed.");
          error.status = 400;
          throw error;
        }
        jobOffer.status = status;
        jobOffer.closedAt = status === "closed" ? now() : null;
      }
      for (const field of ["title", "position", "location", "contractType", "salary", "schedule", "description", "requirements"]) {
        if (body[field] !== undefined) {
          jobOffer[field] = cleanString(body[field], field === "description" ? 2400 : 1600);
        }
      }
      jobOffer.updatedAt = now();
      audit(db, auth, "job_offer", jobOffer.id, "job_offer.updated", { status: jobOffer.status }, req);
      return { jobOffer: publicJobOffer(jobOffer), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const applyMatch = pathname.match(/^\/api\/job-offers\/([^/]+)\/apply$/);
  if (req.method === "POST" && applyMatch) {
    const jobOfferId = decodeURIComponent(applyMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireWorker(auth);
      const jobOffer = db.jobOffers.find((job) => job.id === jobOfferId && job.status === "open");
      if (!jobOffer) {
        const error = new Error("Vacancy not found or already closed.");
        error.status = 404;
        throw error;
      }
      const duplicate = db.jobApplications.find(
        (application) => application.jobOfferId === jobOffer.id && application.workerId === auth.user.id
      );
      if (!isWorkerProfilePublished(auth.user)) {
        const error = new Error("Publique o CV de trabalhador antes de se candidatar a vagas.");
        error.status = 400;
        throw error;
      }
      if (duplicate) {
        const error = new Error("You already applied to this vacancy.");
        error.status = 409;
        throw error;
      }
      const application = {
        id: nextId(db, "jobApplications", "app"),
        jobOfferId: jobOffer.id,
        companyId: jobOffer.companyId,
        workerId: auth.user.id,
        workerName: auth.user.name,
        workerEmail: auth.user.email,
        message: cleanString(body.message, 1600),
        status: "submitted",
        decisionReason: "",
        createdAt: now(),
        updatedAt: now()
      };
      db.jobApplications.push(application);
      audit(db, auth, "job_application", application.id, "job_application.submitted", {
        jobOfferId: jobOffer.id
      }, req);
      return { application: publicJobApplication(application, db), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const applicationPatchMatch = pathname.match(/^\/api\/applications\/([^/]+)$/);
  if (req.method === "PATCH" && applicationPatchMatch) {
    const applicationId = decodeURIComponent(applicationPatchMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireCompanyAccount(auth);
      const application = db.jobApplications.find((item) => item.id === applicationId);
      assertSameCompany(auth, application);
      const status = cleanString(body.status, 30);
      if (!["submitted", "reviewed", "accepted", "rejected"].includes(status)) {
        const error = new Error("Invalid application status.");
        error.status = 400;
        throw error;
      }
      application.status = status;
      application.decisionReason = cleanString(body.decisionReason, 1000);
      application.updatedAt = now();
      audit(db, auth, "job_application", application.id, "job_application.updated", { status }, req);
      return { application: publicJobApplication(application, db, { includeWorkerProfile: true }), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const name = cleanString(body.name, 120);
      const email = normalizeEmail(body.email);
      const role = cleanString(body.role, 30);
      validateManagedRole(role);
      validatePassword(body.password);
      if (!name || !email) {
        const error = new Error("Name, email, role, and password are required.");
        error.status = 400;
        throw error;
      }
      if (db.users.some((user) => user.email === email)) {
        const error = new Error("A user with this email already exists.");
        error.status = 409;
        throw error;
      }
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: auth.company.id,
        name,
        email,
        role,
        passwordHash: hashPassword(body.password),
        active: true,
        createdBy: auth.user.id,
        createdAt: now()
      };
      db.users.push(user);
      audit(db, auth, "user", user.id, "user.created", { role }, req);
      return { user: publicUser(user), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const userPatchMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (req.method === "PATCH" && userPatchMatch) {
    const userId = decodeURIComponent(userPatchMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const user = db.users.find((item) => item.id === userId);
      assertSameCompany(auth, user);
      if (typeof body.active === "boolean") {
        if (user.id === auth.user.id && body.active === false) {
          const error = new Error("Managers cannot deactivate their own account.");
          error.status = 400;
          throw error;
        }
        user.active = body.active;
      }
      if (body.role) {
        if (user.id === auth.user.id) {
          const error = new Error("Managers cannot change their own role.");
          error.status = 400;
          throw error;
        }
        const role = cleanString(body.role, 30);
        validateManagedRole(role);
        user.role = role;
      }
      audit(db, auth, "user", user.id, "user.updated", { active: user.active, role: user.role }, req);
      return { user: publicUser(user), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/invites") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const role = cleanString(body.role, 30);
      validateManagedRole(role);
      const token = randomToken(24);
      const invite = {
        id: nextId(db, "invites", "inv"),
        tokenHash: sha256(token),
        companyId: auth.company.id,
        role,
        email: normalizeEmail(body.email),
        name: cleanString(body.name, 120),
        createdBy: auth.user.id,
        createdAt: now(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        usedAt: null
      };
      db.invites.push(invite);
      audit(db, auth, "invite", invite.id, "invite.created", { role }, req);
      return { invite: publicInvite(invite), token, bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/work-orders") {
    const body = await readBody(req, MULTI_UPLOAD_BODY_BYTES);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const title = cleanString(body.title, 180);
      const address = cleanString(body.address, 240);
      const description = cleanString(body.description, 2000);
      if (!title || !address) {
        const error = new Error("Work order title and address are required.");
        error.status = 400;
        throw error;
      }
      const order = {
        id: nextId(db, "workOrders", "wo"),
        companyId: auth.company.id,
        title,
        address,
        description,
        createdBy: auth.user.id,
        createdAt: now(),
        updatedAt: now()
      };
      db.workOrders.push(order);
      const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];
      for (const photo of photos) {
        await storePhoto(db, auth, { photo, note: "Initial work order photo" }, {
          kind: "initial_photo",
          workOrderId: order.id,
          taskId: null,
          req
        });
      }
      audit(db, auth, "work_order", order.id, "work_order.created", { title, address }, req);
      return { workOrder: publicWorkOrder(order), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/tasks") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const workOrder = db.workOrders.find((item) => item.id === body.workOrderId);
      assertSameCompany(auth, workOrder);
      const assignee = db.users.find((item) => item.id === body.assigneeId && item.active !== false);
      assertSameCompany(auth, assignee);
      if (!["employee", "contractor"].includes(assignee.role)) {
        const error = new Error("Tasks must be assigned to an employee or contractor.");
        error.status = 400;
        throw error;
      }
      const title = cleanString(body.title, 180);
      const description = cleanString(body.description, 2000);
      const dueDate = cleanString(body.dueDate, 40);
      if (!title || !dueDate) {
        const error = new Error("Task title, assignee, and deadline are required.");
        error.status = 400;
        throw error;
      }
      const task = {
        id: nextId(db, "tasks", "task"),
        companyId: auth.company.id,
        workOrderId: workOrder.id,
        title,
        description,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        dueDate,
        status: "assigned",
        blockReason: "",
        validationComment: "",
        createdBy: auth.user.id,
        createdAt: now(),
        updatedAt: now(),
        startedAt: null,
        completedAt: null,
        validationDueAt: null,
        approvedAt: null,
        rejectedAt: null
      };
      db.tasks.push(task);
      workOrder.updatedAt = now();
      audit(db, auth, "task", task.id, "task.created", {
        title,
        assigneeId: assignee.id,
        dueDate
      }, req);
      return { task: publicTask(task), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const evidenceMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/evidence$/);
  if (req.method === "POST" && evidenceMatch) {
    const taskId = decodeURIComponent(evidenceMatch[1]);
    const body = await readBody(req, MULTI_UPLOAD_BODY_BYTES);
    const result = await mutateDb(async (db) => {
      await maintainOperationalEvidence(db, req);
      const auth = requireAuth(db, req);
      const task = db.tasks.find((item) => item.id === taskId);
      if (!canAccessTask(auth, task)) {
        const error = new Error("Task not found.");
        error.status = 404;
        throw error;
      }
      if (["approved", "pending_validation"].includes(task.status)) {
        const error = new Error("Tasks already submitted or approved cannot receive more evidence.");
        error.status = 400;
        throw error;
      }
      const photos = Array.isArray(body.photos) ? body.photos : [body.photo].filter(Boolean);
      if (!photos.length) {
        const error = new Error("At least one photo is required.");
        error.status = 400;
        throw error;
      }
      const stored = [];
      for (const photo of photos.slice(0, 12)) {
        const evidence = await storePhoto(db, auth, { ...body, photo }, {
          kind: "task_evidence",
          taskId: task.id,
          workOrderId: task.workOrderId,
          requireGps: true,
          req
        });
        stored.push(evidence);
        audit(db, auth, "evidence", evidence.id, "evidence.created", {
          taskId: task.id,
          locationStatus: evidence.location.status,
          expiresAt: evidence.expiresAt,
          authenticity: evidence.authenticity.status
        }, req);
      }
      task.updatedAt = now();
      return {
        evidence: stored[0] ? publicEvidence(stored[0]) : null,
        evidences: stored.map(publicEvidence),
        bootstrap: buildBootstrap(db, auth)
      };
    });
    sendJson(res, 201, result);
    return;
  }

  const statusMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const taskId = decodeURIComponent(statusMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb(async (db) => {
      await maintainOperationalEvidence(db, req);
      const auth = requireAuth(db, req);
      const task = db.tasks.find((item) => item.id === taskId);
      if (!canAccessTask(auth, task)) {
        const error = new Error("Task not found.");
        error.status = 404;
        throw error;
      }
      const nextStatus = cleanString(body.status, 40);
      if (!TASK_STATUSES.has(nextStatus)) {
        const error = new Error("Invalid task status.");
        error.status = 400;
        throw error;
      }
      if (["approved", "rejected"].includes(nextStatus)) {
        const error = new Error("Use the manager validation endpoint for approval or rejection.");
        error.status = 400;
        throw error;
      }
      if (!isCompanyAdmin(auth.user) && task.assigneeId !== auth.user.id) {
        const error = new Error("Only the responsible user can update this task.");
        error.status = 403;
        throw error;
      }
      if (task.status === "approved") {
        const error = new Error("Approved tasks cannot be changed.");
        error.status = 400;
        throw error;
      }
      if (nextStatus === "blocked") {
        const reason = cleanString(body.blockReason, 1000);
        if (!reason) {
          const error = new Error("Blocking a task requires a justification.");
          error.status = 400;
          throw error;
        }
        task.blockReason = reason;
      }
      if (nextStatus === "pending_validation") {
        const evidenceCount = qualifyingTaskEvidence(db, task).length;
        if (evidenceCount < FINAL_TASK_EVIDENCE_MIN) {
          const error = new Error(`At least ${FINAL_TASK_EVIDENCE_MIN} GPS-authenticated photos are required before validation.`);
          error.status = 400;
          throw error;
        }
        task.completedAt = now();
        task.validationDueAt = addHours(task.completedAt, TASK_VALIDATION_HOURS);
      }
      if (nextStatus === "in_progress" && !task.startedAt) {
        task.startedAt = now();
      }
      task.status = nextStatus;
      task.updatedAt = now();
      audit(db, auth, "task", task.id, "task.status_changed", {
        status: nextStatus,
        blockReason: nextStatus === "blocked" ? task.blockReason : ""
      }, req);
      return { task: publicTask(task), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const decisionMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/decision$/);
  if (req.method === "POST" && decisionMatch) {
    const taskId = decodeURIComponent(decisionMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb(async (db) => {
      await maintainOperationalEvidence(db, req);
      const auth = requireAuth(db, req);
      requireManager(auth);
      const task = db.tasks.find((item) => item.id === taskId);
      assertSameCompany(auth, task);
      if (task.status !== "pending_validation") {
        const error = new Error("Only tasks pending validation can be approved or rejected.");
        error.status = 400;
        throw error;
      }
      const decision = cleanString(body.decision, 30);
      if (!["approved", "rejected"].includes(decision)) {
        const error = new Error("Decision must be approved or rejected.");
        error.status = 400;
        throw error;
      }
      const reason = cleanString(body.reason, 1000);
      if (decision === "rejected" && !reason) {
        const error = new Error("Rejection requires a reason.");
        error.status = 400;
        throw error;
      }
      task.status = decision;
      task.validationComment = reason;
      task.updatedAt = now();
      if (decision === "approved") task.approvedAt = now();
      if (decision === "rejected") task.rejectedAt = now();
      audit(db, auth, "task", task.id, `task.${decision}`, { reason }, req);
      return { task: publicTask(task), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const fileMatch = pathname.match(/^\/api\/evidence\/([^/]+)\/file$/);
  if (req.method === "GET" && fileMatch) {
    const evidenceId = decodeURIComponent(fileMatch[1]);
    const { evidence } = await withMaintainedAuth(req, (db, auth) => {
      const evidence = db.evidences.find((item) => item.id === evidenceId);
      assertSameCompany(auth, evidence);
      let allowed = false;
      if (evidence.taskId) {
        const task = db.tasks.find((item) => item.id === evidence.taskId);
        allowed = canAccessTask(auth, task);
      } else {
        const order = db.workOrders.find((item) => item.id === evidence.workOrderId);
        allowed = canAccessWorkOrder(auth, db, order);
      }
      if (!allowed) {
        const error = new Error("Evidence not found.");
        error.status = 404;
        throw error;
      }
      return { evidence };
    });
    const buffer = await readEvidenceFile(evidence);
    res.writeHead(200, {
      "Content-Type": evidence.mimeType,
      "Content-Length": buffer.length,
      "Cache-Control": "private, max-age=120",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(buffer);
    return;
  }

  const downloadMatch = pathname.match(/^\/api\/evidence\/([^/]+)\/download$/);
  if (req.method === "GET" && downloadMatch) {
    const evidenceId = decodeURIComponent(downloadMatch[1]);
    const context = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      await maintainOperationalEvidence(db, req);
      const evidence = db.evidences.find((item) => item.id === evidenceId);
      assertSameCompany(auth, evidence);
      const task = evidence.taskId ? db.tasks.find((item) => item.id === evidence.taskId) : null;
      const order = db.workOrders.find((item) => item.id === evidence.workOrderId);
      const allowed = evidence.taskId ? canAccessTask(auth, task) : canAccessWorkOrder(auth, db, order);
      if (!allowed) {
        const error = new Error("Evidence not found.");
        error.status = 404;
        throw error;
      }
      audit(db, auth, "evidence", evidence.id, "evidence.watermarked_downloaded", {
        taskId: evidence.taskId || null,
        workOrderId: evidence.workOrderId || null
      }, req);
      return { evidence, task, order };
    });
    const source = await readEvidenceFile(context.evidence);
    const watermarked = buildWatermarkedEvidenceSvg(context.evidence, context.task, context.order, source);
    const filename = `${safeFileName(context.evidence.id)}-watermarked.svg`;
    res.writeHead(200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Length": watermarked.length,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(watermarked);
    return;
  }

  if (req.method === "GET" && pathname === "/api/export/basic") {
    const payload = await withMaintainedAuth(req, (db, auth) => {
      requireManager(auth);
      const companyId = auth.company.id;
      return {
        exportedAt: now(),
        company: publicCompany(auth.company),
        users: db.users.filter((item) => item.companyId === companyId).map(publicUser),
        workOrders: db.workOrders.filter((item) => item.companyId === companyId).map(publicWorkOrder),
        tasks: db.tasks.filter((item) => item.companyId === companyId).map(publicTask),
        evidences: db.evidences.filter((item) => item.companyId === companyId).map(publicEvidence),
        auditLogs: db.auditLogs.filter((item) => item.companyId === companyId),
        jobOffers: db.jobOffers.filter((item) => item.companyId === companyId).map(publicJobOffer),
        jobApplications: db.jobApplications
          .filter((item) => item.companyId === companyId)
          .map((application) => publicJobApplication(application, db, { includeWorkerProfile: true }))
      };
    });
    sendJson(res, 200, payload);
    return;
  }

  routeNotFound();
}

async function serveStatic(req, res, pathname) {
  let staticPath = pathname === "/" ? "/index.html" : pathname;
  try {
    staticPath = decodeURIComponent(staticPath);
  } catch {
    staticPath = "/index.html";
  }
  const normalized = path.normalize(staticPath).replace(/^([/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  const body = await fsp.readFile(filePath);
  const fileName = path.basename(filePath);
  const cacheControl =
    [".html", ".js", ".css", ".webmanifest"].includes(ext) || fileName === "service-worker.js"
      ? "no-store"
      : "public, max-age=3600";
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendError(res, error);
  }
}

function createServer() {
  return http.createServer(requestHandler);
}

if (require.main === module) {
  ensureStorage()
    .then(() => {
      createServer().listen(PORT, () => {
        console.log(`Motor de Evidencia Operacional running at http://localhost:${PORT}`);
        console.log(`Storage driver: ${APP_STORAGE_DRIVER}`);
        if (APP_STORAGE_DRIVER === "local") {
          console.log(`Data directory: ${DATA_DIR}`);
        }
      });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  createServer,
  requestHandler,
  readDb,
  buildBootstrap,
  APP_STORAGE_DRIVER,
  PUBLIC_STATUS_LABELS
};
