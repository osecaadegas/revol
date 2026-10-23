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
assert.match(rendered, /Ver planeamento e pedir folga/, "the worker profile must link to forthcoming shifts and leave requests");
assert.match(ui.tabs(), /data-id="planning"/, "an active worker has a planning category");
assert.match(rendered, /data-attendance="clock-in"[^>]*>Entrar ao trabalho<\/button>/);
assert.match(rendered, /data-recruitment="toggle-justification"[^>]*aria-expanded="false"[^>]*>Justificação<\/button>/);
assert.match(rendered, /data-attendance="clock-out"[^>]*disabled[^>]*>Saída<\/button>/);
assert.match(rendered, /id="worker-justification" hidden/);
assert.match(rendered, /Escolhe a tarefa e toca em «Entrar ao trabalho»/);
assert.doesNotMatch(rendered, /A verificação por GPS está desativada/);
assert.equal(ui.setbackResolutionAlert(), "");
state.data.punctuality = { enabled: true, summaries: [{ companyId: "company_1", status: "provisional", rating: 9.8,
  scoredShifts: 10, onTime: 9, minorDelays: 1, significantDelays: 0, majorDelays: 0, approvedExclusions: 1, pendingExceptions: 0,
  rules: { version: 1, windowDays: 90, graceSeconds: 300, minorLimitSeconds: 900, significantLimitSeconds: 1800, confirmedShifts: 20, scores: [10,8,5,0] },
  chart: [{ date: "2026-10-20", rating: 9.8 }], records: [{ workDate: "2026-10-20", status: "scored", score: 8,
    scheduledAt: "2026-10-20T06:00:00Z", clockedInAt: "2026-10-20T06:10:00Z", corrections: [] }] }] };
rendered = ui.content();
assert.match(rendered, /Pontualidade/);
assert.match(rendered, /Avaliação Provisória/);
assert.match(rendered, /9,8\/10/);
assert.match(rendered, /Consultar turnos e corrigir erros/);
assert.match(rendered, /name="kind"/, "the worker can classify a justification or contest a record");

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
assert.match(ui.quickTabs(), /data-id="tasks"[^>]*task-attention-resolved|task-attention-resolved[^>]*data-id="tasks"/, "a resolução ainda não vista destaca Tarefas a verde");
assert.equal(ui.taskAttentionState(), "resolved");
ui.acknowledgeResolvedSetbacks();
assert.equal(ui.taskAttentionState(), "", "consultar Tarefas limpa o destaque verde");
assert.doesNotMatch(ui.quickTabs(), /task-attention-(?:active|resolved)/);
task.status = "blocked";
assert.equal(ui.taskAttentionState(), "active");
assert.match(ui.quickTabs(), /data-id="tasks"[^>]*task-attention-active|task-attention-active[^>]*data-id="tasks"/, "um contratempo ativo destaca Tarefas a vermelho");
task.status = "in_progress";

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
