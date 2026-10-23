const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { TrataDesign: { icon: () => "" } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "professional-profile-ui.js"), "utf8"), context);

const ui = context.window.createProfessionalProfileUI({
  escapeHtml: value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;"),
  state: {
    data: {
      user: { name: "Trabalhador Teste" },
      professional: {
        accessHistory: [{ action: "evaluation_report.viewed", createdAt: "2026-10-20T13:26:42Z", viewerCompanyName: "Empresa Teste", purpose: "self_or_originating_company_review" }]
      }
    }
  }
});

const rendered = ui.workerEmployment();
assert.match(rendered, /<details class="access-history-disclosure"><summary>Consultar histórico de acessos<\/summary>/);
assert.doesNotMatch(rendered, /<details class="access-history-disclosure" open/);
assert.match(rendered, /Avaliação consultada/);
assert.match(rendered, /Consulta pelo titular ou empresa autora/);
assert.doesNotMatch(rendered, /evaluation_report\.viewed|self_or_originating_company_review/);
assert.match(rendered, /Empresa Teste/);
const managerState = {
  data: {
    user: { name: "Gestor Teste" },
    professional: {
      employments: [
        { id: "employment_1", workerId: "worker_1", companyId: "company_1", workerName: "Maria", position: "Técnica", verificationStatus: "verified" },
        { id: "employment_2", workerId: "worker_2", companyId: "company_1", workerName: "João", position: "Técnico", verificationStatus: "verified" }
      ],
      questionGroups: [{ key: "attendance", label: "Assiduidade e pontualidade", questions: [
        { key: "attendance_schedule", question: "Cumpre os horários de entrada e regresso das pausas?" },
        { key: "attendance_days", question: "Cumpre a presença nos dias de trabalho acordados?" },
        { key: "attendance_notice", question: "Comunica atempadamente atrasos ou imprevistos?" }
      ] }], customQuestions: [], reportSummaries: [], disputes: []
    },
    punctuality: { enabled: true, summaries: [{ companyId: "company_1", workerId: "worker_1", rating: 9.8, status: "provisional",
      scoredShifts: 10, approvedExclusions: 1, pendingExceptions: 2, rules: { windowDays: 90 } }] }
  }
};
const managerUi = context.window.createProfessionalProfileUI({ escapeHtml: value => String(value ?? ""), state: managerState });
const managerRendered = managerUi.evaluations();
assert.equal((managerRendered.match(/data-attendance-reference=/g) || []).length, 3, "each attendance question has a contextual reference");
assert.match(managerRendered, /Escolha um vínculo para consultar os registos/);
assert.doesNotMatch(managerRendered, /data-evaluation-score checked/, "references do not select a rating");
const notes = ["attendance_schedule", "attendance_days", "attendance_notice"].map(key => {
  const span = { textContent: "" };
  return { dataset: { attendanceReference: key }, querySelector: () => span, span };
});
const form = { querySelectorAll: () => notes };
const employmentSelect = { value: "employment_1", closest: () => form, addEventListener: (_event, callback) => { employmentSelect.change = callback; } };
context.document = { querySelectorAll: selector => selector === '[data-professional-form="evaluation"] select[name="employmentId"]' ? [employmentSelect] : [], querySelector: () => null };
managerUi.bind();
employmentSelect.change();
assert.match(notes[0].span.textContent, /9,8\/10.*provisória.*10 turnos/);
assert.match(notes[0].span.textContent, /regresso das pausas não é registado/);
assert.match(notes[1].span.textContent, /falta de registo não prova uma ausência injustificada/);
assert.match(notes[2].span.textContent, /não determina automaticamente/);
employmentSelect.value = "employment_2";
employmentSelect.change();
assert.doesNotMatch(notes[0].span.textContent, /9,8\/10/, "changing workers never shows another worker's reference");
console.log("professional-profile-ui: histórico recolhido e legível em português");
