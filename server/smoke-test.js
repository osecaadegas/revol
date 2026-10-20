const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "meo-smoke-"));
process.env.APP_DATA_DIR = tempDataDir;
process.env.PORT = "0";
process.env.CRON_SECRET = "smoke-cron-secret";

const { createServer } = require("./index");

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const gpsLocation = {
  status: "granted",
  latitude: 41.5454,
  longitude: -8.4265,
  accuracy: 8,
  capturedAt: new Date().toISOString()
};

function smokePhoto(name) {
  return {
    dataUrl: onePixelPng,
    name,
    type: "image/png",
    size: 68,
    lastModified: Date.now()
  };
}

function request(baseUrl, method, pathName, body, token, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (response) => {
    const type = response.headers.get("content-type") || "";
    const payload = type.includes("application/json") ? await response.json() : await response.arrayBuffer();
    if (!response.ok) {
      throw new Error(`${method} ${pathName} failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    return payload;
  });
}

async function requestRaw(baseUrl, method, pathName, body, token, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.arrayBuffer();
  return { status: response.status, payload };
}

async function requestText(baseUrl, pathName) {
  const response = await fetch(`${baseUrl}${pathName}`);
  const payload = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${pathName} failed: ${response.status} ${payload.slice(0, 160)}`);
  }
  return payload;
}

async function run() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const beforeJobs = await request(baseUrl, "GET", "/api/jobs/public");
    if (!Array.isArray(beforeJobs.jobs) || beforeJobs.jobs.length !== 0) {
      throw new Error("Public jobs should start empty in smoke test.");
    }

    const robots = await requestText(baseUrl, "/robots.txt");
    if (!robots.includes("Disallow: /api/") || !robots.includes(`${baseUrl}/sitemap.xml`)) {
      throw new Error("robots.txt should disallow API crawling and expose the sitemap URL.");
    }

    const homeResponse = await fetch(`${baseUrl}/`);
    const homeHtml = await homeResponse.text();
    if (!homeResponse.ok) {
      throw new Error(`GET / failed: ${homeResponse.status} ${homeHtml.slice(0, 160)}`);
    }
    if (!homeHtml.includes(`<link rel="canonical" href="${baseUrl}/">`) || !homeHtml.includes("site-structured-data")) {
      throw new Error("Home page should expose canonical metadata and structured data.");
    }
    if (!homeHtml.includes("summary_large_image") || !homeHtml.includes(`${baseUrl}/social-card.svg`)) {
      throw new Error("Home page should expose a large branded social preview image.");
    }
    if (!homeResponse.headers.get("content-security-policy")?.includes("frame-src https://www.google.com https://maps.google.com") || homeResponse.headers.get("x-frame-options") !== "DENY") {
      throw new Error("Home page should expose baseline security headers.");
    }

    const clientHtml = await requestText(baseUrl, "/cliente");
    if (!clientHtml.includes('content="noindex,follow"') || !clientHtml.includes(`${baseUrl}/social-card.svg`)) {
      throw new Error("Reserved client gate should be noindex and still expose branded preview metadata.");
    }

    const blockedStatic = await fetch(`${baseUrl}/data/test`);
    const blockedStaticHtml = await blockedStatic.text();
    if (blockedStatic.status !== 404 || !blockedStaticHtml.includes("noindex,follow")) {
      throw new Error("Reserved static-like paths should return a noindex 404 instead of the public homepage.");
    }

    const companyRegistration = await request(baseUrl, "POST", "/api/register/company", {
      companyName: "Empresa de Teste",
      nif: "502544180",
      name: "Responsavel Teste",
      email: "empresa@example.test",
      password: "password123",
      location: "Braga",
      sector: "Servicos operacionais"
    });
    const managerToken = companyRegistration.session.token;

    const managerProjectAccess = await requestRaw(baseUrl, "GET", "/api/project/private", null, managerToken);
    if (managerProjectAccess.status !== 403) {
      throw new Error("Company accounts should not access the private project dashboard.");
    }

    const jobResult = await request(baseUrl, "POST", "/api/job-offers", {
      title: "Operador de teste",
      position: "Operador operacional",
      location: "Braga",
      contractType: "Projeto",
      salary: "A combinar",
      schedule: "Dias uteis",
      description: "Executar trabalho operacional de teste.",
      requirements: "Disponibilidade e experiencia pratica."
    }, managerToken);

    const publicJobs = await request(baseUrl, "GET", "/api/jobs/public");
    if (publicJobs.jobs.length !== 1 || publicJobs.jobs[0].id !== jobResult.jobOffer.id) {
      throw new Error("Public job board did not expose the company vacancy.");
    }

    const sitemap = await requestText(baseUrl, "/sitemap.xml");
    if (!sitemap.includes(`${baseUrl}/vagas/${jobResult.jobOffer.id}`) || !sitemap.includes("<urlset")) {
      throw new Error("Sitemap should include open public vacancy detail pages.");
    }
    if (sitemap.includes(`${baseUrl}/cliente`)) {
      throw new Error("Sitemap should not include the reserved client gate.");
    }

    const jobPage = await requestText(baseUrl, `/vagas/${jobResult.jobOffer.id}`);
    if (
      !jobPage.includes("JobPosting") ||
      !jobPage.includes("Operador operacional") ||
      !jobPage.includes(`<link rel="canonical" href="${baseUrl}${jobResult.jobOffer.publicPath}">`) ||
      !jobPage.includes(`${baseUrl}/social-card.svg`)
    ) {
      throw new Error("Public vacancy detail page should expose crawlable job content and JobPosting structured data.");
    }

    const missingJobPage = await fetch(`${baseUrl}/vagas/not-found`);
    const missingJobHtml = await missingJobPage.text();
    if (missingJobPage.status !== 404 || !missingJobHtml.includes("noindex,follow")) {
      throw new Error("Missing or closed vacancy detail pages should return 404 with noindex metadata.");
    }

    const invalidNifRegistration = await requestRaw(baseUrl, "POST", "/api/register/worker", {
      name: "Worker NIF Invalido",
      nif: "123456780",
      email: "worker-invalid-nif@example.test",
      password: "password123"
    });
    if (invalidNifRegistration.status !== 400) {
      throw new Error("Worker registration should reject an invalid Portuguese NIF.");
    }

    const duplicateCompanyNif = await requestRaw(baseUrl, "POST", "/api/register/worker", {
      name: "Worker NIF Duplicado",
      nif: "502544180",
      email: "worker-duplicate-company-nif@example.test",
      password: "password123"
    });
    if (duplicateCompanyNif.status !== 409) {
      throw new Error("Worker registration should reject a NIF already used by a company.");
    }

    const workerRegistration = await request(baseUrl, "POST", "/api/register/worker", {
      name: "Worker Teste",
      nif: "200000004",
      email: "worker@example.test",
      password: "password123"
    });
    const workerToken = workerRegistration.session.token;
    if (Object.hasOwn(workerRegistration.bootstrap.user, "nif")) {
      throw new Error("Worker NIF must not be exposed in bootstrap/public user responses.");
    }

    const duplicateWorkerNif = await requestRaw(baseUrl, "POST", "/api/register/worker", {
      name: "Segundo Worker",
      nif: "200000004",
      email: "worker-duplicate@example.test",
      password: "password123"
    });
    if (duplicateWorkerNif.status !== 409) {
      throw new Error("Worker registration should reject a NIF already used by another worker.");
    }

    const blockedApplication = await requestRaw(baseUrl, "POST", `/api/job-offers/${jobResult.jobOffer.id}/apply`, {
      message: "Tentativa antes de publicar CV."
    }, workerToken);
    if (blockedApplication.status !== 400) {
      throw new Error("Workers should need a published CV before applying.");
    }

    const workerProfile = await request(baseUrl, "PATCH", "/api/workers/profile", {
      published: true,
      headline: "Operador operacional",
      birthDate: "1990-01-01",
      location: "Braga",
      phone: "+351 910 000 000",
      availability: "Imediata",
      skills: ["Operacao", "Ferramentas", "Seguranca"],
      bio: "Experiencia pratica em servicos operacionais.",
      experience: [
        {
          title: "Operador",
          company: "Empresa Antiga",
          location: "Braga",
          startDate: "2020-01-01",
          endDate: "2023-01-01",
          description: "Servicos operacionais e apoio de equipa."
        }
      ],
      references: [
        {
          name: "Chefe Antigo",
          company: "Empresa Antiga",
          role: "Encarregado",
          relationship: "Antigo responsavel",
          phone: "+351 920 000 000",
          email: "chefe@example.test"
        }
      ],
      photo: smokePhoto("profile.png")
    }, workerToken);
    if (!workerProfile.profile?.published || !workerProfile.profile.profilePhotoUrl) {
      throw new Error("Worker profile should be published with a private photo URL.");
    }
    await request(baseUrl, "GET", workerProfile.profile.profilePhotoUrl, null, workerToken);

    const application = await request(baseUrl, "POST", `/api/job-offers/${jobResult.jobOffer.id}/apply`, {
      message: "Tenho disponibilidade imediata."
    }, workerToken);

    const companyCandidateBootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, managerToken);
    if (companyCandidateBootstrap.workerProfiles?.some((profile) => profile.id === workerProfile.profile.id)) {
      throw new Error("Unverified companies must not discover worker profiles.");
    }
    const companyApplication = companyCandidateBootstrap.jobApplications.find((item) => item.id === application.application.id);
    if (!companyApplication?.workerProfile?.skills?.includes("Operacao")) {
      throw new Error("Company application should include the published worker CV.");
    }
    await request(baseUrl, "GET", companyApplication.workerProfile.profilePhotoUrl, null, managerToken);

    await request(baseUrl, "PATCH", `/api/applications/${application.application.id}`, {
      status: "reviewed",
      decisionReason: "Perfil em analise."
    }, managerToken);

    const userResult = await request(baseUrl, "POST", "/api/users", {
      name: "Operador Teste",
      email: "operador@example.test",
      role: "employee",
      password: "password123"
    }, managerToken);
    const employeeId = userResult.user.id;

    const clientUser = await request(baseUrl, "POST", "/api/users", {
      name: "Cliente Teste",
      email: "cliente@example.test",
      role: "client",
      password: "password123"
    }, managerToken);

    const developerUser = await request(baseUrl, "POST", "/api/users", {
      name: "Developer Teste",
      email: "developer@example.test",
      role: "developer",
      password: "password123"
    }, managerToken);

    if (clientUser.user.role !== "client" || developerUser.user.role !== "developer") {
      throw new Error("Client/developer managed roles were not created.");
    }

    const orderResult = await request(baseUrl, "POST", "/api/work-orders", {
      title: "Servico de teste",
      address: "Rua de Teste 1",
      description: "Validar fluxo operacional.",
      photos: []
    }, managerToken);
    const workOrderId = orderResult.workOrder.id;

    const clientTaskAssignment = await requestRaw(baseUrl, "POST", "/api/tasks", {
      workOrderId,
      title: "Tarefa de cliente invalida",
      assigneeId: clientUser.user.id,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    }, managerToken);
    if (clientTaskAssignment.status !== 400) {
      throw new Error("Client users should not be valid task assignees.");
    }

    const taskResult = await request(baseUrl, "POST", "/api/tasks", {
      workOrderId,
      title: "Tarefa de teste",
      description: "Executar validacao.",
      assigneeId: employeeId,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    }, managerToken);
    const taskId = taskResult.task.id;
    if (taskResult.task.workAddress !== "Rua de Teste 1" || taskResult.task.workLocation.status !== "not_requested") {
      throw new Error("Task planning should derive its map from the work address without requiring GPS coordinates.");
    }

    const login = await request(baseUrl, "POST", "/api/auth/login", {
      email: "operador@example.test",
      password: "password123"
    });
    const employeeToken = login.session.token;

    await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "in_progress"
    }, employeeToken);

    const missingSetbackReason = await requestRaw(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "blocked"
    }, employeeToken);
    if (missingSetbackReason.status !== 400) {
      throw new Error("A task setback should require a reason.");
    }

    const setbackReason = "O acesso à zona de carga está encerrado.";
    const setback = await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "blocked",
      blockReason: setbackReason
    }, employeeToken);
    if (setback.task.status !== "blocked" || setback.task.blockReason !== setbackReason) {
      throw new Error("The worker setback and its reason should be persisted.");
    }

    const unauthenticatedAlerts = await requestRaw(baseUrl, "GET", "/api/operational-alerts");
    if (unauthenticatedAlerts.status !== 401) {
      throw new Error("Operational alerts must require authentication.");
    }
    const workerAlerts = await requestRaw(baseUrl, "GET", "/api/operational-alerts", null, employeeToken);
    if (workerAlerts.status !== 403) {
      throw new Error("Workers must not read company operational alerts.");
    }
    const liveAlerts = await request(baseUrl, "GET", "/api/operational-alerts", null, managerToken);
    if (liveAlerts.alerts?.[0]?.taskId !== taskId || liveAlerts.alerts[0].reason !== setbackReason) {
      throw new Error("The company should receive the active setback through the refresh endpoint.");
    }
    const otherCompany = await request(baseUrl, "POST", "/api/register/company", {
      companyName: "Outra Empresa de Teste",
      nif: "509779018",
      name: "Responsavel Externo",
      email: "outra-empresa@example.test",
      password: "password123",
      location: "Porto",
      sector: "Servicos operacionais"
    });
    const otherCompanyAlerts = await request(baseUrl, "GET", "/api/operational-alerts", null, otherCompany.session.token);
    if (otherCompanyAlerts.alerts.length !== 0) {
      throw new Error("A different company must not read another company's setback alerts.");
    }

    const setbackBootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, managerToken);
    const setbackAlert = setbackBootstrap.operationalAlerts?.find((item) => item.taskId === taskId);
    if (!setbackAlert || setbackAlert.assigneeName !== "Operador Teste" || setbackAlert.workOrderTitle !== "Servico de teste" || setbackAlert.reason !== setbackReason || !setbackAlert.message.includes("Tarefa de teste")) {
      throw new Error("The company should receive a complete operational setback alert.");
    }

    await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "in_progress"
    }, employeeToken);
    const resumedBootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, managerToken);
    if (resumedBootstrap.operationalAlerts?.some((item) => item.taskId === taskId)) {
      throw new Error("A resumed task should no longer appear as an active setback alert.");
    }
    const resolvedAlerts = await request(baseUrl, "GET", "/api/operational-alerts", null, managerToken);
    if (resolvedAlerts.alerts.some((item) => item.taskId === taskId)) {
      throw new Error("The live company alert must disappear after work resumes.");
    }

    const deniedEvidence = await requestRaw(baseUrl, "POST", `/api/tasks/${taskId}/evidence`, {
      photos: [smokePhoto("denied.png")],
      note: "Prova sem GPS.",
      location: { status: "denied" }
    }, employeeToken);
    if (deniedEvidence.status !== 400) {
      throw new Error("Final task evidence without GPS should be rejected.");
    }

    const firstEvidence = await request(baseUrl, "POST", `/api/tasks/${taskId}/evidence`, {
      photos: [smokePhoto("proof-1.png"), smokePhoto("proof-2.png")],
      note: "Provas de teste.",
      location: gpsLocation
    }, employeeToken);

    const earlyValidation = await requestRaw(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "pending_validation"
    }, employeeToken);
    if (earlyValidation.status !== 400) {
      throw new Error("Task validation should require at least three GPS-authenticated photos.");
    }

    const thirdEvidence = await request(baseUrl, "POST", `/api/tasks/${taskId}/evidence`, {
      photos: [smokePhoto("proof-3.png")],
      note: "Terceira prova.",
      location: gpsLocation
    }, employeeToken);

    const submittedTask = await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "pending_validation"
    }, employeeToken);
    if (!submittedTask.task.validationDueAt) {
      throw new Error("Submitted tasks should include a 12-hour validation deadline.");
    }

    await request(baseUrl, "POST", `/api/tasks/${taskId}/decision`, {
      decision: "approved",
      reason: "Validado em smoke test."
    }, managerToken);

    const reminderTaskResult = await request(baseUrl, "POST", "/api/tasks", {
      workOrderId,
      title: "Tarefa para lembrete",
      description: "Validar lembretes.",
      assigneeId: employeeId,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    }, managerToken);
    const reminderTaskId = reminderTaskResult.task.id;

    await request(baseUrl, "PATCH", `/api/tasks/${reminderTaskId}/status`, {
      status: "in_progress"
    }, employeeToken);

    await request(baseUrl, "POST", `/api/tasks/${reminderTaskId}/evidence`, {
      photos: [smokePhoto("reminder-1.png"), smokePhoto("reminder-2.png"), smokePhoto("reminder-3.png")],
      note: "Provas para lembrete.",
      location: gpsLocation
    }, employeeToken);

    await request(baseUrl, "PATCH", `/api/tasks/${reminderTaskId}/status`, {
      status: "pending_validation"
    }, employeeToken);

    const cronUnauthorized = await requestRaw(baseUrl, "GET", "/api/cron/operational-maintenance", null, "");
    if (cronUnauthorized.status !== 401) {
      throw new Error("Cron maintenance should reject missing authorization.");
    }

    const cronResult = await request(baseUrl, "GET", "/api/cron/operational-maintenance", null, "smoke-cron-secret");
    if (!cronResult.ok || cronResult.validationRemindersCreated < 1) {
      throw new Error("Cron maintenance should create validation reminder audit entries.");
    }

    const managerBootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, managerToken);
    if (!managerBootstrap.validationAlerts?.some((alert) => alert.taskId === reminderTaskId)) {
      throw new Error("Manager bootstrap should include pending validation alerts.");
    }
    if (!managerBootstrap.auditLogs.some((log) => log.action === "task.validation_reminder")) {
      throw new Error("Manager audit history should include validation reminders.");
    }

    const evidenceId = firstEvidence.evidences[0].id;
    if (thirdEvidence.evidences.length !== 1) {
      throw new Error("Third evidence upload did not store exactly one photo.");
    }
    await request(baseUrl, "GET", `/api/evidence/${evidenceId}/file`, null, employeeToken);
    await request(baseUrl, "GET", `/api/evidence/${evidenceId}/file`, null, "", {
      Cookie: `meo_session=${employeeToken}`
    });
    const watermarkedDownload = await request(baseUrl, "GET", `/api/evidence/${evidenceId}/download`, null, employeeToken);
    const watermarkedSvg = new TextDecoder().decode(watermarkedDownload);
    if (
      !watermarkedSvg.includes('id="tratapro-evidence-metadata"') ||
      !watermarkedSvg.includes("&quot;fileHash&quot;") ||
      !watermarkedSvg.includes("&quot;location&quot;")
    ) {
      throw new Error("Watermarked evidence download should embed structured metadata.");
    }

    const bootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, employeeToken);
    if (!bootstrap.tasks.some((task) => task.id === taskId) || !bootstrap.tasks.some((task) => task.id === reminderTaskId)) {
      throw new Error("Employee bootstrap did not return the assigned task.");
    }

    const clientLogin = await request(baseUrl, "POST", "/api/auth/login", {
      email: "cliente@example.test",
      password: "password123"
    });
    const clientToken = clientLogin.session.token;

    const clientProject = await request(baseUrl, "GET", "/api/project/private", null, clientToken);
    if (!clientProject.html.includes("Dashboard MANIFESTO")) {
      throw new Error("Client project endpoint did not return the private dashboard.");
    }

    const clientMvp = await request(baseUrl, "GET", "/api/mvp/private", null, clientToken);
    if (!clientMvp.html.includes("Desenvolvimento do MVP")) {
      throw new Error("Client MVP endpoint did not return the private MVP cockpit.");
    }

    const clientBootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, clientToken);
    if (clientBootstrap.tasks.length || clientBootstrap.workOrders.length || clientBootstrap.evidences.length) {
      throw new Error("Client bootstrap should not expose operational records directly.");
    }

    const clientOperationalWrite = await requestRaw(baseUrl, "POST", "/api/work-orders", {
      title: "Nao autorizado",
      address: "Sem permissao"
    }, clientToken);
    if (clientOperationalWrite.status !== 403) {
      throw new Error("Client accounts should not create work orders.");
    }

    console.log("smoke ok");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
