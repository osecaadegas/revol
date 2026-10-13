const crypto = require("crypto");
const zlib = require("zlib");

const CRITERIA = [
  ["reliability", "Pontualidade e fiabilidade"],
  ["quality", "Qualidade e produtividade"],
  ["teamwork", "Trabalho em equipa e comunicacao"],
  ["adaptability", "Adaptabilidade e aprendizagem"],
  ["safety", "Seguranca e conduta profissional"]
];
const ACCESS_LAWFUL_BASES = new Set(["legitimate_interest", "legal_obligation", "pre_contract_steps"]);
const DISPUTE_TYPES = new Set(["correction", "context", "dispute", "restriction", "deletion", "access"]);
const EVALUATION_REVIEW_MONTHS = Math.max(1, Number(process.env.EVALUATION_REVIEW_MONTHS || 12));
const EMPLOYMENT_DATA_RETENTION_YEARS = Math.max(1, Number(process.env.EMPLOYMENT_DATA_RETENTION_YEARS || 6));
const ACCESS_REQUEST_DAYS = Math.max(1, Number(process.env.ACCESS_REQUEST_DAYS || 30));
const MAX_CV_UPLOAD_BYTES = Math.max(1, Number(process.env.MAX_CV_UPLOAD_MB || 8)) * 1024 * 1024;
const EMPTY_KEYS = [
  "cvProfiles", "cvVersions", "cvDocuments", "companyVerifications", "companyMemberships",
  "employmentRelationships", "evaluationReports", "evaluationCriteria", "companyAccessGrants",
  "employmentDisputes", "reportAccessLogs", "dataRetentionActions"
];

const TABLES = [
  { key: "cvProfiles", table: "meo_cv_profiles", idKey: "id", fields: { id:"id", workerId:"worker_id", currentVersionId:"current_version_id", status:"status", headline:"headline", summary:"summary", personalDetails:"personal_details", skills:"skills", qualifications:"qualifications", certifications:"certifications", education:"education", workHistory:"work_history", languages:"languages", licences:"licences", preferences:"preferences", availability:"availability", createdAt:"created_at", updatedAt:"updated_at", publishedAt:"published_at" } },
  { key: "cvVersions", table: "meo_cv_versions", idKey: "id", fields: { id:"id", cvProfileId:"cv_profile_id", workerId:"worker_id", version:"version", snapshot:"snapshot", changeSource:"change_source", createdBy:"created_by", createdAt:"created_at" } },
  { key: "cvDocuments", table: "meo_cv_documents", idKey: "id", fields: { id:"id", cvProfileId:"cv_profile_id", workerId:"worker_id", versionId:"version_id", originalName:"original_name", mimeType:"mime_type", storedName:"stored_name", byteSize:"byte_size", fileHash:"file_hash", extractionStatus:"extraction_status", extractedData:"extracted_data", confirmedAt:"confirmed_at", createdAt:"created_at", deletedAt:"deleted_at" } },
  { key: "companyVerifications", table: "meo_company_verifications", idKey: "id", fields: { id:"id", companyId:"company_id", status:"status", source:"source", evidence:"evidence", verifiedBy:"verified_by", verifiedAt:"verified_at", reviewedAt:"reviewed_at", createdAt:"created_at", updatedAt:"updated_at" } },
  { key: "companyMemberships", table: "meo_company_memberships", idKey: "id", fields: { id:"id", companyId:"company_id", userId:"user_id", role:"role", status:"status", verifiedAt:"verified_at", createdAt:"created_at", updatedAt:"updated_at" } },
  { key: "employmentRelationships", table: "meo_employment_relationships", idKey: "id", fields: { id:"id", workerId:"worker_id", companyId:"company_id", companyName:"company_name", position:"position", startDate:"start_date", endDate:"end_date", employmentStatus:"employment_status", verificationStatus:"verification_status", workerConfirmedAt:"worker_confirmed_at", companyConfirmedAt:"company_confirmed_at", createdBy:"created_by", createdByRole:"created_by_role", retentionUntil:"retention_until", createdAt:"created_at", updatedAt:"updated_at" } },
  { key: "evaluationReports", table: "meo_employer_evaluation_reports", idKey: "id", fields: { id:"id", employmentId:"employment_id", workerId:"worker_id", companyId:"company_id", authorId:"author_id", status:"status", assessmentContext:"assessment_context", factualExperience:"factual_experience", version:"version", supersedesReportId:"supersedes_report_id", submittedAt:"submitted_at", reviewExpiresAt:"review_expires_at", retentionUntil:"retention_until", createdAt:"created_at", updatedAt:"updated_at" } },
  { key: "evaluationCriteria", table: "meo_evaluation_criteria", idKey: "id", fields: { id:"id", reportId:"report_id", criterion:"criterion", rating:"rating", context:"context", createdAt:"created_at", updatedAt:"updated_at" } },
  { key: "companyAccessGrants", table: "meo_company_access_grants", idKey: "id", fields: { id:"id", workerId:"worker_id", requesterCompanyId:"requester_company_id", requestedBy:"requested_by", purpose:"purpose", lawfulBasis:"lawful_basis", status:"status", requestedAt:"requested_at", expiresAt:"expires_at", decidedAt:"decided_at", decisionBy:"decision_by" } },
  { key: "employmentDisputes", table: "meo_worker_disputes", idKey: "id", fields: { id:"id", workerId:"worker_id", employmentId:"employment_id", reportId:"report_id", companyId:"company_id", type:"type", description:"description", workerResponse:"worker_response", status:"status", resolution:"resolution", createdAt:"created_at", updatedAt:"updated_at", resolvedAt:"resolved_at" } },
  { key: "reportAccessLogs", table: "meo_report_access_logs", idKey: "id", fields: { id:"id", workerId:"worker_id", reportId:"report_id", employmentId:"employment_id", viewerUserId:"viewer_user_id", viewerCompanyId:"viewer_company_id", action:"action", purpose:"purpose", lawfulBasis:"lawful_basis", ip:"ip", createdAt:"created_at" } },
  { key: "dataRetentionActions", table: "meo_data_retention_actions", idKey: "id", fields: { id:"id", entityType:"entity_type", entityId:"entity_id", workerId:"worker_id", action:"action", reason:"reason", executeAfter:"execute_after", executedAt:"executed_at", createdBy:"created_by", createdAt:"created_at" } }
];

