const { spawnSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const files = [
  "server.js",
  "server/index.js",
  "server/recruitment.js",
  "server/professional-profile.js",
  "server/direct-chat.js",
  "server/push-notifications.js",
  "server/punctuality.js",
  "server/push-notifications-test.js",
  "server/punctuality-test.js",
  "server/professional-profile-test.js",
  "server/professional-profile-ui-test.js",
  "server/recruitment-test.js",
  "server/design-test.js",
  "server/worker-home-ui-test.js",
  "server/evidence-photo-test.js",
  "server/evidence-upload-ui-test.js",
  "server/pwa-install-test.js",
  "server/public-marketplace.js",
  "server/private-mvp.js",
  "server/private-project.js",
  "server/check.js",
  "server/smoke-test.js",
  "server/storage-cache-test.js",
  "public/app.js",
  "public/evidence-photo.js",
  "public/design-system.js",
  "public/pwa-install.js",
  "public/recruitment-ui.js",
  "public/professional-profile-ui.js",
  "public/direct-chat-ui.js",
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
