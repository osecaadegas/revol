const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const task = { id: "task-1", title: "Renovação", assigneeName: "Ana", status: "blocked" };
const context = { window: { TrataDesign: { icon: () => "" } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "task-chat-ui.js"), "utf8"), context);
const state = { data: { taskChatAvailable: true, user: { id: "worker-1", role: "worker" }, tasks: [task] } };
const ui = context.window.createTaskChatUI({
  state, escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
  api: async () => ({ task, messages: [
    { id: "m1", senderId: "worker-1", senderName: "Ana", kind: "problem", category: "materials", blocksWork: true, body: "Falta cimento", createdAt: "2026-10-20T08:00:00Z" },
    { id: "m2", senderId: "manager-1", senderName: "Gestor", kind: "resolution", body: "Material entregue", createdAt: "2026-10-20T09:00:00Z" }
  ] }), renderApp() {}
});

(async () => {
  await ui.load("task-1", false);
  let html = ui.render();
  assert.match(html, /Renovação/);
  assert.match(html, /Contratempo · Materiais/);
  assert.match(html, /Resolvido · Trabalho pode prosseguir/);
  assert.doesNotMatch(html, /data-task-chat-form="resolve"/, "workers cannot see the manager resolution form");
  assert.match(html, /data-task-chat-kind/);
  state.data.user = { id: "manager-1", role: "manager" };
  html = ui.render();
  assert.match(html, /data-task-chat-form="resolve"/);
  console.log("task-chat-ui: task context, issue and resolution rendering, manager control passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