const stamp = () => new Date().toISOString();
const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const list = (value, max = 40, itemMax = 140) => (Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/)).map(item => text(item, itemMax)).filter(Boolean).slice(0, max);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const boolean = value => value === true || value === "true" || value === "on";
const addDays = (value, days) => new Date(new Date(value).getTime() + days * 86400000).toISOString();
const addYears = (value, years) => { const date = new Date(value); date.setUTCFullYear(date.getUTCFullYear() + years); return date.toISOString(); };
const addMonths = (value, months) => { const date = new Date(value); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString(); };
const stableId = (prefix, value) => `${prefix}_${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 24)}`;
const companyVerified = company => company?.recruitment?.verification === "verified";

function date(value, label, optional = true) {
  const result = text(value, 10);
  if (!result && optional) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))) fail(`${label} invalida.`);
  return result;
}

function records(value, fields, limit = 20) {
  return (Array.isArray(value) ? value : []).slice(0, limit).map(item => {
    const output = {};
    for (const [key, max] of fields) output[key] = key.toLowerCase().includes("date") ? date(item?.[key], key, true) : text(item?.[key], max);
    return output;
  }).filter(item => Object.values(item).some(Boolean));
}

function normalizeCv(body, user, current = {}) {
  const personal = body.personalDetails || body.personal || {};
  const preferences = body.preferences || {};
  const availability = body.availability || {};
  return {
    headline: text(body.headline ?? current.headline, 160),
    summary: text(body.summary ?? body.bio ?? current.summary, 2400),
    personalDetails: {
      name: user.name,
      email: user.email,
      phone: text(personal.phone ?? body.phone ?? current.personalDetails?.phone, 80),
      location: text(personal.location ?? body.location ?? current.personalDetails?.location, 180),
      birthDate: date(personal.birthDate ?? body.birthDate ?? current.personalDetails?.birthDate, "Data de nascimento", true)
    },
    skills: list(body.skills ?? current.skills),
    qualifications: list(body.qualifications ?? current.qualifications),
    certifications: list(body.certifications ?? current.certifications),
    education: records(body.education ?? current.education, [["course",180],["institution",180],["startDate",10],["endDate",10],["details",600]], 12),
    workHistory: records(body.workHistory ?? body.experience ?? current.workHistory, [["title",180],["company",180],["location",180],["startDate",10],["endDate",10],["description",800]], 20),
    languages: records(body.languages ?? current.languages, [["language",100],["level",80]], 20),
    licences: list(body.licences ?? current.licences),
    preferences: {
      preferredLocations: list(preferences.preferredLocations ?? body.preferredLocations ?? current.preferences?.preferredLocations),
      roles: list(preferences.roles ?? body.roles ?? current.preferences?.roles),
      workModes: list(preferences.workModes ?? current.preferences?.workModes, 6),
      employmentTypes: list(preferences.employmentTypes ?? current.preferences?.employmentTypes, 8)
    },
    availability: {
      available: boolean(availability.available ?? current.availability?.available),
      availableFrom: date(availability.availableFrom ?? current.availability?.availableFrom, "Disponibilidade", true),
      shifts: list(availability.shifts ?? current.availability?.shifts, 8)
    }
  };
}

function legacyCv(user) {
  const cv = user.profile?.workerCv || {};
  return normalizeCv({
    headline: cv.headline,
    summary: cv.bio,
    personalDetails: { phone: cv.phone, location: cv.location, birthDate: cv.birthDate },
    skills: cv.skills,
    certifications: cv.preferences?.certifications,
    workHistory: cv.experience,
    languages: (cv.preferences?.languages || []).map(language => ({ language, level: "" })),
    licences: cv.preferences?.drivingLicence ? ["Carta de conducao"] : [],
    preferences: { preferredLocations: cv.preferences?.preferredLocations, roles: cv.preferences?.categories, workModes: cv.preferences?.workModes, employmentTypes: cv.preferences?.employmentTypes },
    availability: { available: cv.preferences?.available, availableFrom: cv.preferences?.availableFrom, shifts: cv.preferences?.schedules }
  }, user);
}

function profileFor(db, user) {
  const existing = db.cvProfiles.find(item => item.workerId === user.id);
  if (existing) return existing;
  const initial = legacyCv(user);
  return {
    id: stableId("cvp", user.id), workerId: user.id, currentVersionId: null,
    status: user.profile?.workerCv?.published ? "published" : "draft", ...initial,
    createdAt: user.createdAt || stamp(), updatedAt: user.profile?.workerCv?.updatedAt || user.createdAt || stamp(),
    publishedAt: user.profile?.workerCv?.publishedAt || null
  };
}

function persistProfile(db, user) {
  let profile = db.cvProfiles.find(item => item.workerId === user.id);
  if (!profile) {
    profile = profileFor(db, user);
    db.cvProfiles.push(profile);
  }
  return profile;
}

function publicDocument(document) {
  if (!document || document.deletedAt) return null;
  const { storedName, ...safe } = document;
  return { ...safe, downloadUrl: `/api/professional/documents/${encodeURIComponent(document.id)}/file` };
}

function publicEmployment(db, employment) {
  const worker = db.users.find(user => user.id === employment.workerId);
  return { ...employment, workerName: worker?.name || "Trabalhador", verified: employment.verificationStatus === "verified" };
}

function reportSummary(db, report) {
  const author = db.users.find(user => user.id === report.authorId);
  const company = db.companies.find(item => item.id === report.companyId);
  const employment = db.employmentRelationships.find(item => item.id === report.employmentId);
  return {
    id: report.id, employmentId: report.employmentId, workerId: report.workerId,
    companyId: report.companyId, companyName: company?.name || employment?.companyName || "Empresa",
    authorId: report.authorId, authorName: author?.name || "Autor identificado", status: report.status,
    version: report.version || 1, submittedAt: report.submittedAt, reviewExpiresAt: report.reviewExpiresAt,
    employmentDates: employment ? { startDate: employment.startDate, endDate: employment.endDate } : null,
    hasWorkerResponse: db.employmentDisputes.some(item => item.reportId === report.id && item.workerResponse)
  };
}

