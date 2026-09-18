// Seeds demo data (company + worker + job offer + application) against a running server.
// Usage: node server/seed-demo-data.js   (server must already be running, e.g. `npm run start`)
// Optional env: SEED_BASE_URL (default http://localhost:4173)

const BASE_URL = process.env.SEED_BASE_URL || "http://localhost:4173";

const DEMO_COMPANY = {
  companyName: "Obras Silva & Filhos, Lda",
  name: "Carlos Silva",
  email: "empresa.demo@trata.pro",
  password: "DemoPass123!",
  location: "Porto",
  website: "https://obrassilva.example.test",
  sector: "Construcao e manutencao",
  description: "Empresa de demonstracao para testes de ponta a ponta."
};

const DEMO_WORKER = {
  name: "Ana Ferreira",
  email: "trabalhador.demo@trata.pro",
  password: "DemoPass123!",
  headline: "Eletricista industrial",
  location: "Porto",
  bio: "Trabalhadora de demonstracao para testes de ponta a ponta."
};

const DEMO_WORKER_CV = {
  published: true,
  headline: "Eletricista industrial",
  location: "Porto",
  birthDate: "1992-04-12",
  phone: "+351 912 345 678",
  availability: "Imediata",
  bio: "Mais de 8 anos de experiencia em manutencao eletrica industrial e residencial.",
  skills: ["Eletricidade industrial", "Quadros eletricos", "Manutencao preventiva", "Seguranca no trabalho"],
  experience: [
    {
      title: "Eletricista",
      company: "Eletro Norte, Lda",
      location: "Porto",
      startDate: "2018-03-01",
      endDate: "2024-06-01",
      description: "Manutencao e instalacao de quadros eletricos em ambiente industrial."
    }
  ],
  references: [
    {
      name: "Joao Mendes",
      company: "Eletro Norte, Lda",
      role: "Encarregado",
      phone: "+351 913 000 111",
      email: "joao.mendes@example.test",
      relationship: "Supervisor direto"
    }
  ]
};

const DEMO_JOB_OFFER = {
  title: "Eletricista de manutencao industrial",
  position: "Eletricista",
  location: "Porto",
  contractType: "Efetivo",
  salary: "1200-1400 EUR",
  schedule: "Segunda a sexta, horario diurno",
  description: "Procuramos eletricista para manutencao preventiva e corretiva em ambiente industrial.",
  requirements: "Experiencia minima de 3 anos e disponibilidade imediata."
};

async function request(method, pathName, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${pathName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, payload };
}

async function registerOrLogin(registerPath, registerBody, email, password) {
  const registered = await request("POST", registerPath, registerBody);
  if (registered.status === 201) {
    return { session: registered.payload.session, created: true };
  }
  if (registered.status === 409) {
    const login = await request("POST", "/api/auth/login", { email, password });
    if (login.status !== 200) {
      throw new Error(`Login fallback failed for ${email}: ${login.status} ${JSON.stringify(login.payload)}`);
    }
    return { session: login.payload.session, created: false };
  }
  throw new Error(`${registerPath} failed: ${registered.status} ${JSON.stringify(registered.payload)}`);
}

async function main() {
  console.log(`Seeding demo data against ${BASE_URL} ...`);

  const company = await registerOrLogin(
    "/api/register/company",
    DEMO_COMPANY,
    DEMO_COMPANY.email,
    DEMO_COMPANY.password
  );
  const companyToken = company.session.token;
  console.log(`Company account ${company.created ? "created" : "already existed, logged in"}: ${DEMO_COMPANY.email}`);

  const worker = await registerOrLogin(
    "/api/register/worker",
    DEMO_WORKER,
    DEMO_WORKER.email,
    DEMO_WORKER.password
  );
  const workerToken = worker.session.token;
  console.log(`Worker account ${worker.created ? "created" : "already existed, logged in"}: ${DEMO_WORKER.email}`);

  const profileUpdate = await request("PATCH", "/api/workers/profile", DEMO_WORKER_CV, workerToken);
  if (profileUpdate.status !== 200) {
    throw new Error(`Worker CV publish failed: ${profileUpdate.status} ${JSON.stringify(profileUpdate.payload)}`);
  }
  console.log("Worker CV published.");

  let jobOfferId = null;
  const existingJobs = await request("GET", "/api/jobs/public");
  const existingJob = existingJobs.payload.jobs?.find((job) => job.title === DEMO_JOB_OFFER.title);
  if (existingJob) {
    jobOfferId = existingJob.id;
    console.log(`Job offer already existed: ${DEMO_JOB_OFFER.title}`);
  } else {
    const jobResult = await request("POST", "/api/job-offers", DEMO_JOB_OFFER, companyToken);
    if (jobResult.status !== 201) {
      throw new Error(`Job offer creation failed: ${jobResult.status} ${JSON.stringify(jobResult.payload)}`);
    }
    jobOfferId = jobResult.payload.jobOffer.id;
    console.log(`Job offer created: ${DEMO_JOB_OFFER.title}`);
  }

  const applyResult = await request(
    "POST",
    `/api/job-offers/${jobOfferId}/apply`,
    { message: "Tenho interesse na vaga e disponibilidade imediata." },
    workerToken
  );
  if (applyResult.status === 201) {
    console.log("Worker applied to the job offer.");
  } else if (applyResult.status === 409) {
    console.log("Worker had already applied to the job offer.");
  } else {
    throw new Error(`Job application failed: ${applyResult.status} ${JSON.stringify(applyResult.payload)}`);
  }

  console.log("\nDemo data ready. Test credentials:\n");
  console.log(`Company login:  ${DEMO_COMPANY.email} / ${DEMO_COMPANY.password}`);
  console.log(`Worker login:   ${DEMO_WORKER.email} / ${DEMO_WORKER.password}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
