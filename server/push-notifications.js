const crypto = require("crypto");
const webpush = require("web-push");

const publicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || "");
const privateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || "");
const subject = String(process.env.WEB_PUSH_SUBJECT || "");
let configured = Boolean(publicKey && privateKey && /^mailto:[^@\s]+@[^@\s]+$/.test(subject));
if (configured) {
  try { webpush.setVapidDetails(subject, publicKey, privateKey); }
  catch { configured = false; console.error("Web Push VAPID configuration is invalid."); }
}

function validSubscription(value) {
  if (!value || typeof value !== "object") return false;
  const { endpoint, keys } = value;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !keys || typeof keys !== "object") return false;
  let url;
  try { url = new URL(endpoint); } catch { return false; }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
  const host = url.hostname.toLowerCase();
  const allowed = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
    host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
    host.endsWith(".notify.windows.com");
  return allowed && typeof keys.p256dh === "string" && /^[A-Za-z0-9_-]{80,100}$/.test(keys.p256dh) &&
    typeof keys.auth === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(keys.auth);
}

function endpointId(endpoint) { return crypto.createHash("sha256").update(endpoint).digest("hex"); }

function createPushNotifications(h) {
  async function rowsForUser(userId) {
    if (h.storageDriver === "supabase") return h.supabaseRest(`meo_push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`);
    const db = await h.readDb();
    return (db.pushSubscriptions || []).filter(row => row.user_id === userId);
  }

  async function remove(endpoint, userId) {
    const id = endpointId(endpoint);
    if (h.storageDriver === "supabase") {
      await h.supabaseRest(`meo_push_subscriptions?id=eq.${id}&user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE", prefer: "return=minimal" });
    } else {
      await h.mutateDb(db => { db.pushSubscriptions = (db.pushSubscriptions || []).filter(row => !(row.id === id && row.user_id === userId)); });
    }
  }

  async function handle(req, res, pathname) {
    if (!pathname.startsWith("/api/push/")) return false;
    const db = await h.readDb();
    const auth = h.requireAuth(db, req);
    if (req.method === "GET" && pathname === "/api/push/config") {
      let available = configured;
      if (available && h.storageDriver === "supabase") {
        try { await h.supabaseRest("meo_push_subscriptions?select=id&limit=0"); }
        catch { available = false; }
      }
      h.sendJson(res, 200, { available, publicKey: available ? publicKey : "" });
      return true;
    }
    if (req.method === "POST" && pathname === "/api/push/subscriptions/status") {
      const body = await h.readBody(req);
      if (!validSubscription(body.subscription)) throw Object.assign(new Error("Subscrição de notificações inválida."), { status: 400 });
      const rows = await rowsForUser(auth.user.id);
      h.sendJson(res, 200, { subscribed: rows.some(row => row.id === endpointId(body.subscription.endpoint)) });
      return true;
    }
    if (pathname !== "/api/push/subscriptions" || !["POST", "DELETE"].includes(req.method)) return false;
    if (!configured) throw Object.assign(new Error("As notificações do dispositivo ainda não estão configuradas."), { status: 503 });
    const body = await h.readBody(req);
    if (!validSubscription(body.subscription)) throw Object.assign(new Error("Subscrição de notificações inválida."), { status: 400 });
    const { endpoint, keys } = body.subscription;
    const id = endpointId(endpoint);
    if (req.method === "POST") {
      const row = { id, user_id: auth.user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
        updated_at: new Date().toISOString() };
      if (h.storageDriver === "supabase") {
        await h.supabaseRest("meo_push_subscriptions?on_conflict=id", { method: "POST", body: row,
          prefer: "resolution=merge-duplicates,return=minimal" });
      } else {
        await h.mutateDb(db => { db.pushSubscriptions = (db.pushSubscriptions || []).filter(item => item.id !== id); db.pushSubscriptions.push(row); });
      }
    } else await remove(endpoint, auth.user.id);
    h.sendJson(res, 200, { ok: true });
    return true;
  }

  async function sendToUsers(userIds, kind) {
    if (!configured || !userIds?.length) return;
    const payloads = {
      assignment: { title: "Novo trabalho atribuído", body: "Consulta a tua ordem ou tarefa na TrataPro." },
      schedule: { title: "Horário atualizado", body: "Consulta o teu planeamento na TrataPro." },
      dayOff: { title: "Pedido de folga decidido", body: "Consulta a decisão na TrataPro." },
      dayOffRequest: { title: "Novo pedido de folga", body: "Um pedido precisa de decisão no planeamento." },
      setback: { title: "Contratempo comunicado", body: "Uma tarefa precisa da atenção da empresa." },
      resolution: { title: "Contratempo resolvido", body: "Podes consultar a tarefa e retomar o trabalho." },
      message: { title: "Nova conversa", body: "Recebeste uma mensagem de trabalho na TrataPro." }
    };
    const notification = payloads[kind];
    if (!notification) return;
    try {
      const rows = (await Promise.all([...new Set(userIds)].map(rowsForUser))).flat();
      await Promise.all(rows.map(async row => {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
            JSON.stringify({ ...notification, kind }), { TTL: 3600, timeout: 2500 });
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) await remove(row.endpoint, row.user_id);
          else console.error(`Web Push delivery failed (${kind}): ${error.statusCode || error.message}`);
        }
      }));
    } catch (error) {
      console.error(`Web Push unavailable (${kind}): ${error.message}`);
    }
  }

  return { handle, sendToUsers };
}

module.exports = { createPushNotifications, validSubscription };