function snapshot(db, auth) {
  const worker = auth.user.role === "worker";
  const manager = ["company", "manager"].includes(auth.user.role);
  const cv = worker ? profileFor(db, auth.user) : null;
  const employments = worker
    ? db.employmentRelationships.filter(item => item.workerId === auth.user.id)
    : manager ? db.employmentRelationships.filter(item => item.companyId === auth.company.id) : [];
  const reports = worker
    ? db.evaluationReports.filter(item => item.workerId === auth.user.id && item.status !== "draft")
    : manager ? db.evaluationReports.filter(item => item.companyId === auth.company.id) : [];
  const disputes = worker
    ? db.employmentDisputes.filter(item => item.workerId === auth.user.id)
    : manager ? db.employmentDisputes.filter(item => item.companyId === auth.company.id) : [];
  const accessRequests = (worker
    ? db.companyAccessGrants.filter(item => item.workerId === auth.user.id)
    : manager ? db.companyAccessGrants.filter(item => item.requesterCompanyId === auth.company.id) : [])
    .map(item => ({ ...item, requesterCompanyName:db.companies.find(company => company.id === item.requesterCompanyId)?.name || "Empresa" }));
  const accessHistory = (worker
    ? db.reportAccessLogs.filter(item => item.workerId === auth.user.id)
    : manager ? db.reportAccessLogs.filter(item => item.viewerCompanyId === auth.company.id) : [])
    .map(item => ({ ...item, viewerName:db.users.find(user => user.id === item.viewerUserId)?.name || "Sistema", viewerCompanyName:db.companies.find(company => company.id === item.viewerCompanyId)?.name || "" }));
  const eligibleWorkerIds = manager ? new Set(db.jobApplications.filter(item => item.companyId === auth.company.id && ["accepted", "hired"].includes(item.status)).map(item => item.workerId)) : new Set();
  for (const item of employments) eligibleWorkerIds.add(item.workerId);
  return {
    crossCompanySharingEnabled: false,
    criteria: CRITERIA.map(([key, label]) => ({ key, label })),
    cv: cv ? { ...cv, stableProfileId: cv.id,
      verifiedEmployment: employments.filter(item => item.verificationStatus === "verified").map(item => publicEmployment(db, item)).sort((a,b) => String(b.startDate).localeCompare(String(a.startDate))) } : null,
    versions: worker ? db.cvVersions.filter(item => item.workerId === auth.user.id).map(item => ({ id:item.id, version:item.version, changeSource:item.changeSource, createdAt:item.createdAt })).sort((a,b) => b.version - a.version) : [],
    documents: worker ? db.cvDocuments.filter(item => item.workerId === auth.user.id && !item.deletedAt).map(publicDocument).filter(Boolean).sort((a,b) => b.createdAt.localeCompare(a.createdAt)) : [],
    employments: employments.map(item => publicEmployment(db, item)).sort((a,b) => String(b.startDate).localeCompare(String(a.startDate))),
    reportSummaries: reports.map(item => reportSummary(db, item)).sort((a,b) => String(b.submittedAt || b.createdAt).localeCompare(String(a.submittedAt || a.createdAt))),
    disputes: disputes.sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    accessRequests: accessRequests.sort((a,b) => b.requestedAt.localeCompare(a.requestedAt)),
    accessHistory: accessHistory.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200),
    verifiedCompanies: worker ? db.companies.filter(companyVerified).map(company => ({ id:company.id, name:company.name })) : [],
    eligibleWorkers: manager ? db.users.filter(user => eligibleWorkerIds.has(user.id) && user.role === "worker").map(user => ({ id:user.id, name:user.name, email:user.email })) : []
  };
}

function ensureCompanyIdentity(db, auth) {
  if (!["company", "manager"].includes(auth.user.role)) return;
  const verificationId = stableId("cvr", auth.company.id);
  let verification = db.companyVerifications.find(item => item.companyId === auth.company.id);
  const status = auth.company.recruitment?.verification || "pending";
  if (!verification) {
    verification = { id:verificationId, companyId:auth.company.id, status, source:"recruitment_verification", evidence:{ nif:auth.company.recruitment?.nif || "" }, verifiedBy:auth.company.recruitment?.reviewedBy || null, verifiedAt:status === "verified" ? auth.company.recruitment?.reviewedAt || stamp() : null, reviewedAt:auth.company.recruitment?.reviewedAt || null, createdAt:stamp(), updatedAt:stamp() };
    db.companyVerifications.push(verification);
  } else if (verification.status !== status) {
    verification.status = status; verification.updatedAt = stamp(); verification.reviewedAt = auth.company.recruitment?.reviewedAt || verification.reviewedAt;
    if (status === "verified" && !verification.verifiedAt) verification.verifiedAt = stamp();
  }
  const membershipId = stableId("cm", `${auth.company.id}:${auth.user.id}`);
  if (!db.companyMemberships.some(item => item.id === membershipId)) db.companyMemberships.push({ id:membershipId, companyId:auth.company.id, userId:auth.user.id, role:auth.user.role, status:"active", verifiedAt:status === "verified" ? stamp() : null, createdAt:stamp(), updatedAt:stamp() });
}

function assertVerifiedCompany(auth) {
  if (!["company", "manager"].includes(auth.user.role) || !companyVerified(auth.company)) fail("Apenas uma empresa verificada pode concluir esta operacao.", 403);
}

function assertCvReader(db, auth, workerId) {
  if (auth.user.id === workerId) return;
  const worker = db.users.find(user => user.id === workerId);
  if (worker?.profile?.workerCv?.preferences?.visibility === "private" || !["company", "manager"].includes(auth.user.role) || !db.jobApplications.some(item => item.workerId === workerId && item.companyId === auth.company.id)) fail("CV nao encontrado.", 404);
}

