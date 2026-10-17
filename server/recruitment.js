const crypto = require("crypto");

const STAGES = ["submitted", "viewed", "reviewed", "contacted", "interview", "offer", "accepted", "hired", "rejected"];
const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const list = (value) => (Array.isArray(value) ? value : String(value || "").split(/[,\n]/)).map(v => text(v, 100)).filter(Boolean).slice(0, 30);
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const normalize = value => text(value, 6000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const stamp = () => new Date().toISOString();
const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
function number(value, max = 1000000) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) fail("Valor numerico invalido.");
  return n;
}
function coordinates(value) {
  if (!value || value.latitude === "" || value.longitude === "" || value.latitude == null || value.longitude == null) return null;
  const latitude = Number(value.latitude), longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) fail("Coordenadas invalidas.");
  return { latitude, longitude };
}
function distance(a, b) {
  if (!a || !b) return null;
  const rad = n => n * Math.PI / 180;
  const v = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, v))) * 10) / 10;
}
function open(job, company) {
  return job.status === "open" && !job.recruitment?.suspended && company?.recruitment?.verification !== "suspended" && (!job.recruitment?.deadline || Date.parse(job.recruitment.deadline) >= Date.now());
}
function salary(job) {
  const j = job.recruitment || {};
  if (j.salaryMin == null && j.salaryMax == null) return job.salary || "";
  const format = n => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(n);
  const amount = j.salaryMin != null && j.salaryMax != null ? `${format(j.salaryMin)} - ${format(j.salaryMax)}` : j.salaryMin != null ? `A partir de ${format(j.salaryMin)}` : `Ate ${format(j.salaryMax)}`;
  return `${amount} EUR / ${{ HOUR: "hora", DAY: "dia", WEEK: "semana", MONTH: "mes", YEAR: "ano" }[j.salaryPeriod || "MONTH"]}`;
}
function admin(user) {
  return String(process.env.PLATFORM_ADMIN_USER_IDS || "").split(",").map(v => v.trim()).filter(Boolean).includes(user.id);
}
function profileSettings(body, current = {}) {
  const merged = { ...current, ...body };
  const visibility = merged.visibility || "applications";
  if (!["private", "applications", "verified"].includes(visibility)) fail("Visibilidade invalida.");
  return {
    visibility, available: merged.available === true || merged.available === "true",
    availableFrom: text(merged.availableFrom, 10), certifications: list(merged.certifications), languages: list(merged.languages),
    schedules: list(merged.schedules), categories: list(merged.categories), preferredLocations: list(merged.preferredLocations),
    workModes: list(merged.workModes), employmentTypes: list(merged.employmentTypes),
    drivingLicence: merged.drivingLicence === true || merged.drivingLicence === "true",
    ownVehicle: merged.ownVehicle === true || merged.ownVehicle === "true",
    minimumSalary: number(merged.minimumSalary), radius: number(merged.radius, 1000),
    experienceYears: number(merged.experienceYears, 80), coordinates: coordinates(merged.coordinates)
  };
}
function jobDetails(body, current = {}) {
  const v = { ...current, ...body };
  const salaryMin = number(v.salaryMin), salaryMax = number(v.salaryMax);
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) fail("O salario maximo deve ser maior ou igual ao minimo.");
    const deadline = v.deadline ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v.deadline) ? `${v.deadline}T23:59:59.999Z` : v.deadline) : null;
  if (deadline && !Number.isFinite(deadline.getTime())) fail("Prazo de candidatura invalido.");
  const screening = (Array.isArray(v.screening) ? v.screening : []).slice(0, 8).map((q, i) => {
    if (!["boolean", "number", "choice", "text"].includes(q.type)) fail("Tipo de pergunta invalido.");
    const question = text(q.question, 240), options = list(q.options).slice(0, 10);
    if (!question || (q.type === "choice" && options.length < 2)) fail("Preencha a pergunta e as opcoes.");
    return { id: text(q.id || `q${i}`, 40), question, type: q.type, options, required: q.required !== false };
  });
  return {
    ...current, salaryMin, salaryMax,
    salaryPeriod: ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"].includes(v.salaryPeriod) ? v.salaryPeriod : "MONTH",
    employmentType: ["FULL_TIME", "PART_TIME", "TEMPORARY", "CONTRACTOR", "INTERN"].includes(v.employmentType) ? v.employmentType : "",
    workMode: ["onsite", "remote", "hybrid"].includes(v.workMode) ? v.workMode : "onsite",
    shift: ["day", "night", "rotating", "weekends"].includes(v.shift) ? v.shift : "",
    experienceYears: number(v.experienceYears, 80), skills: list(v.skills), certifications: list(v.certifications),
    benefits: text(v.benefits, 2000), immediate: v.immediate === true || v.immediate === "true",
    drivingLicence: v.drivingLicence === true || v.drivingLicence === "true", ownVehicle: v.ownVehicle === true || v.ownVehicle === "true",
    coordinates: coordinates(v.coordinates), deadline: deadline?.toISOString() || null, screening
  };
}
function answers(job, input = {}) {
  const result = {};
  for (const q of job.recruitment?.screening || []) {
    const value = text(input[q.id], 1000);
    if (q.required && !value) fail(`Responda: ${q.question}`);
    if (value && q.type === "boolean" && !["yes", "no"].includes(value)) fail("Resposta sim/nao invalida.");
    if (value && q.type === "number" && !Number.isFinite(Number(value))) fail("Resposta numerica invalida.");
    if (value && q.type === "choice" && !q.options.includes(value)) fail("Escolha uma opcao valida.");
    result[q.id] = { question: q.question, value };
  }
  return result;
}
function canDiscover(user, company) {
  const cv = user.profile?.workerCv;
  return user.active !== false && cv?.published && cv?.preferences?.visibility === "verified" && company?.recruitment?.verification === "verified";
}
function canReadProfile(db, user, auth) {
  if (user.id === auth.user.id) return true;
  if (!["company", "manager"].includes(auth.user.role)) return false;
  if (user.profile?.workerCv?.preferences?.visibility === "private") return false;
  return canDiscover(user, auth.company) || db.jobApplications.some(a => a.workerId === user.id && a.companyId === auth.company.id);
}
function match(job, user) {
  const cv = user.profile?.workerCv || {}, p = cv.preferences || {}, j = job.recruitment || {};
  const reasons = [], checks = [];
  const add = (condition, label) => { checks.push(condition); if (condition) reasons.push(label); };
  const km = distance(p.coordinates, j.coordinates);
  if (km != null && p.radius != null) add(km <= p.radius, "Dentro do raio de trabalho");
  if (j.skills?.length) add(j.skills.every(s => (cv.skills || []).some(x => normalize(x) === normalize(s))), "Competencias indicadas");
  if (j.certifications?.length) add(j.certifications.every(s => (p.certifications || []).some(x => normalize(x) === normalize(s))), "Certificacoes indicadas");
  if (j.experienceYears != null && p.experienceYears != null) add(p.experienceYears >= j.experienceYears, "Experiencia adequada");
  if (j.shift && p.schedules?.length) add(p.schedules.includes(j.shift), "Turno pretendido");
  if (p.minimumSalary != null && j.salaryMax != null && j.salaryPeriod === "MONTH") add(j.salaryMax >= p.minimumSalary, "Salario pretendido");
  if (j.drivingLicence) add(p.drivingLicence === true, "Carta de conducao");
  if (j.ownVehicle) add(p.ownVehicle === true, "Transporte proprio");
  if (j.immediate) add(p.available === true, "Disponibilidade imediata");
  return { percent: checks.length ? Math.round(checks.filter(Boolean).length / checks.length * 100) : null, reasons, distance: km, factors: checks.length };
}
const TABLES = [
  { key: "recruitmentMessages", table: "meo_recruitment_messages", idKey: "id", fields: { id:"id", companyId:"company_id", workerId:"worker_id", jobOfferId:"job_offer_id", senderId:"sender_id", body:"body", interviewAt:"interview_at", response:"response", readAt:"read_at", createdAt:"created_at" } },
  { key: "jobReports", table: "meo_job_reports", idKey: "id", fields: { id:"id", jobOfferId:"job_offer_id", userId:"user_id", reason:"reason", detail:"detail", status:"status", createdAt:"created_at" } }
];

