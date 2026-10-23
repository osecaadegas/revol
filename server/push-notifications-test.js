const assert = require("node:assert/strict");
const webpush = require("web-push");
const keys = webpush.generateVAPIDKeys();
process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey;
process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey;
process.env.WEB_PUSH_SUBJECT = "mailto:push-test@example.com";
const { createPushNotifications, validSubscription } = require("./push-notifications");

const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test-device", keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } };
assert.equal(validSubscription(subscription), true);
for (const endpoint of ["http://localhost/push", "https://127.0.0.1/push", "https://evil.example/push", "https://fcm.googleapis.com.evil.example/push"]) {
  assert.equal(validSubscription({ ...subscription, endpoint }), false, endpoint);
}

const db = { pushSubscriptions: [] };
const sent = [];
webpush.sendNotification = async (_subscription, payload) => { sent.push(JSON.parse(payload)); return { statusCode: 201 }; };
const h = {
  storageDriver: "local", readDb: async () => db,
  mutateDb: async fn => fn(db),
  requireAuth: (_db, req) => { if (!req.userId) throw Object.assign(new Error("Auth required"), { status: 401 }); return { user: { id: req.userId } }; },
  readBody: async req => req.body,
  sendJson: (res, status, payload) => { res.status = status; res.payload = payload; }
};
const push = createPushNotifications(h);

(async () => {
  const res = {};
  await assert.rejects(() => push.handle({ method: "POST", userId: null, body: { subscription } }, res, "/api/push/subscriptions"), { status: 401 });
  await push.handle({ method: "POST", userId: "worker-1", body: { subscription } }, res, "/api/push/subscriptions");
  assert.equal(res.status, 200);
  assert.equal(db.pushSubscriptions.length, 1);
  assert.equal(db.pushSubscriptions[0].user_id, "worker-1");
  await push.handle({ method: "POST", userId: "worker-2", body: { subscription } }, res, "/api/push/subscriptions/status");
  assert.equal(res.payload.subscribed, false);
  await push.handle({ method: "POST", userId: "worker-1", body: { subscription } }, res, "/api/push/subscriptions/status");
  assert.equal(res.payload.subscribed, true);
  await push.sendToUsers(["worker-2"], "message");
  assert.equal(sent.length, 0, "other user must not receive this device's notification");
  await push.sendToUsers(["worker-1"], "message");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.includes("test-device"), false);
  webpush.sendNotification = async () => { throw Object.assign(new Error("Temporary push outage"), { statusCode: 503 }); };
  await assert.doesNotReject(() => push.sendToUsers(["worker-1"], "schedule"));
  await push.handle({ method: "DELETE", userId: "worker-2", body: { subscription } }, res, "/api/push/subscriptions");
  assert.equal(db.pushSubscriptions.length, 1, "other user must not remove this device");
  await push.handle({ method: "DELETE", userId: "worker-1", body: { subscription } }, res, "/api/push/subscriptions");
  assert.equal(db.pushSubscriptions.length, 0);
  console.log("ok important Web Push subscription and recipient boundaries");
})().catch(error => { console.error(error); process.exitCode = 1; });
