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
    user: { name: "Miguel Teste" },
    tasks: [task],
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
const context = {
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
console.log("worker-home-ui: compact actions, private justification disclosure and shift states passed");
