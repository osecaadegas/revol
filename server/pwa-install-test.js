const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("public/manifest.webmanifest"));
const index = read("public/index.html");
const app = read("public/app.js");
const recruitment = read("public/recruitment-ui.js");
const installer = read("public/pwa-install.js");
const serviceWorker = read("public/service-worker.js");

assert.equal(manifest.display, "standalone");
assert.equal(manifest.id, "/");
assert.equal(manifest.scope, "/");
assert.ok(manifest.icons.some((icon) => icon.src === "/icon-192.png" && icon.sizes === "192x192"));
assert.ok(manifest.icons.some((icon) => icon.src === "/icon-512.png" && icon.sizes === "512x512"));
assert.match(index, /apple-touch-icon/);
assert.match(index, /pwa-install\.js\?v=20261023-ios-response/);
assert.match(app, /data-pwa-install hidden/);
assert.match(recruitment, /data-pwa-install hidden/);
assert.match(installer, /beforeinstallprompt/);
assert.match(installer, /Adicionar ao ecrã principal/);
assert.doesNotMatch(installer, /MutationObserver/);
assert.match(installer, /TrataPwaInstall/);
assert.match(serviceWorker, /icon-192\.png/);
assert.match(serviceWorker, /icon-512\.png/);

for (const size of [192, 512]) {
  const png = fs.readFileSync(path.join(root, `public/icon-${size}.png`));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}

console.log("PWA installation checks passed.");
