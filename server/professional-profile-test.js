const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tratapro-professional-"));
process.env.APP_STORAGE_DRIVER = "local";
process.env.APP_DATA_DIR = temp;
process.env.CRON_SECRET = "professional-test-cron";
process.env.PROFESSIONAL_TEST_DATE = "2024-12-31";
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

    const administrationUser = (await request("/api/users","POST",{ name:"Ana Administração",email:"administracao@cv.test",role:"manager",password:"password123" },ct,201)).payload.user;
    const administrationToken = (await request("/api/auth/login","POST",{ email:"administracao@cv.test",password:"password123" },null)).payload.session.token;
    const workerChat = (await request("/api/direct-chat","GET",undefined,wt)).payload.chat;
    assert.ok(workerChat.contacts.some(item => item.id === company.bootstrap.user.id && item.roleLabel === "Direção"),"the worker can identify the company owner before starting a chat");
    assert.ok(workerChat.contacts.some(item => item.id === administrationUser.id && item.roleLabel === "Administração"),"the worker can choose an administration contact separately");
    const bossConversation = (await request("/api/direct-chat/conversations","POST",{ contactUserId:company.bootstrap.user.id },wt,201)).payload.conversation;
    const administrationConversation = (await request("/api/direct-chat/conversations","POST",{ contactUserId:administrationUser.id },wt,201)).payload.conversation;
    await request("/api/direct-chat/conversations","POST",{ contactUserId:workerId },ot,403);
    await request("/api/direct-chat/messages","POST",{ conversationId:bossConversation.id,body:"Mensagem reservada à direção." },wt);
    await request("/api/direct-chat/messages","POST",{ conversationId:administrationConversation.id,body:"Mensagem reservada à administração." },wt);
    assert.equal((await request(`/api/direct-chat/conversations/${bossConversation.id}`,"GET",undefined,ct)).payload.messages.length,1);
    await request(`/api/direct-chat/conversations/${administrationConversation.id}`,"GET",undefined,ct,404);
    assert.equal((await request(`/api/direct-chat/conversations/${administrationConversation.id}`,"GET",undefined,administrationToken)).payload.messages[0].body,"Mensagem reservada à administração.");
    await request("/api/direct-chat/messages","POST",{ conversationId:administrationConversation.id,body:"Resposta da administração." },administrationToken);
    assert.equal((await request("/api/direct-chat","GET",undefined,wt)).payload.chat.unreadCount,1,"direct replies expose an unread count only to their recipient");
    await request(`/api/direct-chat/conversations/${administrationConversation.id}/read`,"PATCH",{},wt);
    assert.equal((await request("/api/direct-chat","GET",undefined,wt)).payload.chat.unreadCount,0);

    const companyOrder = (await request("/api/work-orders","POST",{ title:"Turno de producao",address:"Rua Industrial 10, Braga",description:"Ordem para trabalhador contratado",photos:[] },ct,201)).payload.workOrder;
    const otherOrder = (await request("/api/work-orders","POST",{ title:"Ordem sem vinculo",address:"Rua Externa 2, Braga",description:"Teste de isolamento",photos:[] },ot,201)).payload.workOrder;
    await request("/api/tasks","POST",{ workOrderId:otherOrder.id,title:"Atribuicao indevida",assigneeId:workerId,dueDate:"2026-11-02" },ot,403);
    const plannedTask = (await request("/api/tasks","POST",{
      workOrderId:companyOrder.id,title:"Preparar linha",description:"Confirmar equipamento antes do turno.",assigneeId:workerId,
      scheduledStartAt:"2026-11-01T08:00:00.000Z",dueDate:"2026-11-01",planningNotes:"Apresentar-se na portaria principal.",
      workAddress:"Rua Industrial 10, Braga"
    },ct,201)).payload.task;
    assert.equal(plannedTask.employmentId,employment.id,"worker tasks retain the verified relationship that authorises assignment");
    assert.equal(plannedTask.workAddress,"Rua Industrial 10, Braga");
    assert.equal(plannedTask.workLocation.status,"not_requested","task planning needs only the work address");
    const workerBootstrap = (await request("/api/bootstrap","GET",undefined,wt)).payload;
    assert.ok(workerBootstrap.tasks.some(item => item.id === plannedTask.id),"assigned recruitment workers receive tasks in their own bootstrap");
    assert.ok(workerBootstrap.workOrders.some(item => item.id === companyOrder.id),"the worker sees only the work order needed for the assigned task");
    assert.ok(!workerBootstrap.workOrders.some(item => item.id === otherOrder.id),"an unrelated company order remains private");
    const startedTask = (await request(`/api/tasks/${plannedTask.id}/status`,"PATCH",{ status:"in_progress" },wt)).payload.task;
    assert.equal(startedTask.status,"in_progress","the assigned worker can operate the relationship-bound task");
    const companyBootstrap = (await request("/api/bootstrap","GET",undefined,ct)).payload;
    assert.ok(companyBootstrap.auditLogs.some(item => item.entityId === plannedTask.id && item.actorId === workerId),"worker task changes remain attributed in the originating company audit history");

    const standardQuestions = result.professional.questionGroups.flatMap(group => group.questions);
    assert.equal(standardQuestions.length,25,"the standard evaluation contains all 25 questions");
    const custom = (await request("/api/professional/custom-questions","POST",{ questionText:"Regista corretamente as verificações específicas da linha?",description:"Aplicável à linha de qualidade.",category:"Qualidade interna" },ct)).payload.professional.customQuestions[0];
    const answers = standardQuestions.map((question,index) => ({ questionKey:question.key,answerState:"score",score:index === 0 ? 0 : 8,comment:index === 0 ? "" : "Observação profissional registada no período." }));
    answers.push({ questionKey:`custom:${custom.id}`,customQuestionId:custom.id,answerState:"score",score:10,comment:"" });
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",answers,customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ot,403);
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers:answers.map((item,index) => index === 0 ? { ...item,score:11 } : item),customQuestionIds:[custom.id] },ct,400);
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers:answers.map((item,index) => index === 0 ? { ...item,score:"" } : item),customQuestionIds:[custom.id] },ct,400);
    result = (await request("/api/professional/evaluations","POST",{ intent:"draft",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",answers:answers.map(item => ({ ...item,answerState:"unanswered",score:null })),customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ct)).payload;
    const draft = result.professional.reportSummaries.find(item => item.status === "draft"); assert.ok(draft,"draft is returned to its originating company");
    assert.ok((await request("/api/professional","GET",undefined,ct)).payload.professional.reportSummaries.some(item => item.id === draft.id),"draft survives a refresh");
    assert.ok(!(await request("/api/professional","GET",undefined,wt)).payload.professional.reportSummaries.some(item => item.id === draft.id),"worker cannot see company drafts");
    result = (await request("/api/professional/evaluations","POST",{ intent:"submit",reportId:draft.id,employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",assessmentContext:"Avaliação do período de trabalho indicado.",strengths:"Qualidade consistente.",improvements:"Pontualidade no início do turno.",answers,customQuestionIds:[custom.id],factualExperience:{ nightShift:true,weekend:true,overtime:false,context:"Turnos confirmados no planeamento." } },ct)).payload;
    const report = result.professional.reportSummaries[0];
    assert.equal(report.companyId,companyId);
    assert.equal(report.scoredAnswerCount,25,"all standard ratings contribute to category averages");
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers,customQuestionIds:[custom.id] },ct,409);
    await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,ot,404);
    const viewed = (await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,wt)).payload.report;
    assert.equal(viewed.answers.length,26); assert.equal(viewed.factualExperience.nightShift,true);
    assert.equal(viewed.answers.find(item => item.question.questionKey === standardQuestions[0].key).score,0,"zero is a valid rating");
    assert.equal(viewed.answers.find(item => item.question.questionKey === standardQuestions[0].key).comment,"","comments remain optional for every rating");
    assert.equal(viewed.categoryAverages.reduce((sum,item) => sum + item.scoredAnswerCount,0),25,"custom answers never affect standard averages");
    await request(`/api/professional/custom-questions/${custom.id}`,"PATCH",{ action:"archive" },ct);
    const historical = (await request(`/api/professional/evaluations/${report.id}`,"GET",undefined,ct)).payload.report;
    assert.equal(historical.answers.find(item => item.source === "custom").question.questionText,"Regista corretamente as verificações específicas da linha?","historical wording is immutable after archiving");
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,supersedesReportId:report.id,correctionReason:"Tentativa de alteração.",workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers,customQuestionIds:[custom.id],factualExperience:{} },ct,409);
    await request("/api/professional/evaluations","POST",{ intent:"submit",reportId:report.id,employmentId:employment.id,workerRole:"Operadora",periodStart:"2024-01-01",periodEnd:"2024-12-31",answers,customQuestionIds:[custom.id],factualExperience:{} },ct,409);
    process.env.PROFESSIONAL_TEST_DATE = "2025-04-30";
    result = (await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"1999-01-01",periodEnd:"1999-12-31",assessmentContext:"Nova avaliação registada noutra data.",answers,customQuestionIds:[custom.id],factualExperience:{} },ct)).payload;
    assert.ok(result.professional.reportSummaries.some(item => item.periodStart === "2025-04-30" && item.periodEnd === "2025-04-30" && item.status === "submitted"),"the server records the current Portuguese date and ignores manipulated period fields");
    assert.ok(result.professional.reportSummaries.some(item => item.id === report.id && item.status === "submitted"),"the earlier submitted assessment remains unchanged");
    const noDataAnswers = standardQuestions.map(question => ({ questionKey:question.key,answerState:"unanswered",score:null,comment:"" }));
    process.env.PROFESSIONAL_TEST_DATE = "2025-03-31";
    result = (await request("/api/professional/evaluations","POST",{ intent:"draft",employmentId:employment.id,workerRole:"Operadora",periodStart:"2025-03-01",periodEnd:"2025-03-31",assessmentContext:"Rascunho ainda sem classificações.",answers:noDataAnswers,factualExperience:{} },ct)).payload;
    const noData = result.professional.reportSummaries.find(item => item.periodStart === "2025-03-31");
    assert.equal(noData.scoredAnswerCount,0); assert.deepEqual(noData.categoryAverages,[],"a no-data assessment is not represented as a zero score");
    assert.ok((await request("/api/professional","GET",undefined,wt)).payload.professional.accessHistory.some(item => item.action === "evaluation_report.viewed"));

    process.env.PROFESSIONAL_TEST_DATE = "2025-01-31";
    await request("/api/professional/evaluations","POST",{ intent:"submit",employmentId:employment.id,workerRole:"Operadora",periodStart:"2020-01-01",periodEnd:"2020-01-31",assessmentContext:"Avaliação por falta justificada.",answers },ct,400);
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
      await page.locator('[data-recruitment="tab"][data-id="tasks"]').click();
      await page.locator('[data-open-task]').first().click();
      const workMap = page.locator('.task-map iframe'); await workMap.waitFor();
      assert.ok((await workMap.getAttribute('src')).includes('Rua%20Industrial%2010%2C%20Braga'),"the worker task embeds Google Maps from the stored address");
      await page.locator('[data-action="close-drawer"]').click();
      await page.locator('[data-recruitment="tab"][data-id="chat"]').click();
      await page.locator('[data-direct-chat-root]').waitFor();
      assert.equal(await page.locator('[data-direct-chat="open"]').count(),2,"worker chat keeps direction and administration as separate conversations");
      await page.getByRole('button',{ name:/Ana Administração/ }).click();
      await page.getByText('Resposta da administração.').waitFor();
      const shots = path.join(__dirname,"..","tmp","professional-qa"); fs.mkdirSync(shots,{ recursive:true });
      await page.screenshot({ path:path.join(shots,"worker-direct-chat-desktop.png"),fullPage:true });
      await page.locator('[data-recruitment="tab"][data-id="profile"]').click();
      await page.locator('[data-professional-form="cv"]').waitFor();
      for (const step of ["0","1","2","3"]) { await page.locator(`[data-professional="cv-step"][data-step="${step}"]`).click(); await page.locator(`[data-cv-step="${step}"]`).waitFor(); }
      await page.locator('[data-recruitment="tab"][data-id="employment"]').click(); await page.getByRole("heading",{ name:"Percurso Profissional e Avaliações",level:2,exact:true }).waitFor();
      await page.locator('[data-professional="view-report"]').first().click(); await page.locator(".evaluation-detail").waitFor();
      await page.screenshot({ path:path.join(shots,"worker-employment-desktop.png"),fullPage:true });
      await page.setViewportSize({ width:390,height:844 });
      await page.locator('[data-recruitment="tab"][data-id="chat"]').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),"Direct chat mobile overflow");
      await page.screenshot({ path:path.join(shots,"worker-direct-chat-mobile.png"),fullPage:true });
      await page.locator('[data-recruitment="tab"][data-id="profile"]').click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),"Digital CV mobile overflow");
      await page.screenshot({ path:path.join(shots,"worker-cv-mobile.png"),fullPage:true });
      await page.evaluate(token => localStorage.setItem("meo_session_token",token),ct); await page.reload();
      for (const id of ["employment","evaluations"]) {
        await page.locator(`[data-recruitment="tab"][data-id="${id}"]`).click(); await page.locator(`[data-id="${id}"][aria-current="page"]`).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),`Company ${id} mobile overflow`);
        if (id === "evaluations") {
          const categoryPicker = page.locator("[data-evaluation-category-select]");
          assert.equal(await page.locator("[data-evaluation-category]:visible").count(),1,"only one evaluation category is visible at a time");
          assert.ok(await page.locator("[data-evaluation-category] [data-evaluation-score]").count() >= 275,"all category answers remain in the form while sections are collapsed");
          await categoryPicker.selectOption("adaptation");
          await page.locator('[data-evaluation-category="adaptation"]:visible').waitFor();
          const scale = page.locator('[data-evaluation-category="adaptation"] .rating-scale').first();
          assert.equal(await scale.locator("[data-evaluation-score]").count(),11,"the visual rating exposes every integer from 0 to 10");
          assert.equal(await scale.locator("[data-evaluation-score]:checked").count(),0,"ratings never start preselected");
          const seven = scale.locator('.rating-7'), swatch = seven.locator("span");
          const neutralBackground = await swatch.evaluate(node => getComputedStyle(node).backgroundColor);
          await seven.hover();
          await page.waitForTimeout(200);
          const hoverBackground = await swatch.evaluate(node => getComputedStyle(node).backgroundColor);
          assert.notEqual(hoverBackground,neutralBackground,"rating colour appears on hover");
          await seven.locator('[data-evaluation-score][value="7"]').check({ force:true });
          await page.getByRole("heading",{ name:"Percurso Profissional e Avaliações",level:2,exact:true }).hover();
          assert.equal(await swatch.evaluate(node => getComputedStyle(node).backgroundColor),hoverBackground,"selected rating keeps its colour after hover ends");
          await scale.getByText("7 em 10").waitFor();
          const question = scale.locator("xpath=ancestor::*[contains(@class,'evaluation-question')][1]"), commentToggle = question.locator("[data-evaluation-comment-toggle]");
          assert.equal(await question.locator(".evaluation-comment:visible").count(),0,"optional comments start collapsed");
          assert.equal(await commentToggle.getAttribute("aria-expanded"),"false","collapsed comment state is exposed to assistive technology");
          await commentToggle.click();
          const comment = question.locator(".evaluation-comment textarea");
          await comment.fill("Observação profissional de teste.");
          const copyBox = await question.locator(".evaluation-question-copy").boundingBox(), scaleBox = await scale.boundingBox(), commentBox = await comment.boundingBox();
          assert.ok(copyBox && scaleBox && commentBox && copyBox.y < scaleBox.y && scaleBox.y < commentBox.y,"question, rating and comment follow a clean vertical order");
          assert.ok(commentBox.height <= 70,"the optional comment starts as a compact field");
          await commentToggle.click();
          assert.equal(await question.locator(".evaluation-comment:visible").count(),0,"the comment can be collapsed after use");
          assert.equal(await comment.inputValue(),"Observação profissional de teste.","collapsing a comment preserves its text");
          assert.equal(await commentToggle.textContent(),"Ver comentário","a saved local comment remains discoverable while collapsed");
        }
      }
      assert.equal(await page.locator('[data-recruitment="tab"][data-id="access"]').count(),0,"cross-company access is not presented as a normal company action while sharing is disabled");
      await page.screenshot({ path:path.join(shots,"company-evaluations-mobile.png"),fullPage:true });
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