function createRecruitment(h) {
  async function deliverAlerts(db) {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.PUBLIC_SITE_URL) return { sent: 0, configured: false };
    let sent = 0;
    const jobs = db.jobOffers.filter(j => open(j, db.companies.find(c => c.id === j.companyId)));
    for (const user of db.users.filter(u => u.role === "worker" && u.active !== false)) {
      for (const search of user.profile?.savedSearches || []) {
        if (search.frequency === "off") continue;
        const hours = search.frequency === "weekly" ? 168 : search.frequency === "daily" ? 24 : 0;
        if (Date.parse(search.lastSentAt) + hours * 3600000 > Date.now()) continue;
        const found = jobs.filter(j => {
          if (j.createdAt <= search.lastSentAt) return false;
          if (search.query && !normalize(`${j.title} ${j.description} ${j.position}`).includes(normalize(search.query))) return false;
          if (search.radius && search.coordinates) { const km = distance(search.coordinates, j.recruitment?.coordinates); if (km == null || km > search.radius) return false; }
          else if (search.location && !normalize(j.location).includes(normalize(search.location))) return false;
          if (search.minimumSalary != null && (j.recruitment?.salaryPeriod !== "MONTH" || (j.recruitment?.salaryMax ?? j.recruitment?.salaryMin ?? -1) < search.minimumSalary)) return false;
          return true;
        }).slice(0, 20);
        if (!found.length) continue;
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `alert-${search.id}-${search.lastSentAt}` },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [user.email], subject: `${found.length} novas vagas na TrataPro`, text: `${found.map(j => `${j.title} - ${j.location}\n${process.env.PUBLIC_SITE_URL.replace(/\/$/, "")}${h.publicJobPath(j)}`).join("\n\n")}\n\nPodes desativar estes emails nas pesquisas guardadas da tua conta.` }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Falha ao enviar alertas de emprego.");
        search.lastSentAt = stamp(); sent += 1;
        if (sent >= 40) return { sent, configured: true, remaining: true };
      }
    }
    return { sent, configured: true };
  }
  function snapshot(db, auth) {
    const company = ["company", "manager"].includes(auth.user.role);
    const applications = db.jobApplications.filter(a => company ? a.companyId === auth.company.id : a.workerId === auth.user.id);
    const jobs = db.jobOffers.filter(j => j.companyId === auth.company.id);
    const messages = (db.recruitmentMessages || []).filter(m => company ? m.companyId === auth.company.id : m.workerId === auth.user.id);
    const interviewed = applications.filter(a => (a.recruitment?.history || []).some(s => s.status === "interview")).length;
    const hired = applications.filter(a => ["accepted", "hired"].includes(a.status)).length;
    return {
      platformAdmin: admin(auth.user), savedJobs: auth.user.profile?.savedJobs || [], savedSearches: auth.user.profile?.savedSearches || [],
      documents: (auth.user.profile?.documents || []).map(({ storedName, ...doc }) => doc),
      messages: messages.slice(-200), emailAlertsEnabled: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      applications: applications.map(a => ({ id: a.id, jobOfferId: a.jobOfferId, status: a.status, jobTitle: db.jobOffers.find(j => j.id === a.jobOfferId)?.title, companyName: db.companies.find(c => c.id === a.companyId)?.name })),
      metrics: { activeVacancies: jobs.filter(j => open(j, auth.company)).length, newCandidates: applications.filter(a => a.status === "submitted").length,
        applications: applications.length, applicationToInterview: applications.length ? Math.round(interviewed / applications.length * 100) : null,
        interviewToHire: interviewed ? Math.round(applications.filter(a => ["accepted", "hired"].includes(a.status) && (a.recruitment?.history || []).some(s => s.status === "interview")).length / interviewed * 100) : null, hires: hired,
        awaitingReview: applications.filter(a => ["submitted", "viewed"].includes(a.status)).length, interviews: applications.filter(a => a.status === "interview").length,
        hiresThisMonth: applications.filter(a => ["accepted", "hired"].includes(a.status) && a.updatedAt.slice(0, 7) === stamp().slice(0, 7)).length },
      notifications: applications.filter(a => a.updatedAt > (auth.user.profile?.notificationsReadAt || "")).map(a => ({ id: a.id, text: `${db.jobOffers.find(j => j.id === a.jobOfferId)?.title || "Candidatura"}: ${a.status}`, createdAt: a.updatedAt }))
        .concat(messages.filter(m => (m.senderId !== auth.user.id && !m.readAt) || (m.senderId === auth.user.id && m.response && m.readAt > (auth.user.profile?.notificationsReadAt || ""))).map(m => ({ id: m.id, text: m.response ? "Resposta ao convite de entrevista" : m.interviewAt ? "Convite para entrevista" : "Nova mensagem", createdAt: m.createdAt })))
    };
  }
  function authorizedConversation(db, auth, jobId, workerId) {
    const job = db.jobOffers.find(j => j.id === jobId), worker = db.users.find(u => u.id === workerId && u.role === "worker" && u.active !== false);
    if (!job || !worker) fail("Conversa nao encontrada.", 404);
    const employer = ["company", "manager"].includes(auth.user.role) && job.companyId === auth.company.id;
    const candidate = auth.user.id === workerId;
    const related = db.jobApplications.some(a => a.jobOfferId === jobId && a.workerId === workerId) || (db.recruitmentMessages || []).some(m => m.jobOfferId === jobId && m.workerId === workerId);
    if (!employer && !candidate) fail("Sem acesso a esta conversa.", 403);
    if (!related && !(employer && canDiscover(worker, auth.company) && open(job, auth.company))) fail("A conversa requer uma candidatura ou um convite autorizado.", 403);
    return { job, worker };
  }
  async function handle(req, res, pathname) {
    if (!pathname.startsWith("/api/recruitment")) return false;
    const logoMatch = pathname.match(/^\/api\/recruitment\/company-logo\/([^/]+)$/);
    if (req.method === "GET" && logoMatch) {
      const db = await h.readDb();
      const company = db.companies.find(c => c.id === logoMatch[1] && c.recruitment?.verification !== "suspended");
      const logo = company?.recruitment?.logo;
      if (!logo) fail("Logotipo nao encontrado.", 404);
      const buffer = await h.readPrivateUploadFile(logo.storedName);
      res.writeHead(200, h.responseHeaders({ "Content-Type": logo.mimeType, "Content-Length": buffer.length, "Cache-Control": "public, max-age=300" }));
      res.end(buffer); return true;
    }
    if (req.method === "GET" && pathname === "/api/recruitment/export") {
      const db = await h.readDb(), auth = h.requireAuth(db, req);
      h.sendJson(res, 200, { user: h.publicUser(auth.user), recruitment: snapshot(db, auth) }, { "Content-Disposition": 'attachment; filename="tratapro-dados.json"' });
      return true;
    }
    const download = pathname.match(/^\/api\/recruitment\/documents\/([^/]+)$/);
    if (req.method === "GET" && download) {
      const file = await h.mutateDb(db => {
        const auth = h.requireAuth(db, req);
        const worker = db.users.find(u => u.profile?.documents?.some(d => d.id === download[1]));
        if (!worker || !canReadProfile(db, worker, auth)) fail("Documento nao encontrado.", 404);
        // Discovery previews never grant access to private CV files.
        if (worker.id !== auth.user.id && !db.jobApplications.some(a => a.workerId === worker.id && a.companyId === auth.company.id)) fail("Documento nao encontrado.", 404);
        const doc = worker.profile.documents.find(d => d.id === download[1]);
        h.audit(db, auth, "document", doc.id, "document.downloaded", { workerId: worker.id }, req);
        return doc;
      });
      const buffer = await h.readPrivateUploadFile(file.storedName);
      res.writeHead(200, h.responseHeaders({ "Content-Type": "application/pdf", "Content-Length": buffer.length, "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="documento.pdf"' }));
      res.end(buffer); return true;
    }
    if (req.method === "GET") {
      const db = await h.readDb(), auth = h.requireAuth(db, req);
      if (pathname === "/api/recruitment/candidates") {
        h.requireCompanyAccount(auth);
        if (auth.company.recruitment?.verification !== "verified") fail("A pesquisa requer uma empresa verificada.", 403);
        const q = new URL(req.url, "http://localhost").searchParams;
        const job = db.jobOffers.find(j => j.id === q.get("jobId") && j.companyId === auth.company.id);
        const radius = q.get("radius") ? number(q.get("radius"), 1000) : null;
        if (radius && !job?.recruitment?.coordinates) fail("Escolha uma vaga com localizacao GPS para pesquisar por distancia.");
        const profiles = db.users.filter(u => u.role === "worker" && canDiscover(u, auth.company)).map(u => {
          const cv = u.profile.workerCv, p = cv.preferences || {}, matching = job ? match(job, u) : null;
          return { id: u.id, name: u.name.split(" ")[0], headline: cv.headline, location: cv.location, bio: cv.bio, skills: cv.skills || [], preferences: { ...p, coordinates: undefined }, match: matching };
        }).filter(p => {
          if (q.get("query") && !normalize(`${p.headline} ${p.skills.join(" ")} ${p.location}`).includes(normalize(q.get("query")))) return false;
          if (q.get("certification") && !normalize((p.preferences.certifications || []).join(" ")).includes(normalize(q.get("certification")))) return false;
          if (q.get("language") && !normalize((p.preferences.languages || []).join(" ")).includes(normalize(q.get("language")))) return false;
          if (q.get("experience") && (p.preferences.experienceYears ?? -1) < number(q.get("experience"), 80)) return false;
          if (q.get("available") === "true" && !p.preferences.available) return false;
          if (q.get("drivingLicence") === "true" && !p.preferences.drivingLicence) return false;
          if (q.get("ownVehicle") === "true" && !p.preferences.ownVehicle) return false;
          if (radius && (p.match?.distance == null || p.match.distance > radius)) return false;
          return true;
        }).sort((a, b) => Number(b.preferences.available) - Number(a.preferences.available) || (b.match?.percent || 0) - (a.match?.percent || 0));
        const page = Math.max(1, Math.floor(Number(q.get("page")) || 1));
        h.sendJson(res, 200, { profiles: profiles.slice((page - 1) * 30, page * 30), total: profiles.length, page });
      } else if (pathname === "/api/recruitment/admin") {
        if (!admin(auth.user)) fail("Acesso reservado a administracao.", 403);
        h.sendJson(res, 200, { companies: db.companies.filter(c => db.users.some(u => u.companyId === c.id && ["company", "manager"].includes(u.role))).map(h.publicCompany),
          users: db.users.map(u => ({ id: u.id, name: u.name, role: u.role, active: u.active })), jobs: db.jobOffers.map(h.publicJobOffer), reports: db.jobReports || [], audit: db.auditLogs.slice(-100),
          metrics: { workers: db.users.filter(u => u.role === "worker" && u.active !== false).length, companies: db.companies.filter(c => db.users.some(u => u.companyId === c.id && u.role === "company")).length, applications: db.jobApplications.length, hires: db.jobApplications.filter(a => ["accepted", "hired"].includes(a.status)).length } });
      } else if (pathname === "/api/recruitment") h.sendJson(res, 200, snapshot(db, auth));
      else fail("Pagina nao encontrada.", 404);
      return true;
    }
    const body = await h.readBody(req, 9 * 1024 * 1024);
    const result = await h.mutateDb(async db => {
      const auth = h.requireAuth(db, req);
      auth.user.profile ||= {};
      db.recruitmentMessages ||= []; db.jobReports ||= [];
      const p = auth.user.profile;
      if (pathname === "/api/recruitment/preferences" && req.method === "PATCH") {
        h.requireWorker(auth);
        p.workerCv ||= {};
        p.workerCv.preferences = profileSettings(body, p.workerCv.preferences);
      } else if (pathname === "/api/recruitment/application-view" && req.method === "POST") {
        h.requireCompanyAccount(auth);
        const application = db.jobApplications.find(a => a.id === body.id && a.companyId === auth.company.id);
        if (!application) fail("Candidatura nao encontrada.", 404);
        application.recruitment ||= {};
        if (!application.recruitment.viewedAt) {
          application.recruitment.viewedAt = stamp();
          if (application.status === "submitted") {
            application.status = "viewed"; application.updatedAt = stamp();
            application.recruitment.history = [...(application.recruitment.history || []), { status: "viewed", at: stamp() }];
          }
          h.audit(db, auth, "worker_profile", application.workerId, "worker_profile.viewed", { applicationId: application.id }, req);
        }
      } else if (pathname === "/api/recruitment/saved-jobs" && req.method === "POST") {
        h.requireWorker(auth);
        if (!db.jobOffers.some(j => j.id === body.jobId)) fail("Vaga nao encontrada.", 404);
        const saved = new Set(p.savedJobs || []);
        saved.has(body.jobId) ? saved.delete(body.jobId) : saved.add(body.jobId);
        p.savedJobs = [...saved].slice(-200);
      } else if (pathname === "/api/recruitment/searches" && req.method === "POST") {
        h.requireWorker(auth);
        if ((p.savedSearches || []).length >= 20) fail("Pode guardar ate 20 pesquisas.");
        if (!text(body.query) && !text(body.location)) fail("Indique uma profissao ou localizacao.");
        if (body.frequency !== "off" && !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)) fail("Os alertas por email ainda nao estao disponiveis.");
        p.savedSearches = [...(p.savedSearches || []), { id: uid("search"), query: text(body.query, 160), location: text(body.location, 160), radius: number(body.radius, 1000), minimumSalary: number(body.minimumSalary), coordinates: coordinates(body.coordinates), frequency: ["instant", "daily", "weekly"].includes(body.frequency) ? body.frequency : "off", createdAt: stamp(), lastSentAt: stamp() }];
      } else if (pathname === "/api/recruitment/searches" && req.method === "DELETE") {
        p.savedSearches = (p.savedSearches || []).filter(s => s.id !== body.id);
      } else if (pathname === "/api/recruitment/documents" && req.method === "POST") {
        h.requireWorker(auth);
        const match = String(body.dataUrl || "").match(/^data:application\/pdf;base64,([A-Za-z0-9+/=\r\n]+)$/);
        if (!match) fail("Envie um documento PDF.");
        const buffer = Buffer.from(match[1], "base64");
        if (buffer.length > 6 * 1024 * 1024 || buffer.subarray(0, 5).toString() !== "%PDF-" || !buffer.subarray(-1024).includes(Buffer.from("%%EOF"))) fail("PDF invalido ou superior a 6 MB.");
        if ((p.documents || []).length >= 5) fail("Pode guardar ate cinco documentos.");
        const doc = { id: uid("doc"), name: text(body.name, 120), kind: body.kind === "certificate" ? "certificate" : "cv", storedName: `documents/${auth.user.id}/${crypto.randomUUID()}.pdf`, createdAt: stamp(), size: buffer.length };
        await h.savePrivateUploadFile(doc.storedName, "application/pdf", buffer);
        p.documents = [...(p.documents || []), doc];
      } else if (pathname === "/api/recruitment/documents" && req.method === "DELETE") {
        const doc = (p.documents || []).find(d => d.id === body.id);
        if (!doc) fail("Documento nao encontrado.", 404);
        await h.deletePrivateUploadFile(doc.storedName);
        p.documents = p.documents.filter(d => d.id !== doc.id);
      } else if (pathname === "/api/recruitment/company" && req.method === "PATCH") {
        h.requireCompanyAccount(auth);
        const c = auth.company;
        const originalName = c.name;
        for (const key of ["name", "location", "sector", "description"]) if (body[key] !== undefined) c[key] = text(body[key], key === "description" ? 2400 : 180);
        if (!c.name) fail("Indique o nome da empresa.");
        if (body.website !== undefined) { c.website = h.safeHttpUrl(body.website); if (body.website && !c.website) fail("Website invalido."); }
        const r = c.recruitment || {};
        const requestedNif = h.requireValidNif(body.nif ?? c.nif ?? r.nif);
        if (c.nif && requestedNif !== c.nif) fail("O NIF da empresa nao pode ser alterado neste perfil.", 409);
        h.assertNifAvailable(db, requestedNif, { companyId: c.id });
        const nif = c.nif || requestedNif;
        c.nif = nif;
        c.recruitment = { ...r, nif, size: text(body.size ?? r.size, 80), benefits: text(body.benefits ?? r.benefits, 2000), verification: r.verification || "pending" };
        if (body.logo?.dataUrl) {
          const image = h.parsePhotoDataUrl(body.logo);
          const storedName = `company-logos/${c.id}/${crypto.randomUUID()}.${image.ext}`;
          await h.savePrivateUploadFile(storedName, image.mimeType, image.buffer);
          c.recruitment.logo = { storedName, mimeType: image.mimeType };
        }
        if (r.verification === "verified" && (nif !== r.nif || c.name !== originalName)) c.recruitment.verification = "pending";
        if (body.requestVerification) {
          if (!nif || !c.description || !c.location) fail("Preencha NIF, localizacao e descricao antes de pedir verificacao.");
          if (r.verification === "suspended") fail("Contacte a administracao para rever a suspensao.", 403);
          c.recruitment.verification = "pending";
          c.recruitment.requestedAt = stamp();
        }
      } else if (pathname === "/api/recruitment/messages" && req.method === "POST") {
        const { job } = authorizedConversation(db, auth, body.jobId, body.workerId);
        const message = text(body.body, 3000);
        if (!message) fail("Escreva uma mensagem.");
        if (db.recruitmentMessages.filter(m => m.senderId === auth.user.id && Date.parse(m.createdAt) > Date.now() - 60000).length >= 10) fail("Aguarde um minuto antes de enviar mais mensagens.", 429);
        const interview = body.interviewAt ? new Date(body.interviewAt) : null;
        if (interview && (!Number.isFinite(interview.getTime()) || interview.getTime() <= Date.now() || auth.user.role === "worker")) fail("Data de entrevista invalida.");
        db.recruitmentMessages.push({ id: uid("msg"), companyId: job.companyId, jobOfferId: job.id, workerId: body.workerId, senderId: auth.user.id, body: message, interviewAt: interview?.toISOString() || null, response: null, readAt: null, createdAt: stamp() });
      } else if (pathname === "/api/recruitment/messages" && req.method === "PATCH") {
        const m = db.recruitmentMessages.find(m => m.id === body.id);
        if (!m) fail("Mensagem nao encontrada.", 404);
        authorizedConversation(db, auth, m.jobOfferId, m.workerId);
        if (m.senderId === auth.user.id) fail("Apenas o destinatario pode responder.", 403);
        m.readAt = stamp();
        if (body.response) {
          if (!m.interviewAt || auth.user.id !== m.workerId || !["accepted", "alternative"].includes(body.response)) fail("Resposta invalida.");
          m.response = body.response;
        }
      } else if (pathname === "/api/recruitment/notifications" && req.method === "PATCH") {
        p.notificationsReadAt = stamp();
      } else if (pathname === "/api/recruitment/reports" && req.method === "POST") {
        if (!db.jobOffers.some(j => j.id === body.jobId)) fail("Vaga nao encontrada.", 404);
        const reasons = ["fake", "fraud", "salary", "discrimination", "money", "closed", "spam", "other"];
        if (!reasons.includes(body.reason)) fail("Escolha um motivo.");
        if (db.jobReports.filter(r => r.userId === auth.user.id && Date.parse(r.createdAt) > Date.now() - 86400000).length >= 10) fail("Limite diario de denuncias atingido.", 429);
        db.jobReports.push({ id: uid("report"), userId: auth.user.id, jobOfferId: body.jobId, reason: body.reason, detail: text(body.detail, 1600), status: "pending", createdAt: stamp() });
      } else if (pathname === "/api/recruitment/admin" && req.method === "PATCH") {
        if (!admin(auth.user)) fail("Acesso reservado a administracao.", 403);
        if (body.companyId) {
          const c = db.companies.find(c => c.id === body.companyId);
          if (!c || !["pending", "verified", "rejected", "suspended"].includes(body.verification)) fail("Pedido invalido.");
          if (body.verification === "verified" && !c.recruitment?.nif) fail("A empresa ainda nao indicou o NIF.");
          c.recruitment = { ...c.recruitment, verification: body.verification, reviewedAt: stamp(), reviewedBy: auth.user.id };
        } else if (body.reportId) {
          const report = db.jobReports.find(r => r.id === body.reportId);
          if (!report || !["reviewed", "dismissed"].includes(body.status)) fail("Denuncia invalida.");
          report.status = body.status;
        } else if (body.jobId) {
          const job = db.jobOffers.find(j => j.id === body.jobId);
          if (!job || typeof body.suspended !== "boolean") fail("Vaga invalida.");
          job.recruitment = { ...job.recruitment, suspended: body.suspended };
        } else if (body.userId) {
          const user = db.users.find(u => u.id === body.userId);
          if (!user || user.id === auth.user.id || typeof body.active !== "boolean") fail("Utilizador invalido.");
          user.active = body.active;
          if (!user.active) db.sessions = db.sessions.filter(s => s.userId !== user.id);
        } else fail("Indique o registo a atualizar.");
      } else if (pathname === "/api/recruitment/account" && req.method === "DELETE") {
        h.requireWorker(auth);
        if (body.confirm !== "ELIMINAR") fail("Confirme com ELIMINAR.");
        for (const doc of p.documents || []) await h.deletePrivateUploadFile(doc.storedName);
        if (p.workerCv?.profilePhoto?.storedName) await h.deletePrivateUploadFile(p.workerCv.profilePhoto.storedName);
        for (const doc of (db.cvDocuments || []).filter(d => d.workerId === auth.user.id && !d.deletedAt)) {
          await h.deletePrivateUploadFile(doc.storedName).catch(() => {});
          doc.deletedAt = stamp(); doc.extractedData = {};
        }
        const cvProfile = (db.cvProfiles || []).find(profile => profile.workerId === auth.user.id);
        if (cvProfile) Object.assign(cvProfile, { status:"archived", headline:"", summary:"", personalDetails:{}, skills:[], qualifications:[], certifications:[], education:[], workHistory:[], languages:[], licences:[], preferences:{}, availability:{}, updatedAt:stamp() });
        for (const version of (db.cvVersions || []).filter(version => version.workerId === auth.user.id)) version.snapshot = {};
        for (const grant of (db.companyAccessGrants || []).filter(grant => grant.workerId === auth.user.id && grant.status === "pending_dpia")) { grant.status = "rejected"; grant.decidedAt = stamp(); grant.decisionBy = auth.user.id; }
        (db.dataRetentionActions ||= []).push({ id:uid("ret"), entityType:"worker_account", entityId:auth.user.id, workerId:auth.user.id, action:"restricted", reason:"account_deletion_requested_employment_records_follow_configured_retention", executeAfter:stamp(), executedAt:stamp(), createdBy:auth.user.id, createdAt:stamp() });
        db.sessions = db.sessions.filter(s => s.userId !== auth.user.id);
        db.jobApplications = db.jobApplications.filter(a => a.workerId !== auth.user.id);
        db.recruitmentMessages = db.recruitmentMessages.filter(m => m.workerId !== auth.user.id);
        for (const log of db.auditLogs.filter(l => l.actorId === auth.user.id)) { log.actorName = "Conta eliminada"; log.ip = ""; log.detail = {}; }
        auth.user.name = "Conta eliminada"; auth.user.email = `${crypto.randomUUID()}@deleted.invalid`; auth.user.nif = null; auth.user.passwordHash = h.hashPassword(crypto.randomBytes(32).toString("hex")); auth.user.active = false; auth.user.profile = {};
      } else fail("Operacao nao encontrada.", 404);
      h.audit(db, auth, "recruitment", auth.user.id, `recruitment.${pathname.split("/").pop()}.${req.method.toLowerCase()}`, {}, req);
      return { recruitment: snapshot(db, auth), bootstrap: h.buildBootstrap(db, auth) };
    });
    h.sendJson(res, 200, result); return true;
  }
  return { handle, snapshot, deliverAlerts };
}
module.exports = { TABLES, STAGES, admin, open, salary, coordinates, distance, profileSettings, jobDetails, answers, canDiscover, canReadProfile, match, createRecruitment };
