const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "server/index.js",
  "server/check.js",
  "server/smoke-test.js",
  "public/app.js",
  "public/service-worker.js"
];

let failed = false;

for (const file of files) {
  const target = path.join(root, file);
  const result = spawnSync(process.execPath, ["--check", target], {
    stdio: "pipe",
    encoding: "utf-8"
  });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  } else {
    console.log(`ok ${file}`);
  }
}

if (failed) process.exit(1);
