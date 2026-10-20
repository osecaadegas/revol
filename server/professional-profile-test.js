const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tratapro-professional-"));
process.env.APP_STORAGE_DRIVER = "local";
process.env.APP_DATA_DIR = temp;
process.env.CRON_SECRET = "professional-test-cron";
const { createServer } = require("./index");
const server = createServer();
let base;

async function request(route, method = "GET", body, token, expected = 200) {
  const response = await fetch(base + route, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type":"application/json" }), ...(token ? { Authorization:`Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, expected, `${method} ${route}: ${type.includes("application/json") ? JSON.stringify(payload).slice(0,500) : payload.toString("utf8",0,200)}`);
  return { payload, headers:response.headers };
}

function minimalDocx(text) {
  const name = Buffer.from("word/document.xml");
  const xml = Buffer.from(`<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  const compressed = zlib.deflateRawSync(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(8,8);
  local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(xml.length,22); local.writeUInt16LE(name.length,26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(8,10);
  central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(xml.length,24); central.writeUInt16LE(name.length,28); central.writeUInt32LE(0,42);
  const centralOffset = local.length + name.length + compressed.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0); eocd.writeUInt16LE(1,8); eocd.writeUInt16LE(1,10);
  eocd.writeUInt32LE(central.length + name.length,12); eocd.writeUInt32LE(centralOffset,16);
  return Buffer.concat([local,name,compressed,central,name,eocd]);
}

async function run() {
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const admin = (await request("/api/register/company","POST",{ companyName:"Administracao",nif:"501964843",name:"Admin",email:"admin@cv.test",password:"password123" },null,201)).payload;
    const company = (await request("/api/register/company","POST",{ companyName:"Empresa Verificada",nif:"123456789",name:"Gestor",email:"company@cv.test",password:"password123" },null,201)).payload;
    const other = (await request("/api/register/company","POST",{ companyName:"Outra Empresa",nif:"502544180",name:"Outro Gestor",email:"other@cv.test",password:"password123" },null,201)).payload;
    const worker = (await request("/api/register/worker","POST",{ name:"Maria Trabalhadora",nif:"200000004",email:"worker@cv.test",password:"password123" },null,201)).payload;
    const at = admin.session.token, ct = company.session.token, ot = other.session.token, wt = worker.session.token;
    const workerId = worker.bootstrap.user.id, companyId = company.bootstrap.company.id;
    process.env.PLATFORM_ADMIN_USER_IDS = admin.bootstrap.user.id;

    for (const [token, id, nif] of [[ct,companyId,"123456789"],[ot,other.bootstrap.company.id,"502544180"]]) {
      await request("/api/recruitment/company","PATCH",{ nif,location:"Braga",description:"Empresa com atividade comprovada",requestVerification:true },token);
      await request("/api/recruitment/admin","PATCH",{ companyId:id,verification:"verified" },at);
    }

    let result = (await request("/api/professional/cv","POST",{
      intent:"publish", headline:"Operadora industrial", summary:"Experiencia em producao e controlo de qualidade.",
      personalDetails:{ phone:"910000000",location:"Braga" }, skills:["Producao","Controlo de qualidade"],
      qualifications:["Curso tecnico"], certifications:["Seguranca no trabalho"],
      education:[{ course:"Tecnica de producao",institution:"Escola Profissional",startDate:"2018-09-01",endDate:"2020-07-01" }],
      workHistory:[{ title:"Operadora",company:"Fabrica anterior",startDate:"2020-08-01",endDate:"2023-12-31",description:"Linha de producao" }],
      languages:[{ language:"Portugues",level:"Nativo" }], licences:["Carta de conducao B"],
      preferences:{ preferredLocations:["Braga"],roles:["Operadora"],workModes:["onsite"],employmentTypes:["FULL_TIME"] },
      availability:{ available:true,availableFrom:"2026-10-20",shifts:["day","night"] }
    },wt)).payload;
    assert.equal(result.professional.cv.status,"published");
    assert.equal(result.professional.versions.length,1);
    assert.equal(result.bootstrap.user.profile.workerCv.published,true,"legacy recruitment profile remains compatible");

    result = (await request("/api/professional/cv","POST",{ intent:"draft", headline:"Operadora industrial senior", personalDetails:{ location:"Braga",phone:"910000000" }, skills:["Producao"] },wt)).payload;
    assert.equal(result.professional.versions.length,2,"each explicit save creates a version");

    const docx = minimalDocx("Operadora industrial\nworker@cv.test\n910000000\nCompetencias\nProducao\nQualidade");
    result = (await request("/api/professional/documents","POST",{ name:"cv.docx",dataUrl:`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docx.toString("base64")}` },wt)).payload;
    const document = result.professional.documents[0];
    assert.equal(document.extractionStatus,"extracted");
    assert.ok(document.extractedData.suggestions,"extraction is review-only suggestion data");
    assert.equal(result.professional.cv.headline,"Operadora industrial senior","document extraction never overwrites the profile");
    result = (await request("/api/professional/cv","POST",{ intent:"draft",sourceDocumentId:document.id,headline:"Operadora industrial senior",personalDetails:{ location:"Braga",phone:"910000000" },skills:["Producao","Qualidade"] },wt)).payload;
    assert.equal(result.professional.versions[0].changeSource,"document_confirmed");
    assert.ok(result.professional.documents[0].confirmedAt,"confirmed extraction is recorded only after an explicit save");
    await request(`/api/professional/documents/${document.id}/file`,"GET",undefined,ot,404);
    await request(`/api/professional/documents/${document.id}/file`,"GET",undefined,wt);

    await request("/api/professional/employments","POST",{ workerId,position:"Operadora",startDate:"2024-01-01" },ct,403);
    result = (await request("/api/professional/employments","POST",{ companyId,position:"Operadora",startDate:"2024-01-01" },wt)).payload;
    const employment = result.professional.employments[0];
    assert.equal(employment.verificationStatus,"pending");
    assert.equal(employment.endDate,null,"an omitted employment end date must persist as SQL NULL");
    result = (await request(`/api/professional/employments/${employment.id}/confirm`,"PATCH",{ decision:"confirm" },ct)).payload;
    assert.equal(result.professional.employments[0].verificationStatus,"verified");

    const standardQuestions = result.professional.questionGroups.flatMap(group => group.questions);
    assert.equal(standardQuestions.length,25,"the standard evaluation contains all 25 questions");
    const custom = (await request("/api/professional/custom-questions","POST",{ questionText:"Regista corretamente as verificações específicas da linha?",description:"Aplicável à linha de qualidade.",category:"Qualidade interna" },ct)).payload.professional.customQuestions[0];
    const answers = standardQuestions.map((question,index) => ({ questionKey:question.key,answerState:index === 23 ? "not_observed" : index === 24 ? "not_applicable" : "score",score:index === 23 || index === 24 ? null : index === 0 ? 1 : 4,comment:index === 0 ? "Chegou depois da hora acordada em duas ocasiões registadas durante o período." : "Observação profissional registada no período." }));
    answers.push({ questionKey:`custom:${custom.id}`,customQuestionId:custom.id,answerState:"score",score:5,comment:"Registos completos nas verificações observadas." });
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",answers,customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ot,403);
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers:answers.map((item,index) => index === 0 ? { ...item,comment:"" } : item),customQuestionIds:[custom.id] },ct,400);
    result = (await request("/api/professional/evaluations","POST",{ intent:"draft",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",answers:answers.map(item => ({ ...item,answerState:"unanswered",score:null })),customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ct)).payload;
    const draft = result.professional.reportSummaries.find(item => item.status === "draft"); assert.ok(draft,"draft is returned to its originating company");
    assert.ok((await request("/api/professional","GET",undefined,ct)).payload.professional.reportSummaries.some(item => item.id === draft.id),"draft survives a refresh");
    assert.ok(!(await request("/api/professional","GET",undefined,wt)).payload.professional.reportSummaries.some(item => item.id === draft.id),"worker cannot see company drafts");
    result = (await request("/api/professional/evaluations","POST",{ intent:"submit",reportId:draft.id,employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",strengths:"Qualidade consistente.",improvements:"Pontualidade no início do turno.",answers,customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ct)).payload;
    const report = result.professional.reportSummaries[0];
    assert.equal(report.companyId,companyId);
    assert.equal(report.scoredAnswerCount,23,"non-observed and non-applicable answers are excluded from averages");
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers,customQuestionIds:[custom.id] },ct,409);
    await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,ot,404);
    const viewed = (await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,wt)).payload.report;
    assert.equal(viewed.answers.length,26); assert.equal(viewed.factualExperience.nightShift,true);
    assert.equal(viewed.categoryAverages.reduce((sum,item) => sum + item.scoredAnswerCount,0),23,"custom answers never affect standard averages");
    await request(`/api/professional/custom-questions/${custom.id}`,"PATCH",{ action:"archive" },ct);
    const historical = (await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,ct)).payload.report;
    assert.equal(historical.answers.find(item => item.source === "custom").question.questionText,"Regista corretamente as verificações específicas da linha?","historical wording is immutable after archiving");
    result = (await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,supersedesReportId:report.id,correctionReason:"Clarificação factual solicitada.",workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Versão corrigida e auditada.",answers,customQuestionIds:[custom.id],factualExperience:{} },ct)).payload;
    const corrected = result.professional.reportSummaries.find(item => item.status === "corrected");
    assert.equal(corrected.version,2,"correction creates a new immutable version");
    assert.ok(result.professional.reportSummaries.some(item => item.id === report.id && item.status === "superseded"),"the original remains in history instead of being overwritten");
    const noDataAnswers = standardQuestions.map(question => ({ questionKey:question.key,answerState:"not_observed",score:null,comment:"" }));
    result = (await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2025-03-01",periodEnd:"2025-03-31",assessmentContext:"Período sem observação suficiente.",answers:noDataAnswers,factualExperience:{} },ct)).payload;
    const noData = result.professional.reportSummaries.find(item => item.periodStart === "2025-03-01");
    assert.equal(noData.scoredAnswerCount,0); assert.deepEqual(noData.categoryAverages,[],"a no-data assessment is not represented as a zero score");
    assert.ok((await request("/api/professional","GET",undefined,wt)).payload.professional.accessHistory.some(item => item.action === "evaluation_report.viewed"));

    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2025-01-01",periodEnd:"2025-01-31",assessmentContext:"Avaliação por falta justificada.",answers },ct,400);
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2025-02-01",periodEnd:"2025-02-28",answers },wt,403);
    await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,null,401);
    result = (await request("/api/professional/disputes","POST",{ reportId:report.id,type:"correction",description:"A data indicada deve ser revista.",workerResponse:"O periodo correto terminou em dezembro." },wt)).payload;
    const dispute = result.professional.disputes[0];
    await request(`/api/professional/disputes/${dispute.id}`,"PATCH",{ status:"resolved",resolution:"Data confirmada e resposta anexada." },ct);

    await request("/api/professional/access-requests","POST",{ workerId,purpose:"Pedido sem relacao",lawfulBasis:"legitimate_interest" },ot,403);
    await request("/api/professional/cv","POST",{ intent:"publish",headline:"Operadora industrial senior",personalDetails:{ location:"Braga",phone:"910000000" },skills:["Producao","Qualidade"] },wt);
    const otherJob = (await request("/api/job-offers","POST",{ title:"Operadora de qualidade",location:"Porto",description:"Funcao de controlo de qualidade" },ot,201)).payload.jobOffer;
    await request(`/api/job-offers/${otherJob.id}/apply`,"POST",{},wt,201);
    result = (await request("/api/professional/access-requests","POST",{ workerId,purpose:"Validar experiencia para uma candidatura futura",lawfulBasis:"legitimate_interest" },ot)).payload;
    assert.equal(result.professional.accessRequests[0].status,"pending_dpia");
    await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,ot,404,"cross-company report remains inaccessible");

    const pdf = await request("/api/professional/cv.pdf","GET",undefined,wt);
    assert.equal(pdf.headers.get("content-type"),"application/pdf");
    assert.equal(pdf.payload.subarray(0,5).toString(),"%PDF-");
    assert.ok(!pdf.payload.toString("latin1").includes("Avaliacao do periodo"),"confidential evaluation content is excluded from CV export");
    const otherBootstrap = (await request("/api/bootstrap","GET",undefined,ot)).payload;
    assert.equal(otherBootstrap.professional.reportSummaries.length,0,"other companies receive no report summaries");
    if (process.env.PLAYWRIGHT_MODULE) {
      const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
      browser = await chromium.launch({ headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || "msedge" });
      const context = await browser.newContext({ viewport:{ width:1440,height:1000 } });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base); await page.evaluate(token => localStorage.setItem("meo_session_token",token),wt); await page.reload();
      await page.locator('[data-recruitment="tab"][data-id="profile"]').click();
      await page.locator('[data-professional-form="cv"]').waitFor();
      for (const step of ["0","1","2","3"]) { await page.locator(`[data-professional="cv-step"][data-step="${step}"]`).click(); await page.locator(`[data-cv-step="${step}"]`).waitFor(); }
      await page.locator('[data-recruitment="tab"][data-id="employment"]').click(); await page.getByRole("heading",{ name:"Vinculos e relatorios",level:2 }).waitFor();
      await page.locator('[data-professional="view-report"]').first().click(); await page.locator(".evaluation-detail").waitFor();
      const shots = path.join(__dirname,"..","tmp","professional-qa"); fs.mkdirSync(shots,{ recursive:true });
      await page.screenshot({ path:path.join(shots,"worker-employment-desktop.png"),fullPage:true });
      await page.setViewportSize({ width:390,height:844 });
      await page.locator('[data-recruitment="tab"][data-id="profile"]').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),"Digital CV mobile overflow");
      await page.screenshot({ path:path.join(shots,"worker-cv-mobile.png"),fullPage:true });
      await page.evaluate(token => localStorage.setItem("meo_session_token",token),ct); await page.reload();
      for (const id of ["employment","evaluations","access"]) { await page.locator(`[data-recruitment="tab"][data-id="${id}"]`).click(); await page.locator(`[data-id="${id}"][aria-current="page"]`).waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),`Company ${id} mobile overflow`); }
      await page.screenshot({ path:path.join(shots,"company-access-mobile.png"),fullPage:true });
      assert.deepEqual(errors,[],"Professional dashboard browser errors");
      await context.close();
      console.log("professional-profile browser: worker/company desktop-mobile tabs and report view passed");
    }
    console.log("professional-profile: CV versions/import/export, employment verification, evaluation isolation, disputes, access logs and sharing block passed");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp,{ recursive:true,force:true });
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
