const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const encodedSizes = [];
class Reader {
  readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from("photo").toString("base64")}`;
    queueMicrotask(() => this.onload());
  }
  abort() { this.onabort?.(); }
}
class PhotoImage {
  naturalWidth = 4000;
  naturalHeight = 3000;
  set src(url) { queueMicrotask(() => url === "blob:bad" ? this.onerror() : this.onload()); }
}
const context = {
  window: {},
  document: { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob(callback, type) { encodedSizes.push(this.width); callback({ size: 600 * 1024, type }); }
  }) },
  URL: { createObjectURL: (file) => file.bad ? "blob:bad" : "blob:ok", revokeObjectURL() {} },
  Image: PhotoImage, FileReader: Reader, setTimeout, clearTimeout, Buffer, queueMicrotask
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "evidence-photo.js"), "utf8"), context);

(async () => {
  const { prepare, maxBytes } = context.window.TrataEvidencePhoto;
  const small = await prepare({ name: "small.jpg", type: "image/jpeg", size: 1000, lastModified: 123 });
  assert.equal(small.processed, false);
  assert.equal(small.lastModified, 123);
  assert.equal(encodedSizes.length, 0, "small supported files must not be recompressed");

  const large = await prepare({ name: "phone.heic", type: "image/heic", size: 8 * 1024 * 1024, lastModified: 456 });
  assert.equal(large.processed, true);
  assert.equal(large.type, "image/jpeg");
  assert.equal(large.name, "phone.jpg");
  assert.equal(large.originalByteSize, 8 * 1024 * 1024);
  assert.ok(large.size <= maxBytes);
  assert.equal(encodedSizes[0], 1600);

  await assert.rejects(prepare({ name: "bad.heic", type: "image/heic", size: 2000, bad: true }), /Não foi possível abrir/);
  await assert.rejects(prepare({ name: "empty.jpg", type: "image/jpeg", size: 0 }), /vazia/);
  console.log("evidence photo preparation passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
