const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const task = {
  id: "task_1",
  title: "Mercado central",
  workAddress: "Rua de Teste 1",
  scheduledStartAt: "2026-10-20T08:00:00Z",
  status: "assigned"
};
const state = {
  view: "marketplace",
  data: {
    user: { id: "worker_1", name: "Miguel Teste" },
    tasks: [task],
    workOrders: [{ id: "order_1", title: "Obra de teste" }],
    attendanceEntries: [],
    attendanceJustifications: [],
    attendanceAvailable: true,
    professional: {
      employments: [{ id: "employment_1", companyName: "Empresa Teste", verificationStatus: "verified", employmentStatus: "active" }],
      reportSummaries: []
    }
  }
};
const toggle = { dataset: { recruitment: "toggle-justification" }, disabled: false, addEventListener(_event, callback) { this.click = callback; } };
let focused = false;
const stored = new Map();
const context = {
  localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  window: {
    TrataDesign: { icon: () => "" },
    createProfessionalProfileUI: () => ({ bind() {}, reset() {} }),
    createDirectChatUI: () => ({ bind() {}, reset() {}, unreadCount: () => 0 })
  },
  document: {
    querySelectorAll: selector => selector === "[data-recruitment]" ? [toggle] : [],
    querySelector: () => ({ focus() { focused = true; } })
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "recruitment-ui.js"), "utf8"), context);
let rendered = "";
const ui = context.window.createRecruitmentUI({
  state,
  escapeHtml: value => String(value ?? ""),
  isWorker: () => true,
  renderApp: () => { rendered = ui.content(); }
});
ui.defaultWorkerHome();
rendered = ui.content();
assert.match(rendered, /class="worker-attendance-actions"/);
assert.match(rendered, /data-attendance="clock-in"[^>]*>Entrar ao trabalho<\/button>/);
assert.match(rendered, /data-recruitment="toggle-justification"[^>]*aria-expanded="false"[^>]*>Justificação<\/button>/);
assert.match(rendered, /data-attendance="clock-out"[^>]*disabled[^>]*>Saída<\/button>/);
assert.match(rendered, /id="worker-justification" hidden/);
assert.match(rendered, /Escolhe a tarefa e toca em «Entrar ao trabalho»/);
assert.doesNotMatch(rendered, /A verificação por GPS está desativada/);
assert.equal(ui.setbackResolutionAlert(), "");

task.workOrderId = "order_1";
task.lastSetbackResolution = { text: "Material entregue; o trabalho pode prosseguir.", resolvedAt: "2026-10-20T10:00:00Z" };
assert.match(ui.setbackResolutionAlert(), /Contratempo resolvido — podes retomar a tarefa/);
assert.match(ui.setbackResolutionAlert(), /data-open-task="task_1" data-setback-task="task_1"/);
assert.match(ui.setbackResolutionAlert(), /Material entregue; o trabalho pode prosseguir/);
task.status = "blocked";
assert.equal(ui.setbackResolutionAlert(), "", "um novo contratempo ativo não deve ser anunciado como resolvido");
task.status = "in_progress";
ui.acknowledgeSetback(task.id);
assert.equal(ui.setbackResolutionAlert(), "", "abrir a tarefa dispensa o aviso desta resolução");
task.lastSetbackResolution = { text: "Novo material entregue.", resolvedAt: "2026-10-21T10:00:00Z" };
assert.match(ui.setbackResolutionAlert(), /Novo material entregue/);

ui.bind();
toggle.click();
assert.equal(focused, true);
assert.match(rendered, /aria-expanded="true"/);
assert.doesNotMatch(rendered, /id="worker-justification" hidden/);
assert.match(rendered, /data-recruitment-form="attendance-justification"/);
toggle.click();
assert.match(rendered, /id="worker-justification" hidden/);

state.data.attendanceEntries = [{ taskId: task.id, clockedInAt: "2026-10-20T08:01:00Z", clockedOutAt: null }];
rendered = ui.content();
assert.match(rendered, /data-attendance="clock-in"[^>]*disabled[^>]*>Entrar ao trabalho<\/button>/);
assert.match(rendered, /data-attendance="clock-out"[^>]*>Saída<\/button>/);
assert.equal((ui.quickTabs().match(/data-recruitment="tab"/g) || []).length, 3, "three shortcuts are available with an active employment");
state.data.professional.employments = [];
assert.match(ui.quickTabs(), /data-id="profile"[^>]*><span>Perfil<\/span>/, "without employment, Perfil opens the worker CV");
assert.match(ui.tabs(), /data-id="tasks"/, "the task destination remains available without an assignment");
console.log("worker-home-ui: compact actions, private justification disclosure and shift states passed");
