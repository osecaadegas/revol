const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const start = source.indexOf("  async function submitEvidence(form) {");
const end = source.indexOf("  async function blockTask(form) {", start);
assert.ok(start >= 0 && end > start);

async function runScenario(failUpload) {
  const selected = [1, 2, 3].map((number) => ({ name: `foto-${number}.jpg`, size: 2 * 1024 * 1024 }));
  const status = { textContent: "" };
  const form = {
    dataset: { taskId: "task-1", remaining: "3" },
    querySelectorAll: () => selected.map((file) => ({ files: [file] })),
    querySelector: (selector) => selector === "[data-evidence-upload-status]" ? status : null
  };
  const requests = [];
  const notices = [];
  const state = { data: { evidences: [] }, locationDraft: { status: "granted", latitude: 41, longitude: -8 } };
  const context = {
    window: { matchMedia: () => ({ matches: true }), TrataEvidencePhoto: {
      prepare: async (file) => ({ name: file.name, size: 700 * 1024, dataUrl: "data:image/jpeg;base64,AA==" })
    } },
    state,
    FormData: class { entries() { return [["note", "Teste"]]; } },
    AbortController, setTimeout, clearTimeout,
    taskEvidence: () => state.data.evidences,
    setNotice: (message, type) => notices.push({ message, type }),
    api: async (url, options) => {
      requests.push({ url, options });
      if (failUpload && url.includes("/evidence")) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      if (url === "/api/bootstrap") return state.data;
      return { bootstrap: { evidences: options.body.photos.map((photo, index) => ({ id: String(index), taskId: "task-1", name: photo.name })) } };
    }
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.submitEvidence = submitEvidence;`, context);
  await context.submitEvidence(form);
  return { requests, notices, state, status };
}

(async () => {
  const success = await runScenario(false);
  assert.equal(success.requests.length, 1, "three mobile photographs must use one bounded request");
  assert.equal(success.requests[0].options.body.photos.length, 3);
  assert.equal(success.state.data.evidences.length, 3);
  assert.match(success.notices[0].message, /3 fotografia/);

  const failure = await runScenario(true);
  assert.equal(failure.requests.length, 2, "a failed upload must perform one bounded status refresh");
  assert.equal(failure.notices[0].type, "error");
  assert.match(failure.notices[0].message, /demorou demasiado/);
  assert.equal(failure.status.textContent, "Envio interrompido.");
  console.log("evidence mobile upload UI passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
