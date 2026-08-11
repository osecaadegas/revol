const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.resolve(process.env.APP_DATA_DIR || path.join(ROOT_DIR, "data"));
const DB_FILE = path.join(DATA_DIR, "database.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const PORT = Number(process.env.PORT || 4173);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 6) * 1024 * 1024;
const SESSION_DAYS = 7;
const SESSION_COOKIE = "meo_session";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SUPABASE_EVIDENCE_BUCKET = String(process.env.SUPABASE_EVIDENCE_BUCKET || "meo-evidence");
const APP_STORAGE_DRIVER = String(
  process.env.APP_STORAGE_DRIVER || (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local")
).toLowerCase();

const ROLES = new Set(["manager", "employee", "contractor", "worker", "company"]);
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
    row[column] = record[appKey] === undefined ? null : record[appKey];
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

function requireWorker(auth) {
  if (auth.user.role !== "worker") {
    const error = new Error("Worker registration is required to apply.");
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

function isCompanyAdmin(user) {
  return user?.role === "manager" || user?.role === "company";
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
    profile: user.profile || {},
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
  return { ...task };
}

function publicEvidence(evidence) {
  const { storedName, ...safe } = evidence;
  return {
    ...safe,
    fileUrl: `/api/evidence/${evidence.id}/file`
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

function publicJobApplication(application) {
  return { ...application };
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
  return task.assigneeId === auth.user.id;
}

function canAccessWorkOrder(auth, db, order) {
  if (!order || order.companyId !== auth.company.id) return false;
  if (isCompanyAdmin(auth.user)) return true;
  return db.tasks.some((task) => task.workOrderId === order.id && task.assigneeId === auth.user.id);
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

  return {
    user: publicUser(auth.user),
    company: publicCompany(auth.company),
    users: isManager ? companyUsers : companyUsers.filter((user) => user.id === auth.user.id),
    workOrders: workOrders.map(publicWorkOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: tasks.map(publicTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    evidences: evidences.map(publicEvidence).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditLogs: logs.slice(0, 250),
    invites,
    jobOffers: jobOffers.map(publicJobOffer).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    jobApplications: jobApplications
      .map(publicJobApplication)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { status: "unavailable" };
    }
    return { status, latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null };
  }
  if (["denied", "unavailable", "not_requested"].includes(status)) {
    return { status };
  }
  return { status: "unavailable" };
}

async function storePhoto(db, auth, body, options) {
  const parsed = parsePhotoDataUrl(body.photo);
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
    location: normalizeLocation(body.location),
    createdAt: now()
  };
  evidence.storedName = `${evidence.companyId}/${evidence.id}.${parsed.ext}`;
  await saveEvidenceFile(evidence, parsed.buffer);
  db.evidences.push(evidence);
  return evidence;
}

async function saveEvidenceFile(evidence, buffer) {
  if (APP_STORAGE_DRIVER === "supabase") {
    const objectPath = encodeObjectPath(evidence.storedName);
    await supabaseStorage(`object/${encodeURIComponent(SUPABASE_EVIDENCE_BUCKET)}/${objectPath}`, {
      method: "POST",
      headers: {
        "Content-Type": evidence.mimeType,
        "cache-control": "3600",
        "x-upsert": "true"
      },
      body: buffer
    });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, evidence.storedName);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, buffer);
}

async function readEvidenceFile(evidence) {
  if (APP_STORAGE_DRIVER === "supabase") {
    const objectPath = encodeObjectPath(evidence.storedName);
    return supabaseStorage(`object/authenticated/${encodeURIComponent(SUPABASE_EVIDENCE_BUCKET)}/${objectPath}`);
  }
  return fsp.readFile(path.join(UPLOAD_DIR, evidence.storedName));
}

function encodeObjectPath(storedName) {
  return String(storedName)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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

function publicJobsPayload(db) {
  return {
    jobs: db.jobOffers
      .filter((job) => job.status === "open")
      .map(publicJobOffer)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "motor-evidencia-operacional",
      storageDriver: APP_STORAGE_DRIVER,
      time: now()
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/setup/status") {
    const db = await readDb();
    sendJson(res, 200, { initialized: db.users.some((user) => user.active !== false) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/jobs/public") {
    const db = await readDb();
    sendJson(res, 200, publicJobsPayload(db));
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
          headline: cleanString(body.headline, 160),
          location: cleanString(body.location, 160),
          skills: cleanString(body.skills, 600),
          bio: cleanString(body.bio, 1200)
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
    const db = await readDb();
    const auth = requireAuth(db, req);
    sendJson(res, 200, buildBootstrap(db, auth));
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
      return { application: publicJobApplication(application), bootstrap: buildBootstrap(db, auth) };
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
      return { application: publicJobApplication(application), bootstrap: buildBootstrap(db, auth) };
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
      validateRole(role);
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
        const role = cleanString(body.role, 30);
        validateRole(role);
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
      validateRole(role);
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
    const body = await readBody(req);
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
          taskId: null
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
      if (assignee.role === "manager") {
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
    const body = await readBody(req);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      const task = db.tasks.find((item) => item.id === taskId);
      if (!canAccessTask(auth, task)) {
        const error = new Error("Task not found.");
        error.status = 404;
        throw error;
      }
      if (task.status === "approved") {
        const error = new Error("Approved tasks cannot receive more evidence.");
        error.status = 400;
        throw error;
      }
      const evidence = await storePhoto(db, auth, body, {
        kind: "task_evidence",
        taskId: task.id,
        workOrderId: task.workOrderId
      });
      task.updatedAt = now();
      audit(db, auth, "evidence", evidence.id, "evidence.created", {
        taskId: task.id,
        locationStatus: evidence.location.status
      }, req);
      return { evidence: publicEvidence(evidence), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const statusMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const taskId = decodeURIComponent(statusMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
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
      if (auth.user.role !== "manager" && task.assigneeId !== auth.user.id) {
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
        const evidenceCount = db.evidences.filter((evidence) => evidence.taskId === task.id).length;
        if (evidenceCount < 1) {
          const error = new Error("At least one photo evidence is required before validation.");
          error.status = 400;
          throw error;
        }
        task.completedAt = now();
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
    const result = await mutateDb((db) => {
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
    const db = await readDb();
    const auth = requireAuth(db, req);
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

  if (req.method === "GET" && pathname === "/api/export/basic") {
    const db = await readDb();
    const auth = requireAuth(db, req);
    requireManager(auth);
    const companyId = auth.company.id;
    sendJson(res, 200, {
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
        .map(publicJobApplication)
    });
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
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
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
