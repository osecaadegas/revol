const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "meo-smoke-"));
process.env.APP_DATA_DIR = tempDataDir;
process.env.PORT = "0";

const { createServer } = require("./index");

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

    const companyRegistration = await request(baseUrl, "POST", "/api/register/company", {
      companyName: "Empresa de Teste",
      name: "Responsavel Teste",
      email: "empresa@example.test",
      password: "password123",
      location: "Braga",
      sector: "Servicos operacionais"
    });
    const managerToken = companyRegistration.session.token;

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

    const workerRegistration = await request(baseUrl, "POST", "/api/register/worker", {
      name: "Worker Teste",
      email: "worker@example.test",
      password: "password123"
    });
    const workerToken = workerRegistration.session.token;

    const application = await request(baseUrl, "POST", `/api/job-offers/${jobResult.jobOffer.id}/apply`, {
      message: "Tenho disponibilidade imediata."
    }, workerToken);

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

    const orderResult = await request(baseUrl, "POST", "/api/work-orders", {
      title: "Servico de teste",
      address: "Rua de Teste 1",
      description: "Validar fluxo operacional.",
      photos: []
    }, managerToken);
    const workOrderId = orderResult.workOrder.id;

    const taskResult = await request(baseUrl, "POST", "/api/tasks", {
      workOrderId,
      title: "Tarefa de teste",
      description: "Executar validacao.",
      assigneeId: employeeId,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    }, managerToken);
    const taskId = taskResult.task.id;

    const login = await request(baseUrl, "POST", "/api/auth/login", {
      email: "operador@example.test",
      password: "password123"
    });
    const employeeToken = login.session.token;

    await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "in_progress"
    }, employeeToken);

    const evidence = await request(baseUrl, "POST", `/api/tasks/${taskId}/evidence`, {
      photo: { dataUrl: onePixelPng, name: "proof.png" },
      note: "Prova de teste.",
      location: { status: "denied" }
    }, employeeToken);

    await request(baseUrl, "PATCH", `/api/tasks/${taskId}/status`, {
      status: "pending_validation"
    }, employeeToken);

    await request(baseUrl, "POST", `/api/tasks/${taskId}/decision`, {
      decision: "approved",
      reason: "Validado em smoke test."
    }, managerToken);

    await request(baseUrl, "GET", `/api/evidence/${evidence.evidence.id}/file`, null, employeeToken);
    await request(baseUrl, "GET", `/api/evidence/${evidence.evidence.id}/file`, null, "", {
      Cookie: `meo_session=${employeeToken}`
    });

    const bootstrap = await request(baseUrl, "GET", "/api/bootstrap", null, employeeToken);
    if (bootstrap.tasks.length !== 1 || bootstrap.tasks[0].id !== taskId) {
      throw new Error("Employee bootstrap did not return the assigned task.");
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
