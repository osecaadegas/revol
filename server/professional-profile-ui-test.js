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
console.log("professional-profile-ui: histórico recolhido e legível em português");