function parseCvDocument(input) {
  const match = String(input?.dataUrl || "").match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) fail("Documento invalido. Envie um PDF ou DOCX.");
  const mimeType = match[1].toLowerCase();
  if (!["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mimeType)) fail("Tipo de ficheiro nao suportado. Envie PDF ou DOCX.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_CV_UPLOAD_BYTES) fail(`O documento deve ter ate ${Math.round(MAX_CV_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  if (mimeType === "application/pdf" && (buffer.subarray(0,5).toString() !== "%PDF-" || !buffer.subarray(-2048).includes(Buffer.from("%%EOF")))) fail("PDF invalido.");
  if (mimeType.includes("officedocument")) {
    if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) fail("DOCX invalido.");
    try { if (!zipEntry(buffer, "word/document.xml")) fail("DOCX invalido."); }
    catch { fail("DOCX invalido ou demasiado complexo."); }
  }
  return { buffer, mimeType, extension: mimeType === "application/pdf" ? "pdf" : "docx", name:text(input.name, 180) || `cv.${mimeType === "application/pdf" ? "pdf" : "docx"}` };
}

function zipEntry(buffer, wanted) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset--) if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  if (eocd < 0) return null;
  let cursor = buffer.readUInt32LE(eocd + 16);
  const count = buffer.readUInt16LE(eocd + 10);
  for (let index = 0; index < count && cursor + 46 <= buffer.length; index++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10), compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28), extraLength = buffer.readUInt16LE(cursor + 30), commentLength = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (name === wanted && buffer.readUInt32LE(localOffset) === 0x04034b50) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26), localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      if (method === 0) return compressed.length <= 2 * 1024 * 1024 ? compressed : null;
      return method === 8 ? zlib.inflateRawSync(compressed, { maxOutputLength:2 * 1024 * 1024 }) : null;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function decodeXml(value) {
  return value.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function extraction(parsed) {
  if (parsed.extension === "pdf") return { status:"manual_review", data:{ message:"O PDF foi guardado em privado. Confirme os campos manualmente; nenhum dado foi aplicado automaticamente." } };
  try {
    const documentXml = zipEntry(parsed.buffer, "word/document.xml");
    if (!documentXml) throw new Error("word/document.xml ausente");
    const raw = decodeXml(documentXml.toString("utf8").replace(/<w:tab\/?[^>]*>/g,"\t").replace(/<\/w:p>/g,"\n").replace(/<[^>]+>/g,"")).replace(/\r/g,"");
    const lines = raw.split("\n").map(line => line.replace(/\s+/g," ").trim()).filter(Boolean);
    const joined = lines.join("\n").slice(0, 12000);
    const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] || "";
    const section = heading => {
      const start = lines.findIndex(line => heading.test(line));
      if (start < 0) return [];
      return lines.slice(start + 1, start + 9).filter(line => !/^(experi|educa|forma|idioma|compet|skill|certifica|licen)/i.test(line));
    };
    return { status:"extracted", data:{ rawText:joined, suggestions:{ headline:lines[0] || "", summary:lines.slice(1,6).join(" ").slice(0,1200), phone, email, skills:section(/^(competencias|skills)$/i), qualifications:section(/^(qualificacoes|formacao)$/i), languages:section(/^(idiomas|languages)$/i).map(language => ({ language, level:"" })) } } };
  } catch (error) {
    return { status:"failed", data:{ message:"Nao foi possivel extrair este DOCX. O ficheiro foi guardado e pode preencher o CV manualmente." } };
  }
}

function evaluationContext(value, max = 1200) {
  const result = text(value, max);
  const forbidden = /(raca|etnia|religiao|gravidez|deficiencia|doenca|saude|sindicat|orientacao sexual|identidade de genero|licenca parental|baixa medica|falta justificada|recus\w*\s+(?:de\s+)?horas?\s+extra|limite\w*\s+(?:de\s+)?horario)/i;
  const normalized = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (forbidden.test(normalized)) fail("O contexto da avaliacao nao pode incluir dados protegidos, ausencias legalmente protegidas, recusa de horas extra opcionais ou limites contratuais.");
  return result;
}

function normalizeCriteria(value) {
  const source = Array.isArray(value) ? value : [];
  return CRITERIA.map(([criterion]) => {
    const item = source.find(candidate => candidate?.criterion === criterion) || {};
    const rating = Number(item.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail("Preencha todos os criterios com uma classificacao de 1 a 5.");
    return { criterion, rating, context:evaluationContext(item.context, 700) };
  });
}

function pdfEscape(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
}

function wrap(value, length = 92) {
  const words = String(value || "").split(/\s+/).filter(Boolean), lines = []; let current = "";
  for (const word of words) { if (`${current} ${word}`.trim().length > length) { if (current) lines.push(current); current = word; } else current = `${current} ${word}`.trim(); }
  if (current) lines.push(current); return lines.length ? lines : [""];
}

function buildPdf(lines) {
  const pages = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));
  if (!pages.length) pages.push(["TrataPro CV"]);
  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2, contentId = pageId + 1;
    const stream = `BT\n/F1 10 Tf\n48 794 Td\n14 TL\n${page.map(line => `(${pdfEscape(line)}) Tj T*`).join("\n")}\nET`;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });
  let output = "%PDF-1.4\n%TrataPro\n";
  const offsets = [0];
  for (let id = 1; id <= objects.size; id++) { offsets[id] = Buffer.byteLength(output, "latin1"); output += `${id} 0 obj\n${objects.get(id)}\nendobj\n`; }
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.size + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10,"0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "latin1");
}

function pdfLines(db, worker, profile) {
  const lines = ["TRATAPRO - CURRICULUM VITAE", "", worker.name, profile.headline, profile.personalDetails?.location, profile.personalDetails?.phone, worker.email, ""];
  if (profile.summary) lines.push("PERFIL", ...wrap(profile.summary), "");
  if (profile.skills?.length) lines.push("COMPETENCIAS", ...wrap(profile.skills.join(" | ")), "");
  if (profile.qualifications?.length) lines.push("QUALIFICACOES", ...profile.qualifications.flatMap(item => wrap(`- ${item}`)), "");
  if (profile.certifications?.length) lines.push("CERTIFICACOES", ...profile.certifications.flatMap(item => wrap(`- ${item}`)), "");
  if (profile.education?.length) lines.push("EDUCACAO", ...profile.education.flatMap(item => wrap(`${item.course} - ${item.institution} (${item.startDate || ""}${item.endDate ? ` a ${item.endDate}` : ""})`)), "");
  if (profile.workHistory?.length) lines.push("EXPERIENCIA DECLARADA", ...profile.workHistory.flatMap(item => wrap(`${item.title} - ${item.company} (${item.startDate || ""}${item.endDate ? ` a ${item.endDate}` : " - atual"}) ${item.description || ""}`)), "");
  const verified = db.employmentRelationships.filter(item => item.workerId === worker.id && item.verificationStatus === "verified").sort((a,b) => String(b.startDate).localeCompare(String(a.startDate)));
  if (verified.length) lines.push("HISTORICO DE EMPREGO VERIFICADO", ...verified.flatMap(item => wrap(`${item.position} - ${item.companyName} (${item.startDate}${item.endDate ? ` a ${item.endDate}` : " - atual"})`)), "");
  if (profile.languages?.length) lines.push("IDIOMAS", ...profile.languages.flatMap(item => wrap(`- ${item.language}${item.level ? `: ${item.level}` : ""}`)), "");
  if (profile.licences?.length) lines.push("LICENCAS", ...profile.licences.flatMap(item => wrap(`- ${item}`)), "");
  lines.push("", `Gerado pela TrataPro em ${new Date().toISOString().slice(0,10)}. Avaliacoes confidenciais nao fazem parte deste CV.`);
  return lines.filter(value => value !== undefined && value !== null);
}

function createProfessionalProfile(h) {
  function syncLegacyCv(db, user) {
    const profile = persistProfile(db, user), normalized = legacyCv(user);
    Object.assign(profile, normalized, {
      status:user.profile?.workerCv?.published ? "published" : "draft",
      updatedAt:user.profile?.workerCv?.updatedAt || stamp(),
      publishedAt:user.profile?.workerCv?.publishedAt || profile.publishedAt || null
    });
    const versionNumber = Math.max(0, ...db.cvVersions.filter(item => item.cvProfileId === profile.id).map(item => Number(item.version) || 0)) + 1;
    const version = { id:uid("cvv"), cvProfileId:profile.id, workerId:user.id, version:versionNumber, snapshot:normalized, changeSource:"migration", createdBy:user.id, createdAt:stamp() };
    db.cvVersions.push(version); profile.currentVersionId = version.id;
    return profile;
  }
  function response(db, auth) { return { professional:snapshot(db, auth), bootstrap:h.buildBootstrap(db, auth) }; }
  function accessLog(db, auth, report, action, req, purpose = "self_or_originating_company_review") {
    db.reportAccessLogs.push({ id:uid("ral"), workerId:report.workerId, reportId:report.id, employmentId:report.employmentId, viewerUserId:auth.user.id, viewerCompanyId:auth.user.role === "worker" ? null : auth.company.id, action, purpose, lawfulBasis:auth.user.role === "worker" ? "data_subject_access" : "employment_relationship_management", ip:String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim().slice(0,100), createdAt:stamp() });
  }
  function maintain(db) {
    let expiredReports = 0, expiredRequests = 0, redactedReports = 0;
    const now = Date.now();
    for (const request of db.companyAccessGrants) if (request.status === "pending_dpia" && Date.parse(request.expiresAt) <= now) { request.status = "expired"; request.decidedAt = stamp(); expiredRequests++; }
    for (const report of db.evaluationReports) {
      if (["submitted","corrected"].includes(report.status) && Date.parse(report.reviewExpiresAt) <= now) {
        report.status = "expired"; report.updatedAt = stamp(); expiredReports++;
        db.auditLogs.push({ id:uid("audit"), companyId:report.companyId, actorId:null, actorName:"Sistema", actorRole:"system", entityType:"evaluation_report", entityId:report.id, action:"evaluation_report.review_expired", detail:{ reviewExpiresAt:report.reviewExpiresAt }, ip:"", createdAt:stamp() });
      }
      if (Date.parse(report.retentionUntil) <= now && !db.dataRetentionActions.some(item => item.entityType === "evaluation_report" && item.entityId === report.id && item.action === "redacted")) {
        db.evaluationCriteria = db.evaluationCriteria.filter(item => item.reportId !== report.id);
        report.assessmentContext = ""; report.factualExperience = {}; report.status = "expired"; report.updatedAt = stamp(); redactedReports++;
        db.dataRetentionActions.push({ id:uid("ret"), entityType:"evaluation_report", entityId:report.id, workerId:report.workerId, action:"redacted", reason:"configured_retention_period_elapsed", executeAfter:report.retentionUntil, executedAt:stamp(), createdBy:"system", createdAt:stamp() });
        db.auditLogs.push({ id:uid("audit"), companyId:report.companyId, actorId:null, actorName:"Sistema", actorRole:"system", entityType:"evaluation_report", entityId:report.id, action:"evaluation_report.retention_redacted", detail:{ retentionUntil:report.retentionUntil }, ip:"", createdAt:stamp() });
      }
    }
    return { expiredReports, expiredRequests, redactedReports };
  }
  async function handle(req, res, pathname) {
    if (!pathname.startsWith("/api/professional")) return false;
    if (req.method === "GET" && pathname === "/api/professional") {
      const db = await h.readDb(), auth = h.requireAuth(db, req); h.sendJson(res, 200, { professional:snapshot(db, auth) }); return true;
    }
    const docFile = pathname.match(/^\/api\/professional\/documents\/([^/]+)\/file$/);
    if (req.method === "GET" && docFile) {
      const context = await h.mutateDb(db => {
        const auth = h.requireAuth(db, req), document = db.cvDocuments.find(item => item.id === docFile[1] && !item.deletedAt);
        if (!document) fail("Documento nao encontrado.", 404); assertCvReader(db, auth, document.workerId);
        db.reportAccessLogs.push({ id:uid("ral"), workerId:document.workerId, reportId:null, employmentId:null, viewerUserId:auth.user.id, viewerCompanyId:auth.user.role === "worker" ? null : auth.company.id, action:"cv_document.viewed", purpose:auth.user.role === "worker" ? "data_subject_access" : "active_application_review", lawfulBasis:auth.user.role === "worker" ? "data_subject_access" : "pre_contract_steps", ip:String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim().slice(0,100), createdAt:stamp() });
        h.audit(db, auth, "cv_document", document.id, "cv_document.viewed", { workerId:document.workerId }, req); return { document };
      });
      const buffer = await h.readPrivateUploadFile(context.document.storedName);
      const downloadName = context.document.originalName.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9._ -]/g,"_").slice(0,180) || "documento";
      res.writeHead(200, h.responseHeaders({ "Content-Type":context.document.mimeType, "Content-Length":buffer.length, "Content-Disposition":`attachment; filename="${downloadName}"`, "Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow" })); res.end(buffer); return true;
    }
    if (req.method === "GET" && pathname === "/api/professional/cv.pdf") {
      const url = new URL(req.url, "http://localhost");
      const context = await h.mutateDb(db => {
        const auth = h.requireAuth(db, req), workerId = url.searchParams.get("workerId") || auth.user.id;
        const worker = db.users.find(user => user.id === workerId && user.role === "worker"); if (!worker) fail("CV nao encontrado.", 404); assertCvReader(db, auth, workerId);
        const profile = profileFor(db, worker); h.audit(db, auth, "cv_profile", profile.id, "cv_profile.pdf_exported", { workerId }, req); return { db, worker, profile };
      });
      const pdf = buildPdf(pdfLines(context.db, context.worker, context.profile));
      res.writeHead(200, h.responseHeaders({ "Content-Type":"application/pdf", "Content-Length":pdf.length, "Content-Disposition":'attachment; filename="TrataPro-CV.pdf"', "Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow" })); res.end(pdf); return true;
    }
    const reportView = pathname.match(/^\/api\/professional\/evaluations\/([^/]+)$/);
    if (req.method === "GET" && reportView) {
      const result = await h.mutateDb(db => {
        const auth = h.requireAuth(db, req), report = db.evaluationReports.find(item => item.id === reportView[1] && item.status !== "draft");
        if (!report) fail("Relatorio nao encontrado.", 404);
        const allowed = auth.user.id === report.workerId || (["company","manager"].includes(auth.user.role) && auth.company.id === report.companyId);
        if (!allowed) fail("Relatorio nao encontrado.", 404);
        accessLog(db, auth, report, "evaluation_report.viewed", req);
        h.audit(db, auth, "evaluation_report", report.id, "evaluation_report.viewed", { workerId:report.workerId, companyId:report.companyId }, req);
        return { report:{ ...reportSummary(db, report), assessmentContext:report.assessmentContext, factualExperience:report.factualExperience,
          criteria:db.evaluationCriteria.filter(item => item.reportId === report.id).map(item => ({ criterion:item.criterion, rating:item.rating, context:item.context })),
          workerResponses:db.employmentDisputes.filter(item => item.reportId === report.id).map(item => ({ id:item.id, type:item.type, workerResponse:item.workerResponse, description:item.description, status:item.status, resolution:item.resolution, createdAt:item.createdAt })) } };
      });
      h.sendJson(res, 200, result); return true;
    }
    const body = await h.readBody(req, Math.max(MAX_CV_UPLOAD_BYTES * 2, 20 * 1024 * 1024));
    const result = await h.mutateDb(async db => {
      const auth = h.requireAuth(db, req); ensureCompanyIdentity(db, auth);
      if (pathname === "/api/professional/cv" && req.method === "POST") {
        h.requireWorker(auth); const profile = persistProfile(db, auth.user); const normalized = normalizeCv(body, auth.user, profile);
        if (body.intent === "publish" && (!normalized.headline || !normalized.personalDetails.location || !normalized.skills.length)) fail("Para publicar, indique titulo profissional, localizacao e pelo menos uma competencia.");
        Object.assign(profile, normalized, { status:body.intent === "publish" ? "published" : "draft", updatedAt:stamp(), publishedAt:body.intent === "publish" ? profile.publishedAt || stamp() : profile.publishedAt });
        const versionNumber = Math.max(0, ...db.cvVersions.filter(item => item.cvProfileId === profile.id).map(item => Number(item.version) || 0)) + 1;
        const sourceDocument = body.sourceDocumentId ? db.cvDocuments.find(item => item.id === body.sourceDocumentId && item.workerId === auth.user.id && !item.deletedAt) : null;
        if (sourceDocument) sourceDocument.confirmedAt = stamp();
        const version = { id:uid("cvv"), cvProfileId:profile.id, workerId:auth.user.id, version:versionNumber, snapshot:normalized, changeSource:sourceDocument ? "document_confirmed" : "manual", createdBy:auth.user.id, createdAt:stamp() };
        db.cvVersions.push(version); profile.currentVersionId = version.id;
        const old = auth.user.profile?.workerCv || {};
        auth.user.profile = { ...(auth.user.profile || {}), headline:profile.headline, location:profile.personalDetails.location, skills:profile.skills.join(", "), bio:profile.summary,
          workerCv:{ ...old, published:profile.status === "published", headline:profile.headline, location:profile.personalDetails.location, birthDate:profile.personalDetails.birthDate, phone:profile.personalDetails.phone, availability:profile.availability.available ? "Disponivel" : "", bio:profile.summary, skills:profile.skills, experience:profile.workHistory, preferences:{ ...(old.preferences || {}), available:profile.availability.available, availableFrom:profile.availability.availableFrom, schedules:profile.availability.shifts, certifications:profile.certifications, languages:profile.languages.map(item => item.language), preferredLocations:profile.preferences.preferredLocations, categories:profile.preferences.roles, workModes:profile.preferences.workModes, employmentTypes:profile.preferences.employmentTypes, drivingLicence:profile.licences.some(item => /conducao/i.test(item)) }, publishedAt:profile.publishedAt, updatedAt:profile.updatedAt } };
        h.audit(db, auth, "cv_profile", profile.id, "cv_profile.version_saved", { version:versionNumber, status:profile.status }, req);
      } else if (pathname === "/api/professional/documents" && req.method === "POST") {
        h.requireWorker(auth); const profile = persistProfile(db, auth.user); if (db.cvDocuments.filter(item => item.workerId === auth.user.id && !item.deletedAt).length >= 10) fail("Pode guardar ate dez documentos ativos.");
        const parsed = parseCvDocument(body), extracted = extraction(parsed), fileHash = crypto.createHash("sha256").update(parsed.buffer).digest("hex");
        const document = { id:uid("cvd"), cvProfileId:profile.id, workerId:auth.user.id, versionId:profile.currentVersionId, originalName:parsed.name, mimeType:parsed.mimeType, storedName:`cv-documents/${auth.user.id}/${crypto.randomUUID()}.${parsed.extension}`, byteSize:parsed.buffer.length, fileHash, extractionStatus:extracted.status, extractedData:extracted.data, confirmedAt:null, createdAt:stamp(), deletedAt:null };
        await h.savePrivateUploadFile(document.storedName, document.mimeType, parsed.buffer); db.cvDocuments.push(document);
        h.audit(db, auth, "cv_document", document.id, "cv_document.uploaded", { mimeType:document.mimeType, extractionStatus:document.extractionStatus }, req);
      } else {
        const docDelete = pathname.match(/^\/api\/professional\/documents\/([^/]+)$/);
        const employmentConfirm = pathname.match(/^\/api\/professional\/employments\/([^/]+)\/confirm$/);
        const disputeUpdate = pathname.match(/^\/api\/professional\/disputes\/([^/]+)$/);
        const accessUpdate = pathname.match(/^\/api\/professional\/access-requests\/([^/]+)$/);
        if (docDelete && req.method === "DELETE") {
          h.requireWorker(auth); const document = db.cvDocuments.find(item => item.id === docDelete[1] && item.workerId === auth.user.id && !item.deletedAt); if (!document) fail("Documento nao encontrado.", 404);
          await h.deletePrivateUploadFile(document.storedName); document.deletedAt = stamp(); document.extractedData = {};
          db.dataRetentionActions.push({ id:uid("ret"), entityType:"cv_document", entityId:document.id, workerId:auth.user.id, action:"deleted", reason:"worker_request", executeAfter:stamp(), executedAt:stamp(), createdBy:auth.user.id, createdAt:stamp() });
          h.audit(db, auth, "cv_document", document.id, "cv_document.deleted", {}, req);
        } else if (pathname === "/api/professional/employments" && req.method === "POST") {
          const workerMode = auth.user.role === "worker"; if (!workerMode) assertVerifiedCompany(auth);
          const workerId = workerMode ? auth.user.id : text(body.workerId, 120); const worker = db.users.find(user => user.id === workerId && user.role === "worker" && user.active !== false); if (!worker) fail("Trabalhador nao encontrado.", 404);
          const companyId = workerMode ? text(body.companyId,120) || null : auth.company.id; const company = companyId ? db.companies.find(item => item.id === companyId) : null;
          if (workerMode && companyId && !companyVerified(company)) fail("Selecione uma empresa verificada.");
          if (!workerMode && !db.jobApplications.some(item => item.workerId === workerId && item.companyId === auth.company.id && ["accepted","hired"].includes(item.status))) fail("A empresa so pode criar um vinculo quando existe uma candidatura contratada ou um pedido iniciado pelo trabalhador.", 403);
          const startDate = date(body.startDate, "Data de inicio", false), endDate = date(body.endDate, "Data de fim", true); if (endDate && endDate < startDate) fail("A data de fim deve ser posterior ao inicio.");
          const employmentStatus = endDate ? "ended" : "active"; const createdAt = stamp();
          const employment = { id:uid("emp"), workerId, companyId, companyName:company?.name || text(body.companyName,180), position:text(body.position,180), startDate, endDate, employmentStatus, verificationStatus:companyId ? "pending" : "self_declared", workerConfirmedAt:workerMode ? createdAt : null, companyConfirmedAt:workerMode ? null : createdAt, createdBy:auth.user.id, createdByRole:workerMode ? "worker" : "company", retentionUntil:addYears(endDate ? `${endDate}T00:00:00Z` : createdAt, EMPLOYMENT_DATA_RETENTION_YEARS), createdAt, updatedAt:createdAt };
          if (!employment.companyName || !employment.position) fail("Empresa, cargo e data de inicio sao obrigatorios.");
          if (db.employmentRelationships.some(item => item.workerId === workerId && item.companyId === companyId && String(item.position || "").toLowerCase() === employment.position.toLowerCase() && item.startDate === startDate && item.verificationStatus !== "rejected")) fail("Este vinculo ja esta registado.",409);
          db.employmentRelationships.push(employment);
          h.audit(db, auth, "employment", employment.id, "employment.created", { workerId, companyId, verificationStatus:employment.verificationStatus }, req);
        } else if (employmentConfirm && req.method === "PATCH") {
          const employment = db.employmentRelationships.find(item => item.id === employmentConfirm[1]); if (!employment) fail("Vinculo nao encontrado.",404);
          const workerMode = auth.user.role === "worker"; const allowed = workerMode ? employment.workerId === auth.user.id : ["company","manager"].includes(auth.user.role) && employment.companyId === auth.company.id; if (!allowed) fail("Vinculo nao encontrado.",404);
          if (!workerMode) assertVerifiedCompany(auth); const decision = body.decision === "reject" ? "reject" : "confirm";
          if (decision === "reject") employment.verificationStatus = "rejected";
          else { if (workerMode) employment.workerConfirmedAt = stamp(); else employment.companyConfirmedAt = stamp(); employment.verificationStatus = employment.workerConfirmedAt && employment.companyConfirmedAt && companyVerified(db.companies.find(item => item.id === employment.companyId)) ? "verified" : "pending"; }
          employment.updatedAt = stamp(); h.audit(db, auth, "employment", employment.id, `employment.${decision}ed`, { verificationStatus:employment.verificationStatus }, req);
        } else if (pathname === "/api/professional/evaluations" && req.method === "POST") {
          assertVerifiedCompany(auth); const employment = db.employmentRelationships.find(item => item.id === body.employmentId && item.companyId === auth.company.id && item.verificationStatus === "verified"); if (!employment) fail("A avaliacao exige um vinculo de emprego verificado com esta empresa.",403);
          const prior = body.supersedesReportId ? db.evaluationReports.find(item => item.id === body.supersedesReportId && item.companyId === auth.company.id && item.employmentId === employment.id && item.status !== "draft") : null;
          if (body.supersedesReportId && !prior) fail("Relatorio anterior nao encontrado.",404);
          const criteria = normalizeCriteria(body.criteria), createdAt = stamp(); const report = { id:uid("evr"), employmentId:employment.id, workerId:employment.workerId, companyId:auth.company.id, authorId:auth.user.id, status:prior ? "corrected" : "submitted", assessmentContext:evaluationContext(body.assessmentContext,1600), factualExperience:{ nightShift:boolean(body.factualExperience?.nightShift), weekend:boolean(body.factualExperience?.weekend), overtime:boolean(body.factualExperience?.overtime), context:evaluationContext(body.factualExperience?.context,700) }, version:(prior?.version || 0)+1, supersedesReportId:prior?.id || null, submittedAt:createdAt, reviewExpiresAt:addMonths(createdAt,EVALUATION_REVIEW_MONTHS), retentionUntil:addYears(createdAt,EMPLOYMENT_DATA_RETENTION_YEARS), createdAt, updatedAt:createdAt };
          if (prior) { prior.status = "superseded"; prior.updatedAt = createdAt; }
          db.evaluationReports.push(report); criteria.forEach(item => db.evaluationCriteria.push({ id:uid("evc"), reportId:report.id, criterion:item.criterion, rating:item.rating, context:item.context, createdAt, updatedAt:createdAt }));
          accessLog(db, auth, report, "evaluation_report.submitted", req, "employment_relationship_management"); h.audit(db, auth, "evaluation_report", report.id, "evaluation_report.submitted", { employmentId:employment.id, workerId:employment.workerId, version:report.version }, req);
        } else if (pathname === "/api/professional/disputes" && req.method === "POST") {
          h.requireWorker(auth); if (!DISPUTE_TYPES.has(body.type)) fail("Tipo de pedido invalido.");
          const report = body.reportId ? db.evaluationReports.find(item => item.id === body.reportId && item.workerId === auth.user.id) : null;
          const employment = body.employmentId ? db.employmentRelationships.find(item => item.id === body.employmentId && item.workerId === auth.user.id) : report ? db.employmentRelationships.find(item => item.id === report.employmentId) : null;
          if ((body.reportId && !report) || (body.employmentId && !employment)) fail("Registo nao encontrado.",404);
          const description = text(body.description,2400), workerResponse = text(body.workerResponse,2400); if (!description) fail("Descreva o pedido ou a incorrecao.");
          const dispute = { id:uid("dsp"), workerId:auth.user.id, employmentId:employment?.id || null, reportId:report?.id || null, companyId:report?.companyId || employment?.companyId || null, type:body.type, description, workerResponse, status:"open", resolution:"", createdAt:stamp(), updatedAt:stamp(), resolvedAt:null }; db.employmentDisputes.push(dispute);
          h.audit(db, auth, "worker_dispute", dispute.id, "worker_dispute.created", { type:dispute.type, reportId:dispute.reportId }, req);
        } else if (disputeUpdate && req.method === "PATCH") {
          const dispute = db.employmentDisputes.find(item => item.id === disputeUpdate[1] && item.companyId === auth.company.id); if (!dispute || !["company","manager"].includes(auth.user.role)) fail("Pedido nao encontrado.",404);
          if (!["under_review","resolved","rejected"].includes(body.status)) fail("Estado invalido."); const resolution = text(body.resolution,2400); if (["resolved","rejected"].includes(body.status) && !resolution) fail("Indique a resposta ao trabalhador.");
          dispute.status = body.status; dispute.resolution = resolution; dispute.updatedAt = stamp(); dispute.resolvedAt = ["resolved","rejected"].includes(body.status) ? stamp() : null;
          h.audit(db, auth, "worker_dispute", dispute.id, "worker_dispute.updated", { status:dispute.status }, req);
        } else if (pathname === "/api/professional/access-requests" && req.method === "POST") {
          assertVerifiedCompany(auth); const worker = db.users.find(user => user.id === body.workerId && user.role === "worker"); if (!worker) fail("Trabalhador nao encontrado.",404);
          const relevantRelationship = db.jobApplications.some(item => item.workerId === worker.id && item.companyId === auth.company.id) || db.employmentRelationships.some(item => item.workerId === worker.id && item.companyId === auth.company.id);
          if (!relevantRelationship) fail("O pedido exige uma candidatura ou vinculo relevante com esta empresa.",403);
          const purpose = text(body.purpose,500), lawfulBasis = text(body.lawfulBasis,80); if (!purpose || !ACCESS_LAWFUL_BASES.has(lawfulBasis)) fail("Indique a finalidade e uma base legal valida.");
          const request = { id:uid("agr"), workerId:worker.id, requesterCompanyId:auth.company.id, requestedBy:auth.user.id, purpose, lawfulBasis, status:"pending_dpia", requestedAt:stamp(), expiresAt:addDays(stamp(),ACCESS_REQUEST_DAYS), decidedAt:null, decisionBy:null }; db.companyAccessGrants.push(request);
          h.audit(db, auth, "access_request", request.id, "access_request.recorded_sharing_disabled", { workerId:worker.id, lawfulBasis }, req);
        } else if (accessUpdate && req.method === "PATCH") {
          h.requireWorker(auth); const request = db.companyAccessGrants.find(item => item.id === accessUpdate[1] && item.workerId === auth.user.id); if (!request) fail("Pedido nao encontrado.",404);
          if (body.decision !== "reject") fail("A partilha entre empresas permanece desativada; apenas pode recusar o pedido.",403); request.status = "rejected"; request.decidedAt = stamp(); request.decisionBy = auth.user.id;
          h.audit(db, auth, "access_request", request.id, "access_request.rejected", {}, req);
        } else fail("Operacao profissional nao encontrada.",404);
      }
      return response(db, auth);
    });
    h.sendJson(res, 200, result); return true;
  }
  return { handle, snapshot, maintain, syncLegacyCv };
}

module.exports = { TABLES, EMPTY_KEYS, CRITERIA, createProfessionalProfile };
