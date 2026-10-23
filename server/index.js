const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { URL } = require("url");
const { renderPrivateMvpHtml } = require("./private-mvp");
const { renderPrivateProjectHtml } = require("./private-project");
const recruitment = require("./recruitment");
const professionalProfile = require("./professional-profile");
const directChat = require("./direct-chat");
const { createPushNotifications } = require("./push-notifications");
const { createPublicMarketplace } = require("./public-marketplace");
const punctuality = require("./punctuality");

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
const PUBLIC_SITE_URL = String(process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
const PUBLIC_ASSET_VERSION = "20261023-punctuality";
const PUBLIC_BRAND_NAME = "TrataPro";
const PUBLIC_BRAND_SLOGAN = "Trabalho certo. Prova feita.";
const PUBLIC_BRAND_TITLE = `${PUBLIC_BRAND_NAME} - Vagas abertas`;
const PUBLIC_SOCIAL_IMAGE_PATH = "/social-card.svg";
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_REGISTRATION_NIF_COOKIE = "meo_google_registration_nif";
const APP_STORAGE_DRIVER = String(
  process.env.APP_STORAGE_DRIVER || (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local")
).toLowerCase();
const PUNCTUALITY_ENABLED = process.env.PUNCTUALITY_ENABLED === "true" || (process.env.PUNCTUALITY_ENABLED !== "false" && APP_STORAGE_DRIVER === "local");

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
  blocked: "Com contratempo",
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
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const PUBLIC_SHELL_PATHS = new Set(["/", "/index.html", "/cliente", "/dashboard", "/changelog"]);
const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src https://www.google.com https://maps.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "manifest-src 'self'",
    "worker-src 'self'"
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

let writeQueue = Promise.resolve();
const authAttempts = new Map();
let supabaseSchemaReady = null;
const staticAssetCache = new Map();

const TABLES = [
  {
    key: "companies",
    table: "meo_companies",
    idKey: "id",
    fields: {
      id: "id",
      name: "name",
      nif: "nif",
      location: "location",
      website: "website",
      sector: "sector",
      description: "description",
      recruitment: "recruitment",
      punctualityConfig: "punctuality_config",
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
      nif: "nif",
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
      assignedUserIds: "assigned_user_ids",
      expectedStartDate: "expected_start_date",
      expectedEndDate: "expected_end_date",
      status: "status",
      statusReason: "status_reason",
      actualStartedAt: "actual_started_at",
      actualCompletedAt: "actual_completed_at",
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
      employmentId: "employment_id",
      scheduledStartAt: "scheduled_start_at",
      planningNotes: "planning_notes",
      workAddress: "work_address",
      workLocation: "work_location",
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
    key: "attendanceEntries",
    table: "meo_attendance_entries",
    idKey: "id",
    fields: { id: "id", companyId: "company_id", workerId: "worker_id", taskId: "task_id", workOrderId: "work_order_id", clockedInAt: "clocked_in_at", clockedOutAt: "clocked_out_at", punctuality: "punctuality", createdAt: "created_at" }
  },
  {
    key: "attendanceJustifications",
    table: "meo_attendance_justifications",
    idKey: "id",
    fields: { id: "id", companyId: "company_id", workerId: "worker_id", employmentId: "employment_id", absenceDate: "absence_date", kind: "kind", status: "status", reason: "reason", originalName: "original_name", mimeType: "mime_type", storedName: "stored_name", decidedAt: "decided_at", decidedBy: "decided_by", decisionReason: "decision_reason", createdAt: "created_at" }
  },
  {
    key: "workSchedules", table: "meo_work_schedules", idKey: "id",
    fields: { id: "id", companyId: "company_id", workerId: "worker_id", employmentId: "employment_id", taskId: "task_id", workDate: "work_date", startTime: "start_time", firstPublishedStartAt: "first_published_start_at", address: "address", note: "note", createdBy: "created_by", createdAt: "created_at", updatedAt: "updated_at" }
  },
  {
    key: "dayOffRequests", table: "meo_day_off_requests", idKey: "id",
    fields: { id: "id", companyId: "company_id", workerId: "worker_id", employmentId: "employment_id", workDate: "work_date", reason: "reason", status: "status", requestedAt: "requested_at", decidedAt: "decided_at", decidedBy: "decided_by", decisionNote: "decision_note" }
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
if (!PUNCTUALITY_ENABLED) {
  delete TABLES.find(item => item.key === "companies").fields.punctualityConfig;
  delete TABLES.find(item => item.key === "attendanceEntries").fields.punctuality;
  delete TABLES.find(item => item.key === "workSchedules").fields.firstPublishedStartAt;
  for (const field of ["kind", "status", "decidedAt", "decidedBy", "decisionReason"]) {
    delete TABLES.find(item => item.key === "attendanceJustifications").fields[field];
  }
}
for (const definition of TABLES.filter(t => ["jobOffers", "jobApplications"].includes(t.key))) definition.fields.recruitment = "recruitment";
TABLES.push(...recruitment.TABLES);
TABLES.push(...professionalProfile.TABLES);
TABLES.push(...directChat.TABLES);
const recruitmentApi = recruitment.createRecruitment({ readDb, mutateDb, requireAuth, requireWorker, requireCompanyAccount,
  publicUser, publicCompany, publicJobOffer, audit, buildBootstrap, readBody, sendJson, responseHeaders,
  readPrivateUploadFile, savePrivateUploadFile, deletePrivateUploadFile, safeHttpUrl, hashPassword, publicJobPath, parsePhotoDataUrl,
  normalizeNif, requireValidNif, assertNifAvailable });
const professionalProfileApi = professionalProfile.createProfessionalProfile({ readDb, mutateDb, requireAuth, requireWorker,
  requireCompanyAccount, publicUser, publicCompany, audit, buildBootstrap, readBody, sendJson, responseHeaders,
  readPrivateUploadFile, savePrivateUploadFile, deletePrivateUploadFile });
const directChatApi = directChat.createDirectChat({ readDb, mutateDb, requireAuth, readBody, sendJson, audit });
const pushApi = createPushNotifications({ readDb, mutateDb, requireAuth, readBody, sendJson, supabaseRest, storageDriver: APP_STORAGE_DRIVER });
directChatApi.setPushNotifier((userId) => pushApi.sendToUsers([userId], "message"));
const publicMarketplace = createPublicMarketplace({ htmlEscape, publicJobPath, publicOpenJobs, renderPublicTopbarStatic, safeHttpUrl });

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

function normalizeNif(value) {
  return String(value || "").trim().replace(/[\s.-]/g, "");
}

function isValidPortugueseNif(value) {
  const nif = normalizeNif(value);
  if (!/^[1235689]\d{8}$/.test(nif)) return false;
  const digits = [...nif].map(Number);
  const total = digits.slice(0, 8).reduce((sum, digit, index) => sum + digit * (9 - index), 0);
  const result = 11 - (total % 11);
  const checkDigit = result >= 10 ? 0 : result;
  return checkDigit === digits[8];
}

function requireValidNif(value) {
  const nif = normalizeNif(value);
  if (!isValidPortugueseNif(nif)) {
    const error = new Error("Indique um NIF portugues valido com 9 digitos.");
    error.status = 400;
    throw error;
  }
  return nif;
}

function assertNifAvailable(db, nif, exclusions = {}) {
  const normalized = normalizeNif(nif);
  const duplicateUser = db.users.some((user) => user.id !== exclusions.userId && normalizeNif(user.nif) === normalized);
  const duplicateCompany = db.companies.some((company) => company.id !== exclusions.companyId && (
    normalizeNif(company.nif) === normalized || (!company.nif && normalizeNif(company.recruitment?.nif) === normalized)
  ));
  if (duplicateUser || duplicateCompany) {
    const error = new Error("Ja existe uma conta registada com este NIF.");
    error.status = 409;
    throw error;
  }
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

function signGoogleRegistrationNif(nif) {
  const body = Buffer.from(JSON.stringify({ nif: requireValidNif(nif), createdAt: Date.now() })).toString("base64url");
  const signature = crypto.createHmac("sha256", googleStateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyGoogleRegistrationNif(value) {
  const [body, signature] = String(value || "").split(".");
  if (!body || !signature) throw Object.assign(new Error("Google worker registration NIF is missing."), { status: 400 });
  const expected = crypto.createHmac("sha256", googleStateSecret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw Object.assign(new Error("Google worker registration NIF is invalid."), { status: 400 });
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")); }
  catch { throw Object.assign(new Error("Google worker registration NIF is invalid."), { status: 400 }); }
  if (!payload.createdAt || Date.now() - Number(payload.createdAt) > GOOGLE_STATE_TTL_MS) {
    throw Object.assign(new Error("Google worker registration NIF has expired."), { status: 400 });
  }
  return requireValidNif(payload.nif);
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
    attendanceSchemaReady: true,
    planningSchemaReady: true,
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
    attendanceEntries: [],
    attendanceJustifications: [],
    workSchedules: [],
    dayOffRequests: [],
    pushSubscriptions: [],
    auditLogs: [],
    jobOffers: [],
    jobApplications: [],
    recruitmentMessages: [],
    jobReports: [],
    ...Object.fromEntries([...professionalProfile.EMPTY_KEYS,...directChat.EMPTY_KEYS].map((key) => [key, []]))
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
    "attendanceEntries",
    "attendanceJustifications",
    "workSchedules",
    "dayOffRequests",
    "pushSubscriptions",
    "auditLogs",
    "jobOffers",
    "jobApplications",
    "recruitmentMessages",
    "jobReports",
    ...professionalProfile.EMPTY_KEYS,
    ...directChat.EMPTY_KEYS
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
  if (!supabaseSchemaReady) {
    supabaseSchemaReady = supabaseRest("meo_app_meta?select=key&limit=1").catch((error) => {
      supabaseSchemaReady = null;
      error.message = `${error.message} Run supabase/migrations/20260810000000_initial_phase1_schema.sql before starting with APP_STORAGE_DRIVER=supabase.`;
      throw error;
    });
  }
  await supabaseSchemaReady;
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
    row[column] = record[appKey] === undefined && ["profile", "recruitment"].includes(appKey) ? {} : record[appKey] === undefined ? null : record[appKey];
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

  await Promise.all(TABLES.map(async (definition) => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      let page;
      try {
        page = await supabaseRest(`${definition.table}?select=*&order=${definition.fields[definition.idKey]}.asc&limit=500&offset=${offset}`);
      } catch (error) {
        if (["attendanceEntries", "attendanceJustifications", "workSchedules", "dayOffRequests"].includes(definition.key) && /PGRST205|42P01/.test(error.message)) {
          if (["workSchedules", "dayOffRequests"].includes(definition.key)) db.planningSchemaReady = false;
          else db.attendanceSchemaReady = false;
          break;
        }
        throw error;
      }
      rows.push(...page);
      if (page.length < 500) break;
    }
    db[definition.key] = rows.map((row) => fromRow(row, definition.fields));
  }));

  return ensureShape(db);
}

async function readMarketplaceDb() {
  if (APP_STORAGE_DRIVER !== "supabase") return readDb();
  const db = createEmptyDb();
  await Promise.all(TABLES.filter(t => ["companies", "jobOffers"].includes(t.key)).map(async definition => {
    const records = [];
    for (let offset = 0; ; offset += 500) {
      const rows = await supabaseRest(`${definition.table}?select=*&order=id.asc&limit=500&offset=${offset}`);
      records.push(...rows.map(row => fromRow(row, definition.fields)));
      if (rows.length < 500) break;
    }
    db[definition.key] = records;
  }));
  return db;
}

async function writeSupabaseDb(db, previousDb = createEmptyDb()) {
  await ensureSupabaseStorage();
  const changes = [];
  for (const definition of [...TABLES].reverse()) {
    const ids = new Set((db[definition.key] || []).map(r => r[definition.idKey]));
    for (const record of previousDb[definition.key] || []) if (!ids.has(record[definition.idKey])) changes.push({ table: definition.table, id: record[definition.idKey], before: toRow(record, definition.fields), after: null });
  }
  for (const definition of TABLES) {
    const previous = new Map((previousDb[definition.key] || []).map(record => [record[definition.idKey], record]));
    for (const record of db[definition.key] || []) {
      const before = previous.get(record[definition.idKey]);
      if (JSON.stringify(before) !== JSON.stringify(record)) changes.push({ table: definition.table, id: record[definition.idKey], before: before ? toRow(before, definition.fields) : null, after: toRow(record, definition.fields) });
    }
  }
  if (!changes.length) return;
  try {
    await supabaseRest("rpc/meo_apply_changes", { method: "POST", body: { changes } });
  } catch (error) {
    if (error.message.includes("40001") || error.message.includes("23505")) throw Object.assign(new Error("O registo mudou entretanto. Atualize a pagina e tente novamente."), { status: 409 });
    throw error;
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
  return `${prefix}_${crypto.randomUUID()}`;
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

function googleRegistrationNifCookie(nif, req) {
  const secure = requestOrigin(req).startsWith("https://") ? "; Secure" : "";
  return `${GOOGLE_REGISTRATION_NIF_COOKIE}=${encodeURIComponent(signGoogleRegistrationNif(nif))}; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=${Math.floor(GOOGLE_STATE_TTL_MS / 1000)}${secure}`;
}

function clearGoogleRegistrationNifCookie(req) {
  const secure = requestOrigin(req).startsWith("https://") ? "; Secure" : "";
  return `${GOOGLE_REGISTRATION_NIF_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/google/callback; Max-Age=0${secure}`;
}

function googleAuthorizationUrl(req, next, intent) {
  const state = signGoogleState({ createdAt: Date.now(), nonce: randomToken(16), next, intent });
  const googleUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  googleUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", googleRedirectUri(req));
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid profile email");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");
  return googleUrl.toString();
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
    preferences: recruitment.profileSettings({}, cv.preferences),
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
    preferences: cv.preferences,
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
  if (!profile.skills.length) missing.push("competencias");
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
    preferences: current.preferences,
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
    nifConfigured: Boolean(company.nif),
    location: company.location || "",
    website: company.website || "",
    sector: company.sector || "",
    description: company.description || "",
    recruitment: company.recruitment || {},
    createdAt: company.createdAt
  };
}

function publicWorkOrder(order, auth = null) {
  const assignedUserIds = Array.isArray(order.assignedUserIds) ? order.assignedUserIds : [];
  return {
    ...order,
    assignedUserCount: assignedUserIds.length,
    assignedUserIds: auth && !isCompanyAdmin(auth.user) ? assignedUserIds.filter((id) => id === auth.user.id) : assignedUserIds,
    expectedStartDate: order.expectedStartDate || null,
    expectedEndDate: order.expectedEndDate || null,
    status: order.status || "planned",
    statusReason: order.statusReason || "",
    actualStartedAt: order.actualStartedAt || null,
    actualCompletedAt: order.actualCompletedAt || null
  };
}

function publicTask(task, db) {
  const resolutionLog = db.auditLogs.find((entry) =>
    entry.entityType === "task" && entry.entityId === task.id &&
    entry.companyId === task.companyId && entry.action === "task.setback_resolved"
  );
  return {
    ...task,
    validationDueAt: task.validationDueAt || null,
    lastSetbackResolution: resolutionLog ? {
      text: resolutionLog.detail.resolution,
      reportedReason: resolutionLog.detail.reportedReason,
      resolvedAt: resolutionLog.createdAt,
      resolvedBy: resolutionLog.actorName
    } : null
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
  return { ...job, salary: recruitment.salary(job), publicPath: publicJobPath(job), status: recruitment.open(job) ? job.status : "closed" };
}

function publicJobApplication(application, db = null, options = {}) {
  const payload = { ...application };
  if (options.includeWorkerProfile && db) {
    const worker = db.users.find((user) => user.id === application.workerId);
    const company = db.companies.find(c => c.id === application.companyId);
    const permitted = worker && recruitment.canReadProfile(db, worker, { user: { role: "company" }, company });
    payload.workerProfile = permitted ? publicWorkerProfile(worker, { includeUnpublished: true }) : null;
    if (!permitted) delete payload.workerEmail;
    if (payload.workerProfile) {
      delete payload.workerProfile.birthDate;
      delete payload.workerProfile.references;
      delete payload.workerProfile.preferences.coordinates;
      payload.workerProfile.documents = (worker.profile?.documents || []).map(({ storedName, ...doc }) => doc);
      payload.match = recruitment.match(db.jobOffers.find(j => j.id === application.jobOfferId) || {}, worker);
    }
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

function responseHeaders(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, responseHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...headers
  }));
  res.end(body);
}

function sendRedirect(res, location, headers = {}) {
  res.writeHead(302, responseHeaders({
    Location: location,
    "Cache-Control": "no-store",
    ...headers
  }));
  res.end();
}

function sendHtml(res, status, body, headers = {}) {
  res.writeHead(status, responseHeaders({
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    ...headers
  }));
  res.end(body);
}

function sendText(res, status, body, contentType, headers = {}) {
  res.writeHead(status, responseHeaders({
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": status === 200 ? "public, max-age=900" : "no-store",
    ...headers
  }));
  res.end(body);
}

function sendError(res, error) {
  const status = error.status || 500;
  const message = status >= 500 ? "Internal server error." : error.message;
  if (status >= 500) {
    console.error(error);
  }
  sendJson(res, status, { error: status >= 500 ? "Nao foi possivel concluir o pedido. Tente novamente." : message });
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

function verifiedTaskEmployment(db, companyId, workerId, employmentId = "") {
  return db.employmentRelationships.find((item) =>
    item.companyId === companyId &&
    item.workerId === workerId &&
    item.verificationStatus === "verified" &&
    (!employmentId || item.id === employmentId)
  ) || null;
}

const WORK_ORDER_STATUSES = new Set(["planned", "in_progress", "blocked", "pending_validation", "approved", "rejected"]);
const WORK_ORDER_NEXT_STATUSES = {
  planned: ["in_progress"],
  in_progress: ["blocked", "pending_validation"],
  blocked: ["in_progress", "pending_validation"],
  pending_validation: ["approved", "rejected"],
  rejected: ["in_progress"],
  approved: []
};

function workOrderDate(value) {
  const text = cleanString(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
}

function portugalToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function portugalDayStartMs(date) {
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`);
  const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(new Date(midnightUtc)));
  return midnightUtc - localHour * 60 * 60 * 1000;
}

function activePlanningEmployment(db, companyId, workerId, date) {
  const worker = db.users.find((user) => user.id === workerId && user.role === "worker" && user.active !== false);
  if (!worker) return null;
  return db.employmentRelationships.find((item) => item.companyId === companyId && item.workerId === workerId &&
    item.verificationStatus === "verified" && item.employmentStatus === "active" && item.startDate <= date && (!item.endDate || item.endDate >= date)) || null;
}

function validatedWorkOrderAssignees(db, companyId, value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    const error = new Error("Escolha entre 1 e 20 pessoas para a ordem.");
    error.status = 400;
    throw error;
  }
  const ids = [...new Set(value.map((item) => cleanString(item, 80)))];
  if (ids.length !== value.length || ids.some((id) => !id)) {
    const error = new Error("A equipa atribuída contém identificadores inválidos ou repetidos.");
    error.status = 400;
    throw error;
  }
  for (const id of ids) {
    const user = db.users.find((item) => item.id === id && item.active !== false);
    const sameCompany = user?.companyId === companyId && ["employee", "contractor"].includes(user.role);
    const verifiedWorker = user?.role === "worker" && Boolean(verifiedTaskEmployment(db, companyId, id));
    if (!sameCompany && !verifiedWorker) {
      const error = new Error("Só é possível atribuir membros da empresa ou trabalhadores com vínculo verificado.");
      error.status = 403;
      throw error;
    }
  }
  return ids;
}

function canAccessTask(auth, task, db) {
  if (!task) return false;
  if (auth.user.role === "worker") {
    return task.assigneeId === auth.user.id && Boolean(verifiedTaskEmployment(db, task.companyId, auth.user.id, task.employmentId));
  }
  if (task.companyId !== auth.company.id) return false;
  if (isCompanyAdmin(auth.user)) return true;
  if (!isOperationalUser(auth.user)) return false;
  return task.assigneeId === auth.user.id;
}

function canAccessWorkOrder(auth, db, order) {
  if (!order) return false;
  if (auth.user.role === "worker") {
    return (Array.isArray(order.assignedUserIds) && order.assignedUserIds.includes(auth.user.id) &&
      Boolean(verifiedTaskEmployment(db, order.companyId, auth.user.id))) ||
      db.tasks.some((task) => task.workOrderId === order.id && canAccessTask(auth, task, db));
  }
  if (order.companyId !== auth.company.id) return false;
  if (isCompanyAdmin(auth.user)) return true;
  if (!isOperationalUser(auth.user)) return false;
  return (Array.isArray(order.assignedUserIds) && order.assignedUserIds.includes(auth.user.id)) ||
    db.tasks.some((task) => task.workOrderId === order.id && task.assigneeId === auth.user.id);
}

function taskScopedAuth(auth, task) {
  if (!task || auth.company.id === task.companyId) return auth;
  return { ...auth, company: { ...auth.company, id: task.companyId } };
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

function buildOperationalAlerts(db, companyId) {
  return db.tasks
    .filter((task) => task.companyId === companyId && task.status === "blocked" && task.blockReason)
    .map((task) => {
      const order = db.workOrders.find((item) => item.id === task.workOrderId);
      const workOrderTitle = order?.title || "Obra sem designação";
      return {
        type: "task_setback",
        priority: "high",
        taskId: task.id,
        taskTitle: task.title,
        assigneeName: task.assigneeName,
        workOrderTitle,
        reason: task.blockReason,
        reportedAt: task.updatedAt,
        message: `O colaborador ${task.assigneeName} na obra ${workOrderTitle} está com o contratempo ${task.title}. Razão: ${task.blockReason}`
      };
    })
    .sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt)));
}

function buildBootstrap(db, auth) {
  const isManager = isCompanyAdmin(auth.user);
  const linkedWorkerIds = new Set(isManager ? db.employmentRelationships
    .filter((item) => item.companyId === auth.company.id && item.verificationStatus === "verified")
    .map((item) => item.workerId) : []);
  const companyUsers = db.users
    .filter((user) => user.companyId === auth.company.id || linkedWorkerIds.has(user.id))
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tasks = db.tasks.filter((task) => canAccessTask(auth, task, db));
  const taskIds = new Set(tasks.map((task) => task.id));
  const workOrderIds = new Set(tasks.map((task) => task.workOrderId));

  let workOrders;
  if (isManager) {
    workOrders = db.workOrders.filter((order) => order.companyId === auth.company.id);
  } else {
    workOrders = db.workOrders.filter((order) => workOrderIds.has(order.id) || canAccessWorkOrder(auth, db, order));
  }

  const visibleOrderIds = new Set(workOrders.map((order) => order.id));
  const punctualitySummaries = PUNCTUALITY_ENABLED ? (isManager
    ? db.employmentRelationships.filter(item => item.companyId === auth.company.id && item.verificationStatus === "verified" && item.employmentStatus === "active")
      .map(item => item.workerId)
    : db.employmentRelationships.filter(item => item.workerId === auth.user.id && item.verificationStatus === "verified")
      .map(item => item.companyId)) : [];
  const punctualityData = PUNCTUALITY_ENABLED ? [...new Set(punctualitySummaries)].map(id => {
    const summary = isManager ? punctuality.snapshot(db, auth.company.id, id) : punctuality.snapshot(db, id, auth.user.id);
    return isManager ? { ...summary, records: summary.records.slice(0, 10), chart: [] } : summary;
  }) : [];
  const evidences = db.evidences.filter((evidence) => {
    if (evidence.taskId && taskIds.has(evidence.taskId)) return true;
    if (evidence.companyId !== auth.company.id) return false;
    return !evidence.taskId && visibleOrderIds.has(evidence.workOrderId);
  });

  const logs = db.auditLogs.filter((entry) => {
    if (auth.user.role !== "worker" && entry.companyId !== auth.company.id) return false;
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
    : db.jobOffers.filter((job) => recruitment.open(job, db.companies.find(c => c.id === job.companyId)) || db.jobApplications.some(a => a.workerId === auth.user.id && a.jobOfferId === job.id));

  const jobApplications = isManager
    ? db.jobApplications.filter((application) => application.companyId === auth.company.id)
    : auth.user.role === "worker"
      ? db.jobApplications.filter((application) => application.workerId === auth.user.id)
      : [];
  const workerProfiles = isManager
    ? db.users
        .filter((user) => user.role === "worker" && recruitment.canDiscover(user, auth.company))
        .map((user) => {
          const profile = publicWorkerProfile(user);
          return { id: profile.id, name: profile.name.split(" ")[0], headline: profile.headline, location: profile.location,
            skills: profile.skills, availability: profile.availability, bio: profile.bio, preferences: { ...profile.preferences, coordinates: undefined } };
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.preferences.available) - Number(a.preferences.available) || a.name.localeCompare(b.name))
    : auth.user.role === "worker"
      ? [publicWorkerProfile(auth.user, { includeUnpublished: true })].filter(Boolean)
      : [];

  return {
    user: publicUser(auth.user),
    company: publicCompany(auth.company),
    users: isManager ? companyUsers : companyUsers.filter((user) => user.id === auth.user.id),
    workOrders: workOrders.map((order) => publicWorkOrder(order, auth)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: tasks.map((task) => publicTask(task, db)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    attendanceAvailable: db.attendanceSchemaReady !== false,
    punctuality: { enabled: PUNCTUALITY_ENABLED && db.attendanceSchemaReady !== false && db.planningSchemaReady !== false,
      rules: isManager ? punctuality.rulesFor(auth.company) : null, summaries: punctualityData },
    planningAvailable: db.planningSchemaReady !== false,
    pendingDayOffCount: isManager ? db.dayOffRequests.filter((item) => item.companyId === auth.company.id && item.status === "pending").length : 0,
    planningWorkers: isManager ? companyUsers.filter((user) => user.role === "worker" && db.employmentRelationships.some((item) =>
      item.companyId === auth.company.id && item.workerId === user.id && item.verificationStatus === "verified" && item.employmentStatus === "active" &&
      (!item.endDate || item.endDate >= portugalToday()))) : [],
    workSchedules: db.workSchedules.filter((item) => item.workDate >= portugalToday() && (isManager ? item.companyId === auth.company.id : item.workerId === auth.user.id))
      .sort((a, b) => a.workDate.localeCompare(b.workDate)),
    planningChanges: isManager ? [] : db.auditLogs.filter((entry) => entry.entityType === "work_schedule" &&
      ["planning.schedule_updated", "planning.schedule_removed"].includes(entry.action) && entry.detail?.workerId === auth.user.id &&
      entry.detail?.workDate >= portugalToday() && Date.parse(entry.createdAt) >= Date.now() - 7 * 86400000)
      .slice(0, 20).map((entry) => ({ id: entry.id, workDate: entry.detail.workDate, action: entry.action, createdAt: entry.createdAt })),
    dayOffRequests: db.dayOffRequests.filter((item) => isManager ? item.companyId === auth.company.id : item.workerId === auth.user.id)
      .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.workDate.localeCompare(a.workDate)).slice(0, 100),
    attendanceEntries: db.attendanceEntries.filter((entry) => isManager ? entry.companyId === auth.company.id : entry.workerId === auth.user.id).sort((a, b) => b.clockedInAt.localeCompare(a.clockedInAt)).slice(0, 100),
    attendanceJustifications: db.attendanceJustifications.filter((item) => isManager ? item.companyId === auth.company.id : item.workerId === auth.user.id).map(({ storedName, ...item }) => ({ ...item, downloadUrl: storedName ? `/api/attendance/justifications/${encodeURIComponent(item.id)}/file` : null })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
    evidences: evidences.map(publicEvidence).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    auditLogs: logs.slice(0, 250),
    invites,
    validationAlerts: isManager ? buildValidationAlerts(db, auth.company.id) : [],
    operationalAlerts: isManager ? buildOperationalAlerts(db, auth.company.id) : [],
    jobOffers: jobOffers.map(publicJobOffer).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    jobApplications: jobApplications
      .map((application) => publicJobApplication(application, db, { includeWorkerProfile: isManager }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    workerProfiles,
    recruitment: recruitmentApi.snapshot(db, auth),
    professional: professionalProfileApi.snapshot(db, auth),
    directChat: directChatApi.snapshot(db, auth),
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
      .map((order) => publicWorkOrder(order))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: db.tasks
      .filter((task) => task.companyId === companyId)
      .map((task) => publicTask(task, db))
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
  const validSignature = mimeType === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mimeType === "image/jpeg" ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (!validSignature) throw Object.assign(new Error("O ficheiro nao corresponde a uma imagem valida."), { status: 400 });
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
    companyId: options.companyId || auth.company.id,
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
    format: "tratapro-evidence-download-v1",
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
    `${PUBLIC_BRAND_NAME} evidence`,
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
  <metadata id="tratapro-evidence-metadata" data-format="application/json">${svgEscape(metadataJson)}</metadata>
  <desc>${svgEscape(`${PUBLIC_BRAND_NAME} evidence ${evidence.id}. Full metadata is embedded in the tratapro-evidence-metadata node.`)}</desc>
  <rect width="1600" height="1200" fill="#111827"/>
  <image href="data:${svgEscape(evidence.mimeType)};base64,${encoded}" x="0" y="0" width="1600" height="1200" preserveAspectRatio="xMidYMid meet"/>
  <rect x="0" y="0" width="1600" height="260" fill="rgba(17,24,39,0.78)"/>
  <g fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${text}</g>
  <text x="800" y="620" fill="rgba(255,255,255,0.22)" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="900" text-anchor="middle" transform="rotate(-28 800 620)">TRATAPRO VERIFIED</text>
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

function completeGoogleAuth(db, googleUser, intent, nif, req) {
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
    const workerNif = requireValidNif(nif);
    assertNifAvailable(db, workerNif);
    company = ensureWorkerPoolCompany(db);
    user = {
      id: nextId(db, "users", "usr"),
      companyId: company.id,
      name: cleanString(googleUser.name || email, 120),
      email,
      nif: workerNif,
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
    jobs: publicOpenJobs(db),
    verifiedCompanies: db.companies.filter(c => c.recruitment?.verification === "verified").map(c => ({ name: c.name, path: publicMarketplace.companyPath(c), logoUrl: c.recruitment?.logo ? `/api/recruitment/company-logo/${encodeURIComponent(c.id)}` : "" })),
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

function publicOpenJobs(db) {
  return (db.jobOffers || [])
    .filter((job) => recruitment.open(job, db.companies.find(c => c.id === job.companyId)))
    .map(job => ({ ...publicJobOffer(job), verified: db.companies.find(c => c.id === job.companyId)?.recruitment?.verification === "verified" }))
    .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
}

function originFromRequest(req) {
  if (PUBLIC_SITE_URL) {
    try {
      return new URL(PUBLIC_SITE_URL).origin;
    } catch {
      // Fall through to the request-derived origin below.
    }
  }
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwardedHost || String(req.headers.host || "localhost:4173").split(",")[0].trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwardedProto || (req.socket?.encrypted ? "https" : "http");
  return `${proto}://${host}`;
}

function absolutePublicUrl(req, pathname = "/") {
  return new URL(pathname, `${originFromRequest(req)}/`).toString();
}

function publicSocialImageUrl(req) {
  return absolutePublicUrl(req, PUBLIC_SOCIAL_IMAGE_PATH);
}

function publicJobPath(job) {
  const slug = `${job.position || job.title}-${job.companyName}-${job.location}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160);
  return `/vagas/${encodeURIComponent(job.id)}-${slug}`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function plainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, max = 155) {
  const text = plainText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function safeDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatPublicDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function jsonLdScript(data) {
  return JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
}

function siteStructuredData(req) {
  const origin = originFromRequest(req);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: PUBLIC_BRAND_NAME,
        url: `${origin}/`,
        logo: absolutePublicUrl(req, "/logo.svg"),
        image: publicSocialImageUrl(req)
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: PUBLIC_BRAND_TITLE,
        alternateName: PUBLIC_BRAND_NAME,
        url: `${origin}/`,
        inLanguage: "pt-PT",
        publisher: { "@id": `${origin}/#organization` }
      }
    ]
  };
}

function isRemoteJob(job) {
  if (job.recruitment?.workMode) return job.recruitment.workMode === "remote";
  return /remoto|remote|teletrabalho/i.test(`${job.location || ""} ${job.description || ""}`);
}

function employmentTypeFromContract(value) {
  const text = plainText(value).toLowerCase();
  if (!text) return "";
  if (text.includes("part") || text.includes("parcial")) return "PART_TIME";
  if (text.includes("full") || text.includes("inteiro") || text.includes("efetivo")) return "FULL_TIME";
  if (text.includes("tempor") || text.includes("sazonal")) return "TEMPORARY";
  if (text.includes("estag")) return "INTERN";
  if (text.includes("contrat") || text.includes("projeto") || text.includes("prestacao")) return "CONTRACTOR";
  return "OTHER";
}

function jobDescriptionForStructuredData(job) {
  return [
    `<p>${htmlEscape(job.description)}</p>`,
    job.requirements ? `<p><strong>Requisitos:</strong> ${htmlEscape(job.requirements)}</p>` : "",
    job.schedule ? `<p><strong>Horario:</strong> ${htmlEscape(job.schedule)}</p>` : "",
    job.salary ? `<p><strong>Remuneracao:</strong> ${htmlEscape(job.salary)}</p>` : ""
  ].filter(Boolean).join("");
}

function jobStructuredData(job, company, req) {
  const title = plainText(job.position || job.title);
  const companyWebsite = safeHttpUrl(company?.website);
  const data = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description: jobDescriptionForStructuredData(job),
    identifier: {
      "@type": "PropertyValue",
      name: job.companyName || company?.name || PUBLIC_BRAND_NAME,
      value: job.id
    },
    datePosted: safeDate(job.createdAt) || now(),
    employmentType: employmentTypeFromContract(job.contractType) || undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyName || company?.name || "Empresa"
    },
    url: absolutePublicUrl(req, publicJobPath(job)),
    industry: company?.sector || undefined
  };
  if (companyWebsite) data.hiringOrganization.sameAs = companyWebsite;
  if (job.recruitment?.deadline) data.validThrough = job.recruitment.deadline;
  if (job.recruitment?.employmentType) data.employmentType = job.recruitment.employmentType;
  if (job.recruitment?.salaryMin != null || job.recruitment?.salaryMax != null) data.baseSalary = { "@type": "MonetaryAmount", currency: "EUR", value: { "@type": "QuantitativeValue", minValue: job.recruitment.salaryMin ?? undefined, maxValue: job.recruitment.salaryMax ?? undefined, unitText: job.recruitment.salaryPeriod || "MONTH" } };
  if (isRemoteJob(job)) {
    data.jobLocationType = "TELECOMMUTE";
    data.applicantLocationRequirements = {
      "@type": "Country",
      name: "Portugal"
    };
  } else {
    data.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
        addressCountry: "PT"
      }
    };
  }
  return JSON.parse(JSON.stringify(data));
}

function seoForPublicPath(pathname, req) {
  if (pathname === "/cliente" || pathname === "/dashboard") {
    return {
      title: `Area do Cliente - ${PUBLIC_BRAND_NAME}`,
      description: "Acesso reservado para cliente e equipa de desenvolvimento acompanharem projeto, MVP e documentacao privada.",
      canonical: absolutePublicUrl(req, "/cliente"),
      robots: "noindex,follow",
      type: "website"
    };
  }
  if (pathname === "/changelog") {
    return {
      title: `Acesso reservado - ${PUBLIC_BRAND_NAME}`,
      description: `Area reservada para acompanhamento privado do projeto ${PUBLIC_BRAND_NAME}.`,
      canonical: absolutePublicUrl(req, "/cliente"),
      robots: "noindex,follow",
      type: "website"
    };
  }
  return {
    title: PUBLIC_BRAND_TITLE,
    description: "Vagas publicas em Portugal para trabalhadores e empresas, com pesquisa por cargo, empresa, localizacao e raio.",
    canonical: absolutePublicUrl(req, "/"),
    robots: "index,follow",
    type: "website"
  };
}

function replaceHeadTag(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function renderPublicIndexHtml(template, req, pathname) {
  const seo = seoForPublicPath(pathname, req);
  const socialImage = publicSocialImageUrl(req);
  const socialImageAlt = `${PUBLIC_BRAND_NAME} - ${PUBLIC_BRAND_SLOGAN}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(seo.title)}</title>`);
  html = replaceHeadTag(
    html,
    /<meta name="description" content="[^"]*">/i,
    `<meta name="description" content="${htmlEscape(seo.description)}">`
  );
  html = replaceHeadTag(html, /<meta name="robots" content="[^"]*">/i, `<meta name="robots" content="${seo.robots}">`);
  html = replaceHeadTag(html, /<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${htmlEscape(seo.title)}">`);
  html = replaceHeadTag(html, /<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${htmlEscape(seo.description)}">`);
  html = replaceHeadTag(html, /<meta property="og:type" content="[^"]*">/i, `<meta property="og:type" content="${seo.type}">`);
  html = replaceHeadTag(html, /<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${htmlEscape(seo.canonical)}">`);
  html = replaceHeadTag(html, /<meta property="og:site_name" content="[^"]*">/i, `<meta property="og:site_name" content="${PUBLIC_BRAND_NAME}">`);
  html = replaceHeadTag(html, /<meta property="og:image" content="[^"]*">/i, `<meta property="og:image" content="${htmlEscape(socialImage)}">`);
  html = replaceHeadTag(html, /<meta property="og:image:secure_url" content="[^"]*">/i, `<meta property="og:image:secure_url" content="${htmlEscape(socialImage)}">`);
  html = replaceHeadTag(html, /<meta property="og:image:type" content="[^"]*">/i, `<meta property="og:image:type" content="image/svg+xml">`);
  html = replaceHeadTag(html, /<meta property="og:image:width" content="[^"]*">/i, `<meta property="og:image:width" content="1200">`);
  html = replaceHeadTag(html, /<meta property="og:image:height" content="[^"]*">/i, `<meta property="og:image:height" content="630">`);
  html = replaceHeadTag(html, /<meta property="og:image:alt" content="[^"]*">/i, `<meta property="og:image:alt" content="${htmlEscape(socialImageAlt)}">`);
  html = replaceHeadTag(html, /<meta name="twitter:card" content="[^"]*">/i, `<meta name="twitter:card" content="summary_large_image">`);
  html = replaceHeadTag(html, /<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${htmlEscape(seo.title)}">`);
  html = replaceHeadTag(html, /<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${htmlEscape(seo.description)}">`);
  html = replaceHeadTag(html, /<meta name="twitter:image" content="[^"]*">/i, `<meta name="twitter:image" content="${htmlEscape(socialImage)}">`);
  html = replaceHeadTag(html, /<meta name="twitter:image:alt" content="[^"]*">/i, `<meta name="twitter:image:alt" content="${htmlEscape(socialImageAlt)}">`);
  html = replaceHeadTag(html, /<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${htmlEscape(seo.canonical)}">`);
  html = replaceHeadTag(
    html,
    /<script type="application\/ld\+json" id="site-structured-data">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" id="site-structured-data">${jsonLdScript(siteStructuredData(req))}</script>`
  );
  return html;
}

function renderPublicTopbarStatic(activePath = "/") {
  return `
      <header class="public-topbar static-topbar">
        <a class="public-brand" href="/" aria-label="${PUBLIC_BRAND_NAME} - ${PUBLIC_BRAND_SLOGAN}">
          <img class="brand-logo-wordmark" src="/logo.svg" alt="${PUBLIC_BRAND_NAME}">
        </a>
        <nav class="public-nav" aria-label="Navegacao principal">
          <a href="/" class="${activePath === "/" ? "active" : ""}">Vagas</a>
          <a href="/#como-funciona">Como funciona</a>
          <a class="public-nav-login" href="/?auth=login#acesso">Entrar</a>
          <a class="public-nav-button" href="/?auth=company#acesso">Publicar vaga</a>
        </nav>
      </header>`;
}

function renderSeoJobPage(job, company, req, related = []) {
  job = { ...job, salary: recruitment.salary(job) };
  const available = recruitment.open(job, company);
  const title = `${plainText(job.position || job.title)} em ${plainText(job.location)} | ${plainText(job.companyName || "Empresa")} | ${PUBLIC_BRAND_NAME}`;
  const description = truncateText(`${job.position || job.title} em ${job.location} na ${job.companyName || "empresa"}. ${job.description}`, 156);
  const canonical = absolutePublicUrl(req, publicJobPath(job));
  const socialImage = publicSocialImageUrl(req);
  const socialImageAlt = `${PUBLIC_BRAND_NAME} - ${PUBLIC_BRAND_SLOGAN}`;
  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${htmlEscape(title)}</title>
    <meta name="description" content="${htmlEscape(description)}">
    <meta name="robots" content="${available ? "index,follow" : "noindex,follow"}">
    <meta name="theme-color" content="#080d17">
    <meta property="og:title" content="${htmlEscape(title)}">
    <meta property="og:description" content="${htmlEscape(description)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${htmlEscape(canonical)}">
    <meta property="og:site_name" content="${PUBLIC_BRAND_NAME}">
    <meta property="og:image" content="${htmlEscape(socialImage)}">
    <meta property="og:image:secure_url" content="${htmlEscape(socialImage)}">
    <meta property="og:image:type" content="image/svg+xml">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${htmlEscape(socialImageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${htmlEscape(title)}">
    <meta name="twitter:description" content="${htmlEscape(description)}">
    <meta name="twitter:image" content="${htmlEscape(socialImage)}">
    <meta name="twitter:image:alt" content="${htmlEscape(socialImageAlt)}">
    <link rel="canonical" href="${htmlEscape(canonical)}">
    <link rel="stylesheet" href="/styles.css?v=${PUBLIC_ASSET_VERSION}">
    ${available ? `<script type="application/ld+json" id="job-structured-data">${jsonLdScript(jobStructuredData(job, company, req))}</script>` : ""}
    <script type="application/ld+json" id="site-structured-data">${jsonLdScript(siteStructuredData(req))}</script>
  </head>
  <body>
    <main class="manifesto-shell seo-shell">
      ${renderPublicTopbarStatic("/")}
      <section class="seo-job-page">
        <a class="seo-back-link" href="/">Voltar as vagas</a>
        <article class="seo-job-hero">
          <p class="eyebrow">${available ? "Vaga aberta" : "Esta vaga ja nao aceita candidaturas."}</p>
          <h1>${htmlEscape(job.position || job.title)}</h1>
          ${job.title !== job.position ? `<p>${htmlEscape(job.title)}</p>` : ""}
          ${job.salary ? `<p class="job-salary">${htmlEscape(job.salary)}</p>` : ""}
          <div class="meta-row">
            <span>${htmlEscape(job.companyName || "Empresa")}${company?.recruitment?.verification === "verified" ? ' <span class="verified-badge" title="Empresa verificada pela TrataPro">Empresa verificada</span>' : ""}</span>
            <span>${htmlEscape(job.location)}</span>
            <span>${htmlEscape(job.contractType || "A combinar")}</span>
            <span>Publicada ${htmlEscape(formatPublicDate(job.createdAt))}</span>
          </div>
          <div class="card-actions">
            ${available ? `<a class="btn accent" href="/?apply=${encodeURIComponent(job.id)}#vagas">Candidatar-me</a>` : ""}
            <a class="btn ghost" href="/">Ver outras vagas</a>
          </div>
        </article>
        <section class="seo-job-layout">
          <article class="seo-job-main">
            <h2>Descricao da vaga</h2>
            <p>${htmlEscape(job.description)}</p>
            ${job.requirements ? `<h2>Requisitos</h2><p>${htmlEscape(job.requirements)}</p>` : ""}
            ${job.recruitment?.benefits ? `<h2>Beneficios</h2><p>${htmlEscape(job.recruitment.benefits)}</p>` : ""}
            ${job.recruitment?.deadline ? `<p>Candidaturas ate ${htmlEscape(formatPublicDate(job.recruitment.deadline))}</p>` : ""}
            ${company ? `<a href="${htmlEscape(publicMarketplace.companyPath(company))}">Conhecer ${htmlEscape(company.name)}</a>` : ""}
            <p><a href="/?report=${encodeURIComponent(job.id)}#vagas">Denunciar vaga</a></p>
          </article>
          <aside class="seo-job-side">
            <h2>Resumo</h2>
            <dl>
              <div><dt>Empresa</dt><dd>${htmlEscape(job.companyName || "Empresa")}</dd></div>
              <div><dt>Localizacao</dt><dd>${htmlEscape(job.location)}</dd></div>
              <div><dt>Contrato</dt><dd>${htmlEscape(job.contractType || "A combinar")}</dd></div>
              ${job.salary ? `<div><dt>Remuneracao</dt><dd>${htmlEscape(job.salary)}</dd></div>` : ""}
              ${job.schedule ? `<div><dt>Horario</dt><dd>${htmlEscape(job.schedule)}</dd></div>` : ""}
            </dl>
          </aside>
        </section>
        ${!available && related.length ? `<section class="market-section"><h2>Vagas semelhantes</h2>${publicMarketplace.cards(related)}</section>` : ""}
        ${available ? `<div class="seo-apply-mobile">${job.salary ? `<span class="job-salary">${htmlEscape(job.salary)}</span>` : ""}<a class="btn primary" href="/?apply=${encodeURIComponent(job.id)}#vagas">Candidatar-me</a></div>` : ""}
      </section>
    </main>
  </body>
</html>`;
}

function renderSeoNotFoundPage(req) {
  const canonical = absolutePublicUrl(req, "/");
  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Vaga nao encontrada | ${PUBLIC_BRAND_NAME}</title>
    <meta name="description" content="A vaga ja nao esta aberta ou nao existe. Consulte as vagas abertas no ${PUBLIC_BRAND_NAME}.">
    <meta name="robots" content="noindex,follow">
    <link rel="canonical" href="${htmlEscape(canonical)}">
    <link rel="stylesheet" href="/styles.css?v=${PUBLIC_ASSET_VERSION}">
  </head>
  <body>
    <main class="manifesto-shell seo-shell">
      ${renderPublicTopbarStatic("/")}
      <section class="seo-job-page">
        <article class="seo-job-hero">
          <p class="eyebrow">Vaga indisponivel</p>
          <h1>Esta vaga ja nao esta aberta.</h1>
          <p>Consulte a lista publica para encontrar vagas ativas.</p>
          <a class="btn primary" href="/">Ver vagas abertas</a>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function renderRobotsTxt(req) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /data/",
    "Disallow: /tmp/",
    "Disallow: /dashboard",
    "Disallow: /cliente",
    "Disallow: /admin",
    "Disallow: /conta",
    `Sitemap: ${absolutePublicUrl(req, "/sitemap.xml")}`,
    ""
  ].join("\n");
}

function renderSitemapXml(req, db) {
  const jobs = publicOpenJobs(db);
  const latest = jobs[0]?.updatedAt || jobs[0]?.createdAt || db.meta?.createdAt || now();
  const entries = [
    { path: "/", lastmod: latest, priority: "1.0" },
    ...db.companies.filter(c => jobs.some(j => j.companyId === c.id)).map(c => ({ path: publicMarketplace.companyPath(c), lastmod: latest, priority: "0.6" })),
    ...publicMarketplace.landings(db).map(page => ({ path: page.path, lastmod: latest, priority: "0.6" })),
    ...jobs.map((job) => ({
      path: publicJobPath(job),
      lastmod: job.updatedAt || job.createdAt || latest,
      priority: "0.8"
    }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <url>
    <loc>${xmlEscape(absolutePublicUrl(req, entry.path))}</loc>
    <lastmod>${xmlEscape(safeDate(entry.lastmod) || now())}</lastmod>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
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
  if (await pushApi.handle(req, res, pathname)) return;
  if (await directChatApi.handle(req, res, pathname)) return;
  if (await professionalProfileApi.handle(req, res, pathname)) return;
  if (await recruitmentApi.handle(req, res, pathname)) return;
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
    const jobAlerts = await mutateDb(db => recruitmentApi.deliverAlerts(db));
    const professionalRetention = await mutateDb(db => professionalProfileApi.maintain(db));
    sendJson(res, 200, {
      ok: true,
      ranAt: now(),
      jobAlerts,
      professionalRetention,
      ...result
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/google/start") {
    const body = await readBody(req);
    const next = safeReturnPath(body.next || "/");
    if (body.intent !== "worker") throw Object.assign(new Error("Google registration intent is invalid."), { status: 400 });
    const nif = requireValidNif(body.nif);
    if (!googleAuthConfigured()) throw Object.assign(new Error("Google login is not configured."), { status: 503 });
    sendJson(res, 200, { authorizationUrl: googleAuthorizationUrl(req, next, "worker") }, { "Set-Cookie": googleRegistrationNifCookie(nif, req) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/google/start") {
    const next = safeReturnPath(url.searchParams.get("next") || "/");
    const intent = "login";
    if (!googleAuthConfigured()) {
      sendRedirect(res, addQueryParam(next, "auth_error", "google_not_configured"));
      return;
    }
    sendRedirect(res, googleAuthorizationUrl(req, next, intent));
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
      const registrationNif = statePayload.intent === "worker"
        ? verifyGoogleRegistrationNif(parseCookies(req)[GOOGLE_REGISTRATION_NIF_COOKIE])
        : "";
      const code = url.searchParams.get("code");
      if (!code) {
        sendRedirect(res, addQueryParam(next, "auth_error", "google_missing_code"));
        return;
      }
      const tokens = await exchangeGoogleCode(req, code);
      const googleUser = await fetchGoogleUser(tokens.access_token);
      const result = await mutateDb((db) => completeGoogleAuth(db, googleUser, statePayload.intent, registrationNif, req));
      sendRedirect(res, addQueryParam(next, "auth", "google"), { "Set-Cookie": [sessionCookie(result.session), clearGoogleRegistrationNifCookie(req)] });
    } catch (error) {
      if (error.status >= 500) console.error(error);
      const code = error.status === 404
        ? "google_account_not_registered"
        : error.status === 403
          ? "google_forbidden"
          : "google_failed";
      sendRedirect(res, addQueryParam(next, "auth_error", code), { "Set-Cookie": clearGoogleRegistrationNifCookie(req) });
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
      const db = await readMarketplaceDb();
      sendJson(res, 200, publicJobsPayload(db));
    } catch (error) {
      if (APP_STORAGE_DRIVER === "supabase") {
        console.error("Public vacancies unavailable", error.message);
        sendJson(res, 503, { error: "Nao foi possivel carregar as vagas. Tente novamente dentro de instantes." });
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
      const nif = requireValidNif(body.nif);
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
      assertNifAvailable(db, nif);
      const company = ensureWorkerPoolCompany(db);
      const user = {
        id: nextId(db, "users", "usr"),
        companyId: company.id,
        name,
        email,
        nif,
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
      const nif = requireValidNif(body.nif);
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
      assertNifAvailable(db, nif);
      const company = {
        id: nextId(db, "companies", "co"),
        name: companyName,
        nif,
        location: cleanString(body.location, 160),
        website: cleanString(body.website, 240),
        sector: cleanString(body.sector, 160),
        description: cleanString(body.description, 1200),
        recruitment: { nif, verification: "pending" },
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

  if (req.method === "GET" && pathname === "/api/operational-alerts") {
    const db = await readDb();
    const auth = requireAuth(db, req);
    requireManager(auth);
    sendJson(res, 200, { alerts: buildOperationalAlerts(db, auth.company.id), pendingDayOffCount: db.dayOffRequests.filter((item) => item.companyId === auth.company.id && item.status === "pending").length });
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
      professionalProfileApi.syncLegacyCv(db, auth.user);
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
      const allowed = recruitment.canReadProfile(db, worker, auth);
      if (!allowed || !cv.profilePhoto?.storedName) {
        const error = new Error("Foto de perfil de trabalhador nao encontrada.");
        error.status = 404;
        throw error;
      }
      return { photo: cv.profilePhoto };
    });
    const buffer = await readPrivateUploadFile(photo.storedName);
    res.writeHead(200, responseHeaders({
      "Content-Type": photo.mimeType,
      "Content-Length": buffer.length,
      "Cache-Control": "private, max-age=120"
    }));
    res.end(buffer);
    return;
  }

  if (req.method === "POST" && pathname === "/api/job-offers") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireCompanyAccount(auth);
      const title = cleanString(body.title, 180);
      if (auth.company.recruitment?.verification === "suspended") throw Object.assign(new Error("Empresa suspensa."), { status: 403 });
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
        recruitment: recruitment.jobDetails(body),
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
      if (auth.company.recruitment?.verification === "suspended") throw Object.assign(new Error("Empresa suspensa."), { status: 403 });
      jobOffer.recruitment = recruitment.jobDetails(body, jobOffer.recruitment);
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
      const jobOffer = db.jobOffers.find((job) => job.id === jobOfferId && recruitment.open(job, db.companies.find(c => c.id === job.companyId)));
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
        recruitment: { answers: recruitment.answers(jobOffer, body.answers), history: [{ status: "submitted", at: now() }] },
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
      if (!recruitment.STAGES.includes(status)) {
        const error = new Error("Invalid application status.");
        error.status = 400;
        throw error;
      }
      application.status = status;
      application.decisionReason = cleanString(body.decisionReason, 1000);
      application.updatedAt = now();
      application.recruitment = { ...application.recruitment, history: [...(application.recruitment?.history || []), { status, at: now() }].slice(-100) };
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

  if (req.method === "PUT" && pathname === "/api/planning/schedules") {
    const body = await readBody(req);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      if (db.planningSchemaReady === false) throw Object.assign(new Error("A migração do planeamento ainda não foi aplicada."), { status: 503 });
      if (APP_STORAGE_DRIVER === "supabase") {
        try {
          await supabaseRest("meo_work_schedules?select=task_id&limit=0");
        } catch (error) {
          if (/task_id|PGRST205|42703/.test(error.message)) {
            throw Object.assign(new Error("A migração que liga o planeamento às tarefas ainda não foi aplicada."), { status: 503 });
          }
          throw error;
        }
      }
      const workerId = cleanString(body.workerId, 80);
      const workDate = workOrderDate(body.workDate);
      const startTime = cleanString(body.startTime, 5);
      const taskId = cleanString(body.taskId, 80);
      const note = cleanString(body.note, 500);
      const employment = workDate && activePlanningEmployment(db, auth.company.id, workerId, workDate);
      if (!employment || workDate < portugalToday()) throw Object.assign(new Error("Escolha um trabalhador com vínculo ativo e uma data presente ou futura."), { status: 400 });
      if (portugalDayStartMs(workDate) > Date.now() + 90 * 86400000) throw Object.assign(new Error("Planeie até 90 dias de antecedência."), { status: 400 });
      const existing = db.workSchedules.find((item) => item.companyId === auth.company.id && item.workerId === workerId && item.workDate === workDate);
      let notifyWorker = false;
      if (!startTime && !taskId && !note) {
        if (existing) {
          db.workSchedules = db.workSchedules.filter((item) => item.id !== existing.id);
          audit(db, auth, "work_schedule", existing.id, "planning.schedule_removed", { workerId, workDate, previous: {
            taskId: existing.taskId, startTime: existing.startTime, firstPublishedStartAt: existing.firstPublishedStartAt,
            address: existing.address, note: existing.note
          } }, req);
          notifyWorker = true;
        }
      } else {
        const task = db.tasks.find((item) => item.id === taskId && item.companyId === auth.company.id && item.assigneeId === workerId);
        const order = task && db.workOrders.find((item) => item.id === task.workOrderId && item.companyId === auth.company.id);
        const address = cleanString(task?.workAddress || order?.address, 500);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !task || !address || ["approved", "rejected"].includes(task.status)) {
          throw Object.assign(new Error("Escolha uma tarefa ativa deste trabalhador, com morada, e uma hora válida."), { status: 400 });
        }
        if (db.dayOffRequests.some((item) => item.companyId === auth.company.id && item.workerId === workerId && item.workDate === workDate && item.status === "approved")) {
          throw Object.assign(new Error("Este dia já tem uma folga aprovada."), { status: 409 });
        }
        if (!existing || existing.taskId !== taskId || existing.startTime !== startTime || existing.address !== address || existing.note !== note) {
          const timestamp = now();
          const previous = existing ? { taskId: existing.taskId, startTime: existing.startTime, address: existing.address, note: existing.note } : null;
          if (existing) Object.assign(existing, { employmentId: employment.id, taskId, startTime, address, note, updatedAt: timestamp });
          else db.workSchedules.push({ id: nextId(db, "workSchedules", "sched"), companyId: auth.company.id, workerId, employmentId: employment.id,
            taskId, workDate, startTime, firstPublishedStartAt: PUNCTUALITY_ENABLED ? punctuality.localStart(workDate, startTime) : null,
            address, note, createdBy: auth.user.id, createdAt: timestamp, updatedAt: timestamp });
          audit(db, auth, "work_schedule", existing?.id || db.workSchedules.at(-1).id, existing ? "planning.schedule_updated" : "planning.schedule_created", { workerId, workDate, startTime, taskId, address, previous }, req);
          notifyWorker = Boolean(existing);
        }
      }
      return { bootstrap: buildBootstrap(db, auth), notifyWorker };
    });
    if (result.notifyWorker) await pushApi.sendToUsers([body.workerId], "schedule");
    delete result.notifyWorker;
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/planning/day-off") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireWorker(auth);
      if (db.planningSchemaReady === false) throw Object.assign(new Error("A migração do planeamento ainda não foi aplicada."), { status: 503 });
      const workDate = workOrderDate(body.workDate);
      const employment = db.employmentRelationships.find((item) => item.id === body.employmentId && item.workerId === auth.user.id &&
        item.verificationStatus === "verified" && item.employmentStatus === "active" && workDate && item.startDate <= workDate && (!item.endDate || item.endDate >= workDate));
      if (!employment) throw Object.assign(new Error("Escolha uma data dentro de um vínculo ativo."), { status: 400 });
      if (portugalDayStartMs(workDate) - Date.now() < 24 * 60 * 60 * 1000) {
        throw Object.assign(new Error("Peça a folga pelo menos 24 horas antes do início desse dia (hora de Portugal)."), { status: 400 });
      }
      if (portugalDayStartMs(workDate) > Date.now() + 90 * 86400000) throw Object.assign(new Error("Peça folgas até 90 dias de antecedência."), { status: 400 });
      if (db.dayOffRequests.some((item) => item.companyId === employment.companyId && item.workerId === auth.user.id && item.workDate === workDate && ["pending", "approved"].includes(item.status))) {
        throw Object.assign(new Error("Já existe um pedido pendente ou aprovado para esse dia."), { status: 409 });
      }
      const item = { id: nextId(db, "dayOffRequests", "off"), companyId: employment.companyId, workerId: auth.user.id,
        employmentId: employment.id, workDate, reason: cleanString(body.reason, 500), status: "pending", requestedAt: now(), decidedAt: null, decidedBy: null, decisionNote: "" };
      db.dayOffRequests.push(item);
      audit(db, { ...auth, company: { ...auth.company, id: employment.companyId } }, "day_off_request", item.id, "planning.day_off_requested", { workDate }, req);
      return { companyId: employment.companyId, bootstrap: buildBootstrap(db, auth) };
    });
    const db = await readDb();
    await pushApi.sendToUsers(db.users.filter(user => user.companyId === result.companyId && user.active !== false && isCompanyAdmin(user)).map(user => user.id), "dayOffRequest");
    delete result.companyId;
    sendJson(res, 201, result);
    return;
  }

  const dayOffDecisionMatch = pathname.match(/^\/api\/planning\/day-off\/([^/]+)\/decision$/);
  if (req.method === "POST" && dayOffDecisionMatch) {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      if (db.planningSchemaReady === false) throw Object.assign(new Error("A migração do planeamento ainda não foi aplicada."), { status: 503 });
      const item = db.dayOffRequests.find((request) => request.id === decodeURIComponent(dayOffDecisionMatch[1]) && request.companyId === auth.company.id);
      if (!item) throw Object.assign(new Error("Pedido não encontrado."), { status: 404 });
      if (item.status !== "pending") throw Object.assign(new Error("Este pedido já foi decidido."), { status: 409 });
      if (!["approved", "rejected"].includes(body.decision)) throw Object.assign(new Error("Decisão inválida."), { status: 400 });
      item.status = body.decision;
      item.decidedAt = now();
      item.decidedBy = auth.user.id;
      item.decisionNote = cleanString(body.note, 500);
      if (item.status === "approved") {
        const previous = db.workSchedules.find((slot) => slot.companyId === item.companyId && slot.workerId === item.workerId && slot.workDate === item.workDate);
        if (previous) {
          db.workSchedules = db.workSchedules.filter((slot) => slot.id !== previous.id);
          audit(db, auth, "work_schedule", previous.id, "planning.schedule_removed_for_day_off", { workerId: item.workerId, workDate: item.workDate }, req);
        }
      }
      audit(db, auth, "day_off_request", item.id, `planning.day_off_${item.status}`, { workerId: item.workerId, workDate: item.workDate, note: item.decisionNote }, req);
      return { bootstrap: buildBootstrap(db, auth) };
    });
    const decidedRequest = result.bootstrap.dayOffRequests.find(item => item.id === decodeURIComponent(dayOffDecisionMatch[1]));
    if (decidedRequest) await pushApi.sendToUsers([decidedRequest.workerId], "dayOff");
    sendJson(res, 200, result);
    return;
  }

  const clockMatch = pathname.match(/^\/api\/attendance\/tasks\/([^/]+)\/(clock-in|clock-out)$/);
  if (req.method === "POST" && clockMatch) {
    const taskId = decodeURIComponent(clockMatch[1]);
    const action = clockMatch[2];
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireWorker(auth);
      if (db.attendanceSchemaReady === false) throw Object.assign(new Error("O registo horário ainda não está disponível. A migração da base de dados está pendente."), { status: 503 });
      const task = db.tasks.find((item) => item.id === taskId);
      const employment = task ? verifiedTaskEmployment(db, task.companyId, auth.user.id, task.employmentId) : null;
      if (!task || !canAccessTask(auth, task, db) || !employment) {
        throw Object.assign(new Error("Tarefa não encontrada ou vínculo não confirmado."), { status: 404 });
      }
      const open = db.attendanceEntries.find((entry) => entry.workerId === auth.user.id && !entry.clockedOutAt);
      if (action === "clock-in") {
        if (employment.employmentStatus !== "active" || employment.startDate > portugalToday() || (employment.endDate && employment.endDate < portugalToday())) {
          throw Object.assign(new Error("O vínculo não está ativo nesta data."), { status: 403 });
        }
        if (open) throw Object.assign(new Error("Já existe uma entrada aberta. Registe primeiro a saída."), { status: 409 });
        if (["approved", "pending_validation"].includes(task.status)) throw Object.assign(new Error("Esta tarefa já não aceita entradas."), { status: 409 });
        const clockedInAt = now();
        const entry = { id: nextId(db, "attendanceEntries", "att"), companyId: task.companyId, workerId: auth.user.id,
          taskId: task.id, workOrderId: task.workOrderId, clockedInAt, clockedOutAt: null,
          punctuality: PUNCTUALITY_ENABLED ? punctuality.punctualityForClockIn(db, task, auth.user.id, clockedInAt) : null,
          createdAt: clockedInAt };
        db.attendanceEntries.push(entry);
        audit(db, taskScopedAuth(auth, task), "attendance", entry.id, "attendance.clocked_in", { taskId }, req);
      } else {
        if (!open || open.taskId !== taskId) throw Object.assign(new Error("Não existe uma entrada aberta para esta tarefa."), { status: 409 });
        open.clockedOutAt = now();
        audit(db, taskScopedAuth(auth, task), "attendance", open.id, "attendance.clocked_out", { taskId }, req);
      }
      return { bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && pathname === "/api/attendance/justifications") {
    const body = await readBody(req, MAX_UPLOAD_BYTES * 2);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      requireWorker(auth);
      if (db.attendanceSchemaReady === false) throw Object.assign(new Error("As justificações ainda não estão disponíveis. A migração da base de dados está pendente."), { status: 503 });
      const employment = db.employmentRelationships.find((item) => item.id === body.employmentId && item.workerId === auth.user.id && item.verificationStatus === "verified");
      if (!employment) throw Object.assign(new Error("Vínculo de emprego não encontrado."), { status: 404 });
      const absenceDate = workOrderDate(body.absenceDate);
      const reason = cleanString(body.reason, 1200);
      const todayPortugal = portugalToday();
      if (!absenceDate || absenceDate > todayPortugal || absenceDate < employment.startDate || (employment.endDate && absenceDate > employment.endDate)) {
        throw Object.assign(new Error("A data deve pertencer ao período do vínculo confirmado."), { status: 400 });
      }
      let upload = null;
      if (body.document) {
        const match = String(body.document.dataUrl || "").match(/^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw Object.assign(new Error("Anexe apenas PDF, PNG ou JPEG."), { status: 400 });
        const buffer = Buffer.from(match[2], "base64");
        const valid = match[1] === "application/pdf" ? buffer.subarray(0, 5).toString() === "%PDF-" :
          match[1] === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
            buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
        if (!valid || !buffer.length || buffer.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error("O documento é inválido ou excede o limite de tamanho."), { status: 400 });
        upload = { buffer, mimeType: match[1], name: cleanString(body.document.name, 160) || "documento" };
      }
      if (!reason && !upload) throw Object.assign(new Error("Escreva o motivo ou anexe um documento."), { status: 400 });
      const kind = PUNCTUALITY_ENABLED ? cleanString(body.kind || "absence", 40) : "absence";
      if (!["absence", "late_arrival", "forgotten_clock_in", "technical_failure", "discrepancy"].includes(kind)) {
        throw Object.assign(new Error("Escolha um tipo de justificação válido."), { status: 400 });
      }
      const id = nextId(db, "attendanceJustifications", "just");
      const storedName = upload ? `attendance/${id}.${upload.mimeType === "application/pdf" ? "pdf" : upload.mimeType === "image/png" ? "png" : "jpg"}` : null;
      if (upload) await savePrivateUploadFile(storedName, upload.mimeType, upload.buffer);
      const item = { id, companyId: employment.companyId, workerId: auth.user.id, employmentId: employment.id,
        absenceDate, kind, status: "pending", reason, originalName: upload?.name || "", mimeType: upload?.mimeType || "", storedName,
        decidedAt: null, decidedBy: null, decisionReason: "", createdAt: now() };
      db.attendanceJustifications.push(item);
      audit(db, { ...auth, company: { ...auth.company, id: employment.companyId } }, "attendance_justification", id, "attendance.justification_submitted", { absenceDate, kind, hasDocument: Boolean(upload) }, req);
      return { bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 201, result);
    return;
  }

  const justificationDecisionMatch = pathname.match(/^\/api\/attendance\/justifications\/([^/]+)\/decision$/);
  if (req.method === "POST" && justificationDecisionMatch) {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      if (!PUNCTUALITY_ENABLED) throw Object.assign(new Error("A classificação de pontualidade ainda não está ativa."), { status: 503 });
      const item = db.attendanceJustifications.find(record => record.id === decodeURIComponent(justificationDecisionMatch[1]) && record.companyId === auth.company.id);
      if (!item) throw Object.assign(new Error("Justificação não encontrada."), { status: 404 });
      if (item.status !== "pending") throw Object.assign(new Error("Esta justificação já foi decidida."), { status: 409 });
      const decision = cleanString(body.decision, 20);
      const decisionReason = cleanString(body.reason, 1200);
      if (!["approved", "rejected"].includes(decision) || (decision === "rejected" && !decisionReason)) {
        throw Object.assign(new Error("Indique a decisão e, ao recusar, uma razão concreta."), { status: 400 });
      }
      Object.assign(item, { status: decision, decisionReason, decidedBy: auth.user.id, decidedAt: now() });
      audit(db, auth, "attendance_justification", item.id, "attendance.justification_decided", { workerId: item.workerId, workDate: item.absenceDate, kind: item.kind, decision, decisionReason }, req);
      return { bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const attendanceCorrectionMatch = pathname.match(/^\/api\/attendance\/entries\/([^/]+)\/correct$/);
  if (req.method === "POST" && attendanceCorrectionMatch) {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      if (!PUNCTUALITY_ENABLED) throw Object.assign(new Error("A classificação de pontualidade ainda não está ativa."), { status: 503 });
      const entry = db.attendanceEntries.find(record => record.id === decodeURIComponent(attendanceCorrectionMatch[1]) && record.companyId === auth.company.id);
      if (!entry) throw Object.assign(new Error("Registo de entrada não encontrado."), { status: 404 });
      const localInput = String(body.clockedInAt || "");
      const correctedIso = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(localInput)
        ? punctuality.localStart(localInput.slice(0, 10), localInput.slice(11)) : null;
      const correctedAt = new Date(correctedIso || "");
      const reason = cleanString(body.reason, 1200);
      if (!Number.isFinite(correctedAt.getTime()) || correctedAt.getTime() > Date.now() || !reason) {
        throw Object.assign(new Error("Indique uma hora de entrada válida, não futura, e a razão da correção."), { status: 400 });
      }
      if (entry.clockedOutAt && correctedAt.getTime() > Date.parse(entry.clockedOutAt)) {
        throw Object.assign(new Error("A entrada corrigida não pode ser posterior à saída."), { status: 400 });
      }
      const originalAt = entry.clockedInAt;
      if (correctedAt.toISOString() === originalAt) {
        throw Object.assign(new Error("A hora corrigida é igual à hora já registada."), { status: 400 });
      }
      const originalPunctuality = entry.punctuality ? { ...entry.punctuality } : null;
      entry.clockedInAt = correctedAt.toISOString();
      const affectedEntryIds = punctuality.reconcileShiftRecords(db, entry.companyId, entry.workerId, entry.punctuality?.scheduleId);
      audit(db, auth, "attendance", entry.id, "attendance.clock_in_corrected", { workerId: entry.workerId, originalAt, correctedAt: entry.clockedInAt, originalPunctuality, affectedEntryIds, reason }, req);
      return { bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "PUT" && pathname === "/api/punctuality/rules") {
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      if (!PUNCTUALITY_ENABLED) throw Object.assign(new Error("A classificação de pontualidade ainda não está ativa."), { status: 503 });
      const previous = punctuality.rulesFor(auth.company);
      const next = punctuality.validateRules(body, previous);
      auth.company.punctualityConfig = next;
      audit(db, auth, "company", auth.company.id, "punctuality.rules_changed", { previous, next }, req);
      return { bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const justificationFileMatch = pathname.match(/^\/api\/attendance\/justifications\/([^/]+)\/file$/);
  if (req.method === "GET" && justificationFileMatch) {
    const db = await readDb();
    const auth = requireAuth(db, req);
    const item = db.attendanceJustifications.find((record) => record.id === decodeURIComponent(justificationFileMatch[1]));
    if (!item || !item.storedName || !(item.workerId === auth.user.id || (isCompanyAdmin(auth.user) && item.companyId === auth.company.id))) {
      throw Object.assign(new Error("Documento não encontrado."), { status: 404 });
    }
    const buffer = await readPrivateUploadFile(item.storedName);
    await mutateDb((latest) => {
      const viewer = requireAuth(latest, req);
      const current = latest.attendanceJustifications.find((record) => record.id === item.id);
      if (!current || !(current.workerId === viewer.user.id || (isCompanyAdmin(viewer.user) && current.companyId === viewer.company.id))) {
        throw Object.assign(new Error("Documento não encontrado."), { status: 404 });
      }
      audit(latest, { ...viewer, company: { ...viewer.company, id: current.companyId } }, "attendance_justification", current.id, "attendance.justification_file_viewed", {}, req);
    });
    res.writeHead(200, { "Content-Type": item.mimeType, "Content-Disposition": "attachment; filename=documento-justificacao", "Cache-Control": "private, no-store", "Content-Length": buffer.length, "X-Content-Type-Options": "nosniff" });
    res.end(buffer);
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
      const expectedStartDate = workOrderDate(body.expectedStartDate);
      const expectedEndDate = workOrderDate(body.expectedEndDate);
      if (!title || !address || !description || !expectedStartDate || !expectedEndDate || expectedEndDate < expectedStartDate) {
        const error = new Error("Indique título, morada, descrição breve e datas previstas válidas, com o fim igual ou posterior ao início.");
        error.status = 400;
        throw error;
      }
      const assignedUserIds = validatedWorkOrderAssignees(db, auth.company.id, body.assignedUserIds);
      const requestedTask = body.task && typeof body.task === "object" ? body.task : null;
      let taskPlan = null;
      if (requestedTask) {
        const taskTitle = cleanString(requestedTask.title, 180);
        const dueDate = workOrderDate(requestedTask.dueDate);
        const scheduledStartAt = normalizeTimestamp(requestedTask.scheduledStartAt).value;
        const scheduledStartDate = requestedTask.scheduledStartDate ? workOrderDate(requestedTask.scheduledStartDate) : scheduledStartAt?.slice(0, 10);
        const workAddress = cleanString(requestedTask.workAddress || address, 500);
        const workLocation = normalizeLocation(requestedTask.workLocation);
        if (!taskTitle || !dueDate || !scheduledStartAt || !scheduledStartDate || !workAddress || dueDate < expectedStartDate || dueDate > expectedEndDate ||
          scheduledStartDate < expectedStartDate || scheduledStartDate > dueDate ||
          (requestedTask.workLocation?.status === "granted" && workLocation.status !== "granted")) {
          const error = new Error("Preencha o título, início, prazo e morada da tarefa com datas e coordenadas válidas.");
          error.status = 400;
          throw error;
        }
        taskPlan = { title: taskTitle, dueDate, scheduledStartAt, workAddress, workLocation,
          description: cleanString(requestedTask.description, 2000), planningNotes: cleanString(requestedTask.planningNotes, 2000) };
      }
      const order = {
        id: nextId(db, "workOrders", "wo"),
        companyId: auth.company.id,
        title,
        address,
        description,
        assignedUserIds,
        expectedStartDate,
        expectedEndDate,
        status: "planned",
        statusReason: "",
        actualStartedAt: null,
        actualCompletedAt: null,
        createdBy: auth.user.id,
        createdAt: now(),
        updatedAt: now()
      };
      db.workOrders.push(order);
      const createdTasks = [];
      if (taskPlan) {
        for (const assigneeId of assignedUserIds) {
          const assignee = db.users.find((item) => item.id === assigneeId);
          const employment = assignee.role === "worker" ? verifiedTaskEmployment(db, auth.company.id, assigneeId) : null;
          const task = { id: nextId(db, "tasks", "task"), companyId: auth.company.id, workOrderId: order.id,
            ...taskPlan, assigneeId, assigneeName: assignee.name, employmentId: employment?.id || null,
            status: "assigned", blockReason: "", validationComment: "", createdBy: auth.user.id,
            createdAt: now(), updatedAt: now(), startedAt: null, completedAt: null, validationDueAt: null, approvedAt: null, rejectedAt: null };
          db.tasks.push(task);
          createdTasks.push(task);
          audit(db, auth, "task", task.id, "task.created", { workOrderId: order.id, assigneeId, dueDate: task.dueDate }, req);
        }
      }
      const photos = Array.isArray(body.photos) ? body.photos.slice(0, 4) : [];
      for (const photo of photos) {
        await storePhoto(db, auth, { photo, note: "Initial work order photo" }, {
          kind: "initial_photo",
          workOrderId: order.id,
          taskId: null,
          req
        });
      }
      audit(db, auth, "work_order", order.id, "work_order.created", { title, address, assignedUserIds, expectedStartDate, expectedEndDate }, req);
      return { workOrder: publicWorkOrder(order), tasks: createdTasks.map((task) => publicTask(task, db)), bootstrap: buildBootstrap(db, auth) };
    });
    await pushApi.sendToUsers(result.workOrder.assignedUserIds, "assignment");
    sendJson(res, 201, result);
    return;
  }

  const workOrderStatusMatch = pathname.match(/^\/api\/work-orders\/([^/]+)\/status$/);
  if (req.method === "PATCH" && workOrderStatusMatch) {
    const orderId = decodeURIComponent(workOrderStatusMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb((db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const order = db.workOrders.find((item) => item.id === orderId);
      assertSameCompany(auth, order);
      const currentStatus = WORK_ORDER_STATUSES.has(order.status) ? order.status : "planned";
      const nextStatus = cleanString(body.status, 40);
      if (!WORK_ORDER_NEXT_STATUSES[currentStatus].includes(nextStatus)) {
        const error = new Error("Esta mudança de estado da ordem não é permitida.");
        error.status = 400;
        throw error;
      }
      const reason = cleanString(body.reason, 1000);
      if (["blocked", "rejected"].includes(nextStatus) && !reason) {
        const error = new Error("Indique a razão do contratempo ou da rejeição.");
        error.status = 400;
        throw error;
      }
      order.status = nextStatus;
      order.statusReason = ["blocked", "rejected"].includes(nextStatus) ? reason : "";
      if (nextStatus === "in_progress" && !order.actualStartedAt) order.actualStartedAt = now();
      if (nextStatus === "pending_validation") order.actualCompletedAt = now();
      if (nextStatus === "rejected") order.actualCompletedAt = null;
      order.updatedAt = now();
      audit(db, auth, "work_order", order.id, "work_order.status_changed", { from: currentStatus, to: nextStatus, reason }, req);
      return { workOrder: publicWorkOrder(order), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
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
      if (!assignee) {
        const error = new Error("Trabalhador nao encontrado.");
        error.status = 404;
        throw error;
      }
      let employment = null;
      if (assignee.role === "worker") {
        employment = verifiedTaskEmployment(db, auth.company.id, assignee.id);
        if (!employment) {
          const error = new Error("A empresa so pode atribuir tarefas a trabalhadores com vinculo verificado.");
          error.status = 403;
          throw error;
        }
      } else {
        assertSameCompany(auth, assignee);
      }
      if (!["employee", "contractor", "worker"].includes(assignee.role)) {
        const error = new Error("A tarefa tem de ser atribuida a um trabalhador autorizado.");
        error.status = 400;
        throw error;
      }
      const title = cleanString(body.title, 180);
      const description = cleanString(body.description, 2000);
      const dueDate = cleanString(body.dueDate, 40);
      const scheduledStartAt = body.scheduledStartAt ? normalizeTimestamp(body.scheduledStartAt).value : null;
      const planningNotes = cleanString(body.planningNotes, 2000);
      const workAddress = cleanString(body.workAddress || workOrder.address, 500);
      const workLocation = normalizeLocation(body.workLocation);
      if (body.scheduledStartAt && !scheduledStartAt) {
        const error = new Error("A data e hora de inicio nao sao validas.");
        error.status = 400;
        throw error;
      }
      if (workLocation.status === "unavailable" && body.workLocation?.status === "granted") {
        const error = new Error("As coordenadas GPS do local de trabalho nao sao validas.");
        error.status = 400;
        throw error;
      }
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
        employmentId: employment?.id || null,
        scheduledStartAt,
        planningNotes,
        workAddress,
        workLocation,
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
      if (!Array.isArray(workOrder.assignedUserIds)) workOrder.assignedUserIds = [];
      if (!workOrder.assignedUserIds.includes(assignee.id)) {
        if (workOrder.assignedUserIds.length >= 20) {
          const error = new Error("A ordem já tem o limite de 20 pessoas atribuídas.");
          error.status = 400;
          throw error;
        }
        workOrder.assignedUserIds.push(assignee.id);
        audit(db, auth, "work_order", workOrder.id, "work_order.team_extended", { assigneeId: assignee.id, taskId: task.id }, req);
      }
      workOrder.updatedAt = now();
      audit(db, auth, "task", task.id, "task.created", {
        title,
        workOrderId: workOrder.id,
        assigneeId: assignee.id,
        employmentId: employment?.id || null,
        scheduledStartAt,
        workAddress,
        dueDate
      }, req);
      return { task: publicTask(task, db), bootstrap: buildBootstrap(db, auth) };
    });
    await pushApi.sendToUsers([result.task.assigneeId], "assignment");
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
      if (!canAccessTask(auth, task, db)) {
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
          companyId: task.companyId,
          requireGps: true,
          req
        });
        stored.push(evidence);
        audit(db, taskScopedAuth(auth, task), "evidence", evidence.id, "evidence.created", {
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
      if (!canAccessTask(auth, task, db)) {
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
      if (task.status === "blocked") {
        const error = new Error("A empresa tem de registar a resolução do contratempo antes de a tarefa prosseguir.");
        error.status = 409;
        throw error;
      }
      if (nextStatus === "blocked") {
        const reason = cleanString(body.blockReason, 1000);
        if (!reason) {
          const error = new Error("É obrigatório indicar a razão do contratempo.");
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
      audit(db, taskScopedAuth(auth, task), "task", task.id, "task.status_changed", {
        status: nextStatus,
        blockReason: nextStatus === "blocked" ? task.blockReason : ""
      }, req);
      return { task: publicTask(task, db), bootstrap: buildBootstrap(db, auth) };
    });
    if (result.task?.status === "blocked") {
      const db = await readDb();
      await pushApi.sendToUsers(db.users.filter(user => user.companyId === result.task.companyId && user.active !== false && isCompanyAdmin(user)).map(user => user.id), "setback");
    }
    sendJson(res, 200, result);
    return;
  }

  const resolveSetbackMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/resolve-setback$/);
  if (req.method === "POST" && resolveSetbackMatch) {
    const taskId = decodeURIComponent(resolveSetbackMatch[1]);
    const body = await readBody(req);
    const result = await mutateDb(async (db) => {
      const auth = requireAuth(db, req);
      requireManager(auth);
      const task = db.tasks.find((item) => item.id === taskId);
      assertSameCompany(auth, task);
      if (task.status !== "blocked") {
        const error = new Error("Esta tarefa não tem um contratempo ativo para resolver.");
        error.status = 409;
        throw error;
      }
      const resolution = cleanString(body.resolution, 1000);
      if (resolution.length < 10) {
        const error = new Error("Descreva a resolução do contratempo com pelo menos 10 caracteres.");
        error.status = 400;
        throw error;
      }
      const reportedReason = task.blockReason;
      task.status = task.startedAt ? "in_progress" : "assigned";
      task.blockReason = "";
      task.updatedAt = now();
      audit(db, auth, "task", task.id, "task.setback_resolved", {
        reportedReason,
        resolution,
        status: task.status
      }, req);
      return { task: publicTask(task, db), bootstrap: buildBootstrap(db, auth) };
    });
    await pushApi.sendToUsers([result.task.assigneeId], "resolution");
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
      return { task: publicTask(task, db), bootstrap: buildBootstrap(db, auth) };
    });
    sendJson(res, 200, result);
    return;
  }

  const fileMatch = pathname.match(/^\/api\/evidence\/([^/]+)\/file$/);
  if (req.method === "GET" && fileMatch) {
    const evidenceId = decodeURIComponent(fileMatch[1]);
    const { evidence } = await withMaintainedAuth(req, (db, auth) => {
      const evidence = db.evidences.find((item) => item.id === evidenceId);
      if (!evidence) {
        const error = new Error("Evidence not found.");
        error.status = 404;
        throw error;
      }
      let allowed = false;
      if (evidence.taskId) {
        const task = db.tasks.find((item) => item.id === evidence.taskId);
        allowed = canAccessTask(auth, task, db);
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
    res.writeHead(200, responseHeaders({
      "Content-Type": evidence.mimeType,
      "Content-Length": buffer.length,
      "Cache-Control": "private, max-age=120"
    }));
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
      if (!evidence) {
        const error = new Error("Evidence not found.");
        error.status = 404;
        throw error;
      }
      const task = evidence.taskId ? db.tasks.find((item) => item.id === evidence.taskId) : null;
      const order = db.workOrders.find((item) => item.id === evidence.workOrderId);
      const allowed = evidence.taskId ? canAccessTask(auth, task, db) : canAccessWorkOrder(auth, db, order);
      if (!allowed) {
        const error = new Error("Evidence not found.");
        error.status = 404;
        throw error;
      }
      audit(db, taskScopedAuth(auth, task), "evidence", evidence.id, "evidence.watermarked_downloaded", {
        taskId: evidence.taskId || null,
        workOrderId: evidence.workOrderId || null
      }, req);
      return { evidence, task, order };
    });
    const source = await readEvidenceFile(context.evidence);
    const watermarked = buildWatermarkedEvidenceSvg(context.evidence, context.task, context.order, source);
    const filename = `${safeFileName(context.evidence.id)}-watermarked.svg`;
    res.writeHead(200, responseHeaders({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Length": watermarked.length,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store"
    }));
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
        workOrders: db.workOrders.filter((item) => item.companyId === companyId).map((order) => publicWorkOrder(order)),
        tasks: db.tasks.filter((item) => item.companyId === companyId).map((task) => publicTask(task, db)),
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
  let filePath = path.resolve(PUBLIC_DIR, normalized);
  const publicRoot = path.resolve(PUBLIC_DIR);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
    sendText(res, 403, "Forbidden", "text/plain; charset=utf-8", { "X-Robots-Tag": "noindex, nofollow" });
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (!PUBLIC_SHELL_PATHS.has(pathname)) {
      sendHtml(res, 404, renderSeoNotFoundPage(req), { "X-Robots-Tag": "noindex, follow" });
      return;
    }
    filePath = path.join(PUBLIC_DIR, "index.html");
  }
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const compressible = ext === ".js" || ext === ".css";
  let cached;
  if (compressible) {
    const stat = fs.statSync(filePath);
    cached = staticAssetCache.get(filePath);
    if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
      cached = { mtimeMs: stat.mtimeMs, size: stat.size, body: await fsp.readFile(filePath) };
      staticAssetCache.set(filePath, cached);
    }
  }
  let body = cached ? cached.body : await fsp.readFile(filePath);
  if (fileName === "index.html" && ["/", "/index.html"].includes(pathname)) {
    const db = await readMarketplaceDb();
    body = Buffer.from(body.toString("utf8").replace(/<div id="app" class="app-shell">[\s\S]*?<script src=/, `<div id="app" class="app-shell">${publicMarketplace.home(db, req)}</div>\n    <script src=`));
  }
  let responseBody = fileName === "index.html"
    ? Buffer.from(renderPublicIndexHtml(body.toString("utf8"), req, pathname))
    : body;
  let contentEncoding;
  if (compressible && responseBody.length > 1024) {
    const accepted = String(req.headers["accept-encoding"] || "");
    const allows = (name) => accepted.split(",").some((part) => {
      const [encoding, ...parameters] = part.trim().split(";").map((value) => value.trim().toLowerCase());
      const quality = parameters.find((value) => value.startsWith("q="));
      return encoding === name && (!quality || Number(quality.slice(2)) > 0);
    });
    if (allows("br")) contentEncoding = "br";
    else if (allows("gzip")) contentEncoding = "gzip";
    if (contentEncoding) {
      if (!cached[contentEncoding]) cached[contentEncoding] = contentEncoding === "br"
        ? zlib.brotliCompressSync(responseBody)
        : zlib.gzipSync(responseBody);
      responseBody = cached[contentEncoding];
    }
  }
  const version = new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("v");
  const versionedAsset = compressible && /^[a-zA-Z0-9._-]{1,80}$/.test(version || "");
  const cacheControl =
    versionedAsset ? "public, max-age=31536000, immutable" :
    [".html", ".js", ".css", ".webmanifest"].includes(ext) || fileName === "service-worker.js"
      ? "no-store"
      : "public, max-age=3600";
  res.writeHead(200, responseHeaders({
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    "Content-Length": responseBody.length,
    "Cache-Control": cacheControl,
    ...(compressible ? { Vary: "Accept-Encoding" } : {}),
    ...(contentEncoding ? { "Content-Encoding": contentEncoding } : {})
  }));
  res.end(responseBody);
}

async function requestHandler(req, res) {
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin && req.headers.origin !== requestOrigin(req)) {
      sendJson(res, 403, { error: "Origem do pedido nao autorizada." }); return;
    }
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "POST" && ["/api/auth/login", "/api/auth/google/start", "/api/register/worker", "/api/register/company"].includes(url.pathname)) {
      const key = `${req.socket.remoteAddress}:${url.pathname}`;
      const previous = authAttempts.get(key);
      const entry = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 60000 };
      if (++entry.count > 20) { sendJson(res, 429, { error: "Demasiados pedidos. Tente novamente dentro de um minuto." }, { "Retry-After": "60" }); return; }
      authAttempts.set(key, entry);
      if (authAttempts.size > 5000) for (const [id, value] of authAttempts) if (value.until <= Date.now()) authAttempts.delete(id);
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    if (req.method === "GET" && url.pathname === "/robots.txt") {
      sendText(res, 200, renderRobotsTxt(req), "text/plain; charset=utf-8");
      return;
    }
    if (req.method === "GET" && url.pathname === "/sitemap.xml") {
      try {
        const db = await readMarketplaceDb();
        sendText(res, 200, renderSitemapXml(req, db), "application/xml; charset=utf-8");
      } catch (error) {
        if (APP_STORAGE_DRIVER !== "supabase") throw error;
        console.error(`Sitemap jobs unavailable: ${error.message}`);
        sendText(res, 200, renderSitemapXml(req, createEmptyDb()), "application/xml; charset=utf-8");
      }
      return;
    }
    const jobPageMatch = url.pathname.match(/^\/vagas\/([^/]+)$/);
    if (req.method === "GET" && (url.pathname.startsWith("/empresas/") || url.pathname.startsWith("/empregos/"))) {
      const db = await readMarketplaceDb();
      const company = db.companies.find(c => c.id !== "co_workers" && publicMarketplace.companyPath(c) === url.pathname && c.recruitment?.verification !== "suspended");
      const landing = publicMarketplace.landings(db).find(p => p.path === url.pathname);
      if (!company && !landing) { sendHtml(res, 404, renderSeoNotFoundPage(req)); return; }
      const title = company ? `${company.name} | TrataPro` : `Empregos: ${landing.title} | TrataPro`;
      const content = company ? publicMarketplace.company(db, company) : `${renderPublicTopbarStatic()}<main class="market-home"><h1>${htmlEscape(title)}</h1><div class="market-job-list">${publicMarketplace.cards(landing.jobs)}</div></main>`;
      sendHtml(res, 200, `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><meta name="description" content="${htmlEscape(company?.description || `Vagas abertas: ${landing?.title}`)}"><link rel="canonical" href="${htmlEscape(absolutePublicUrl(req, url.pathname))}"><link rel="stylesheet" href="/styles.css?v=${PUBLIC_ASSET_VERSION}"></head><body>${content}</body></html>`); return;
    }
    if (req.method === "GET" && jobPageMatch) {
      const jobOfferId = decodeURIComponent(jobPageMatch[1]);
      try {
        const db = await readMarketplaceDb();
        const job = db.jobOffers.find((item) => item.id === jobOfferId || jobOfferId.startsWith(`${item.id}-`));
        if (!job) {
          sendHtml(res, 404, renderSeoNotFoundPage(req), { "X-Robots-Tag": "noindex, follow" });
          return;
        }
        const company = db.companies.find((item) => item.id === job.companyId);
        const related = publicOpenJobs(db).filter(j => j.id !== job.id && (j.location === job.location || j.position === job.position)).slice(0, 4);
        sendHtml(res, 200, renderSeoJobPage(job, company, req, related));
      } catch (error) {
        if (APP_STORAGE_DRIVER !== "supabase") throw error;
        console.error(`Job SEO page unavailable: ${error.message}`);
        sendHtml(res, 503, renderSeoNotFoundPage(req), {
          "Retry-After": "300",
          "X-Robots-Tag": "noindex, follow"
        });
      }
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
