const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tratapro-recruitment-"));
process.env.APP_STORAGE_DRIVER = "local";
process.env.APP_DATA_DIR = temp;
process.env.RESEND_API_KEY = "";
process.env.CRON_SECRET = "test-cron";
const { createServer } = require("./index");
const server = createServer();
let base;
async function request(route, method = "GET", body, token, expected = 200) {
  const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(payload).slice(0, 300)}`);
  return payload;
}
async function run() {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const company = await request("/api/register/company", "POST", { companyName: "Empresa teste", nif: "123456789", name: "Responsavel", email: "company@test.invalid", password: "password123" }, null, 201);
    const other = await request("/api/register/company", "POST", { companyName: "Outra empresa", nif: "502544180", name: "Outro", email: "other@test.invalid", password: "password123" }, null, 201);
    const worker = await request("/api/register/worker", "POST", { name: "Candidato Teste", nif: "200000004", email: "worker@test.invalid", password: "password123" }, null, 201);
    const ct = company.session.token, wt = worker.session.token, ot = other.session.token;
    const workerId = worker.bootstrap.user.id;
    process.env.PLATFORM_ADMIN_USER_IDS = "";
    process.env.PLATFORM_ADMIN_EMAILS = other.bootstrap.user.email.toUpperCase();
    await request("/api/recruitment/admin", "GET", null, ct, 403);
    await request("/api/recruitment/admin", "GET", null, ot);
    await request("/api/recruitment/company", "PATCH", { nif: "123456789", location: "Alpiarca", description: "Empresa de logistica", requestVerification: true, verification: "verified" }, ct);
    let bootstrap = await request("/api/bootstrap", "GET", null, ct);
    assert.equal(bootstrap.company.recruitment.verification, "pending", "Company cannot verify itself");
    await request("/api/recruitment/admin", "PATCH", { companyId: company.bootstrap.company.id, verification: "verified" }, ot);
    await request("/api/workers/profile", "PATCH", { published: true, headline: "Operador de armazem", location: "Alpiarca", skills: ["Empilhador"], phone: "900000000", birthDate: "1990-01-01", references: [{ name: "Referencia", phone: "911111111" }] }, wt);
    const preferences = { visibility: "verified", available: true, radius: 25, coordinates: { latitude: 39.257, longitude: -8.582 }, experienceYears: 4, certifications: ["Empilhador"], languages: ["Portugues"], schedules: ["night"], minimumSalary: 1100 };
    await request("/api/recruitment/preferences", "PATCH", preferences, wt);
    bootstrap = await request("/api/bootstrap", "GET", null, ct);
    assert.equal(bootstrap.workerProfiles.length, 1);
    const preview = bootstrap.workerProfiles[0];
    assert.equal(preview.email, undefined); assert.equal(preview.phone, undefined); assert.equal(preview.references, undefined); assert.equal(preview.preferences.coordinates, undefined);
    assert.equal((await request("/api/bootstrap", "GET", null, ot)).workerProfiles.length, 0);
    const job = (await request("/api/job-offers", "POST", { title: "Operador de armazem", location: "Alpiarca", description: "Trabalho de logistica", salaryMin: 1100, salaryMax: 1300, salaryPeriod: "MONTH", employmentType: "FULL_TIME", shift: "night", experienceYears: 0, skills: ["Empilhador"], deadline: "2099-12-31", coordinates: { latitude: 39.26, longitude: -8.58 }, screening: [{ id: "q0", question: "Tem certificado?", type: "boolean" }] }, ct, 201)).jobOffer;
    await request(`/api/job-offers/${job.id}`, "PATCH", { title: "Ataque" }, ot, 404);
    await request(`/api/job-offers/${job.id}/apply`, "POST", {}, wt, 400);
    const application = (await request(`/api/job-offers/${job.id}/apply`, "POST", { answers: { q0: "yes" } }, wt, 201)).application;
    await request(`/api/job-offers/${job.id}/apply`, "POST", { answers: { q0: "yes" } }, wt, 409);
    await request(`/api/applications/${application.id}`, "PATCH", { status: "interview" }, ot, 404);
    await request(`/api/applications/${application.id}`, "PATCH", { status: "interview" }, ct);
    const ownApplications = (await request("/api/bootstrap", "GET", null, wt)).jobApplications;
    assert.equal(ownApplications[0].recruitment.history.at(-1).status, "interview");
    await request("/api/recruitment/documents", "POST", { dataUrl: "data:application/pdf;base64," + Buffer.from("not a PDF").toString("base64") }, wt, 400);
    const pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF";
    let result = await request("/api/recruitment/documents", "POST", { name: "cv.pdf", dataUrl: "data:application/pdf;base64," + Buffer.from(pdf).toString("base64") }, wt);
    const docId = result.recruitment.documents[0].id;
    await request(`/api/recruitment/documents/${docId}`, "GET", null, null, 401);
    await request(`/api/recruitment/documents/${docId}`, "GET", null, ot, 404);
    await request(`/api/recruitment/documents/${docId}`, "GET", null, ct);
    await request("/api/recruitment/preferences", "PATCH", { visibility: "private" }, wt);
    await request(`/api/recruitment/documents/${docId}`, "GET", null, ct, 404);
    assert.equal((await request("/api/bootstrap", "GET", null, ct)).jobApplications[0].workerProfile, null);
    await request("/api/recruitment/preferences", "PATCH", { visibility: "applications" }, wt);
    await request("/api/recruitment/saved-jobs", "POST", { jobId: job.id }, wt);
    assert.ok((await request("/api/recruitment", "GET", null, wt)).savedJobs.includes(job.id));
    await request("/api/recruitment/searches", "POST", { query: "armazem", frequency: "daily" }, wt, 400);
    await request("/api/recruitment/searches", "POST", { query: "armazem", frequency: "off" }, wt);
    await request("/api/recruitment/messages", "POST", { jobId: job.id, workerId, body: "Gostariamos de marcar uma entrevista", interviewAt: "2099-10-10T14:00:00Z" }, ot, 403);
    result = await request("/api/recruitment/messages", "POST", { jobId: job.id, workerId, body: "Gostariamos de marcar uma entrevista", interviewAt: "2099-10-10T14:00:00Z" }, ct);
    const messageId = result.recruitment.messages[0].id;
    await request("/api/recruitment/messages", "PATCH", { id: messageId, response: "accepted" }, wt);
    assert.equal((await request("/api/recruitment", "GET", null, ct)).messages[0].response, "accepted");
    assert.equal((await request("/api/recruitment", "GET", null, ot)).messages.length, 0);
    await request("/api/recruitment/reports", "POST", { jobId: job.id, reason: "salary", detail: "Verificar salario" }, wt);
    assert.equal((await request("/api/recruitment/admin", "GET", null, ot)).reports.length, 1);
    const homepage = await request("/");
    assert.ok(homepage.includes("Operador de armazem") && !homepage.includes("A preparar vagas"));
    const detail = await request(job.publicPath);
    const schema = JSON.parse(detail.match(/id="job-structured-data">([\s\S]*?)<\/script>/)[1]);
    assert.equal(schema["@type"], "JobPosting"); assert.equal(schema.baseSalary.value.unitText, "MONTH"); assert.ok(schema.validThrough);
    const sitemap = await request("/sitemap.xml");
    assert.ok(sitemap.includes("/empresas/") && sitemap.includes("/empregos/alpiarca"));
    await request("/empregos/alpiarca");
    await request("/empregos/nonexistent", "GET", null, null, 404);
    const csrf = await fetch(base + "/api/recruitment/preferences", { method: "PATCH", headers: { Origin: "https://evil.invalid", Authorization: `Bearer ${wt}`, "Content-Type": "application/json" }, body: "{}" });
    assert.equal(csrf.status, 403);
    if (process.env.PLAYWRIGHT_MODULE) {
      const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
      browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
      const errors = [];
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.on("pageerror", err => errors.push(err.message));
      await page.goto(base);
      try { await page.getByRole("heading", { name: "Emprego em Portugal." }).waitFor({ timeout: 10000 }); }
      catch (error) { console.error("Browser errors:", errors, "HTML:", (await page.content()).slice(-4000)); throw error; }
      await page.getByRole("button", { name: "Quero contratar", exact: true }).click();
      await page.locator('[data-form="register-company"]').waitFor();
      await page.locator('[data-action="close-auth-modal"]').first().click({ position: { x: 3, y: 3 } });
      await page.evaluate(token => localStorage.setItem("meo_session_token", token), wt);
      await page.reload();
      await page.locator('.sidebar [data-recruitment="tab"][data-id="profile"]').click();
      await page.locator('[data-professional-form="cv"]').waitFor();
      await page.locator('[data-professional-form="cv"] textarea[name="summary"]').fill("Perfil profissional verificado no teste de interface.");
      await page.getByRole("button", { name: "Guardar rascunho" }).click();
      await page.getByText("Alteracoes guardadas.", { exact: true }).waitFor();
      for (const id of ["employment", "applications", "saved", "messages", "settings", "jobs"]) { await page.locator(`.sidebar [data-recruitment="tab"][data-id="${id}"]`).click(); await page.locator(`.sidebar [data-id="${id}"][aria-current="page"]`).waitFor(); }
      const desktopFilterBox = await page.locator('.filter-panel').boundingBox();
      const desktopJobsBox = await page.locator('.search-results .market-job-list').boundingBox();
      assert.ok(desktopFilterBox && desktopJobsBox && desktopFilterBox.y + desktopFilterBox.height <= desktopJobsBox.y + 1, "Desktop vacancy filters must sit above the job results without overlap");
      assert.equal(await page.locator('.sidebar').evaluate(element => element.scrollWidth <= element.clientWidth), true, "Desktop sidebar must not scroll horizontally");
      assert.equal(await page.locator('.sidebar [data-recruitment="tab"]:not([aria-current="page"])').first().evaluate(element => getComputedStyle(element).color), "rgb(21, 19, 15)", "Sidebar categories must use high-contrast black text");
      const screenshotDir = path.join(__dirname, "..", "tmp", "recruitment-qa"); fs.mkdirSync(screenshotDir, { recursive: true });
      await page.screenshot({ path: path.join(screenshotDir, "worker-desktop.png"), fullPage: true });
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await page.reload();
        await page.locator('.content').waitFor();
        const mobileLayout = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          content: document.querySelector('.content').getBoundingClientRect().width,
          navigation: document.querySelectorAll('.mobile-recruitment-menu > .recruitment-tabs').length,
          visibleTabs: [...document.querySelectorAll('.recruitment-tabs')].filter(element => element.getClientRects().length).length,
          navParents: [...document.querySelectorAll('.recruitment-tabs')].map(element => element.parentElement?.className),
          overflow: document.documentElement.scrollWidth > innerWidth + 1
        }));
        assert.ok(mobileLayout.content >= mobileLayout.viewport - 2, `${width}px: workspace must use the full viewport`);
        assert.equal(mobileLayout.navigation, 1, `${width}px: recruitment menu must stay inside its disclosure`);
        assert.equal(mobileLayout.visibleTabs, 0, `${width}px: closed recruitment menu must not expose duplicate tabs: ${JSON.stringify(mobileLayout)}`);
        assert.equal(mobileLayout.overflow, false, `${width}px: page must not scroll horizontally`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      const selectMobileTab = async id => {
        const menu = page.locator('.mobile-recruitment-menu');
        if (!await menu.evaluate(el => el.open)) await menu.locator('summary').click();
        await menu.locator(`[data-recruitment="tab"][data-id="${id}"]`).click();
        await menu.locator(`[data-id="${id}"][aria-current="page"]`).waitFor({state:'attached'});
      };
      for (const id of ["profile", "employment", "settings", "saved", "messages", "applications", "jobs"]) {
        await selectMobileTab(id);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Mobile overflow: ${id}`);
      }
      await page.screenshot({ path: path.join(screenshotDir, "worker-mobile.png"), fullPage: true });
      await page.evaluate(token => localStorage.setItem("meo_session_token", token), ct); await page.reload();
      for (const id of ["company", "employment", "evaluations", "applications", "candidates", "messages", "create", "jobs"]) {
        await selectMobileTab(id);
        assert.equal(await page.locator('.mobile-recruitment-menu .recruitment-tabs .btn').evaluateAll(elements => elements.filter(element => getComputedStyle(element).backgroundColor === "rgb(217, 241, 33)").length), 1, `Only the current company section may use the yellow highlight: ${id}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Company mobile overflow: ${id}`);
      }
      await page.locator('[data-recruitment="edit-job"]').click();
      assert.equal(await page.locator('[data-form="create-job"] input[name="title"]').inputValue(), job.title);
      await page.locator('[data-recruitment="preview-job"]').click();
      await page.locator('[data-job-preview] .job-card').waitFor();
      await page.getByRole("button", { name: "Guardar vaga", exact: true }).click();
      await page.getByText("Vaga publicada.", { exact: true }).waitFor();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: path.join(screenshotDir, "company-desktop.png"), fullPage: true });
      assert.deepEqual(errors, [], "Browser runtime errors");
      await context.close(); console.log("browser: worker, company, desktop/mobile, form save and job editing passed");
      const alertEmployee = await request('/api/users', 'POST', { name: 'Colaborador alerta', email: 'alert-operator@test.invalid', role: 'employee', password: 'password123' }, ct, 201);
      const alertOrder = await request('/api/work-orders', 'POST', { title: 'Obra de alerta', address: 'Alpiarca', description: 'Teste de contratempo', assignedUserIds: [alertEmployee.user.id], expectedStartDate: '2099-10-09', expectedEndDate: '2099-10-10', photos: [] }, ct, 201);
      const alertTask = await request('/api/tasks', 'POST', { workOrderId: alertOrder.workOrder.id, title: 'Material em falta', assigneeId: alertEmployee.user.id, dueDate: '2099-10-10' }, ct, 201);
      const alertEmployeeSession = await request('/api/auth/login', 'POST', { email: 'alert-operator@test.invalid', password: 'password123' });
      const alertContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const alertPage = await alertContext.newPage();
      await alertPage.goto(base);
      await alertPage.evaluate(token => localStorage.setItem('meo_session_token', token), ct);
      await alertPage.reload();
      await alertPage.locator('.main-layout').waitFor();
      await request(`/api/tasks/${alertTask.task.id}/status`, 'PATCH', { status: 'in_progress' }, alertEmployeeSession.session.token);
      await request(`/api/tasks/${alertTask.task.id}/status`, 'PATCH', { status: 'blocked', blockReason: 'O fornecedor ainda não entregou o material.' }, alertEmployeeSession.session.token);
      await alertPage.evaluate(() => window.dispatchEvent(new Event('focus')));
      await alertPage.locator('.company-operational-notice').waitFor();
      assert.match(await alertPage.locator('.company-operational-notice').innerText(), /Prioridade alta[\s\S]*Colaborador alerta[\s\S]*Obra de alerta[\s\S]*Material em falta[\s\S]*fornecedor/i);
      assert.equal(await alertPage.locator('.company-operational-notice').evaluate(element => getComputedStyle(element).borderLeftColor), 'rgb(196, 48, 28)', 'A setback must use the urgent alert color');
      assert.equal(await alertPage.locator('.mobile-workspace-menu').evaluate(element => element.classList.contains('has-operational-alert')), true);
      assert.equal(await alertPage.locator('.sidebar [data-operational-alert-badge]').textContent(), '1');
      assert.match(await alertPage.title(), /^⚠ 1 contratempo/);
      assert.equal(await alertPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'High-priority alert must fit on a phone');
      await alertPage.screenshot({ path: path.join(screenshotDir, 'company-priority-alert-mobile.png'), fullPage: true });
      await alertPage.locator('.company-operational-notice [data-operational-task]').click();
      await alertPage.locator('[data-drawer-panel]').waitFor();
      await alertPage.keyboard.press('Escape');
      await alertPage.locator('[data-drawer-panel]').waitFor({ state: 'detached' });
      const secondAlertTask = await request('/api/tasks', 'POST', { workOrderId: alertOrder.workOrder.id, title: 'Acesso impedido', assigneeId: alertEmployee.user.id, dueDate: '2099-10-10' }, ct, 201);
      await request(`/api/tasks/${secondAlertTask.task.id}/status`, 'PATCH', { status: 'in_progress' }, alertEmployeeSession.session.token);
      await request(`/api/tasks/${secondAlertTask.task.id}/status`, 'PATCH', { status: 'blocked', blockReason: 'Zona de trabalho sem acesso.' }, alertEmployeeSession.session.token);
      await alertPage.evaluate(() => window.dispatchEvent(new Event('focus')));
      await alertPage.getByRole('button', { name: 'Ver todos' }).waitFor();
      assert.equal(await alertPage.locator('.sidebar [data-operational-alert-badge]').textContent(), '2');
      await alertPage.getByRole('button', { name: 'Ver todos' }).click();
      assert.equal(await alertPage.locator('[data-operational-alerts-panel] .operational-alert').count(), 2);
      await request(`/api/tasks/${alertTask.task.id}/status`, 'PATCH', { status: 'in_progress' }, alertEmployeeSession.session.token);
      await request(`/api/tasks/${secondAlertTask.task.id}/status`, 'PATCH', { status: 'in_progress' }, alertEmployeeSession.session.token);
      await alertPage.evaluate(() => window.dispatchEvent(new Event('focus')));
      await alertPage.locator('.company-operational-notice').waitFor({ state: 'hidden' });
      assert.equal(await alertPage.locator('.sidebar [data-operational-alert-badge]').evaluate(element => element.hidden), true);
      assert.equal(await alertPage.title(), 'TrataPro - Vagas abertas');
      await alertContext.close();
      if (process.env.DESIGN_REVIEW) {
        await request("/api/recruitment/preferences", "PATCH", { visibility: "verified" }, wt);
        const employee = await request('/api/users', 'POST', {name:'Operador de teste',email:'operator@test.invalid',role:'employee',password:'password123'}, ct, 201);
        await request('/api/users', 'POST', {name:'Cliente de teste',email:'client@test.invalid',role:'client',password:'password123'}, ct, 201);
        const client = await request('/api/auth/login', 'POST', {email:'client@test.invalid',password:'password123'});
        const order = await request('/api/work-orders', 'POST', {title:'Servico de teste',address:'Alpiarca',description:'Verificacao visual local',assignedUserIds:[employee.user.id],expectedStartDate:'2099-10-09',expectedEndDate:'2099-10-10',photos:[]}, ct, 201);
        await request('/api/tasks', 'POST', {workOrderId:order.workOrder.id,title:'Tarefa de teste',assigneeId:employee.user.id,dueDate:'2099-10-10'}, ct, 201);
        await require('./design-test').reviewDesign(browser, base, { worker: wt, company: ct, admin: ot, client:client.session.token }, job.publicPath, `/empresas/${company.bootstrap.company.id}-empresa-teste`);
      }
    }
    await request(`/api/job-offers/${job.id}`, "PATCH", { deadline: "2000-01-01" }, ct);
    assert.equal((await request("/api/jobs/public")).jobs.length, 0);
    const closed = await request(job.publicPath);
    assert.ok(closed.includes("ja nao aceita candidaturas") && !closed.includes("JobPosting"));
    await request(`/api/job-offers/${job.id}/apply`, "POST", {}, wt, 404);
    await request("/api/recruitment/account", "DELETE", { confirm: "ELIMINAR" }, wt);
    await request("/api/bootstrap", "GET", null, wt, 401);
    await request(`/api/recruitment/documents/${docId}`, "GET", null, ct, 404);
    assert.equal((await request("/api/bootstrap", "GET", null, ct)).jobApplications.length, 0);
    await request("/api/register/worker", "POST", { name: "Conta Recriada", nif: "200000004", email: "worker-recreated@test.invalid", password: "password123" }, null, 201);
    console.log("recruitment: permissions, verification, profiles, documents, screening, pipeline, saved jobs, messages, reports, privacy, deletion and SEO passed");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
