const CACHE_NAME = "tratapro-shell-v31-important-push";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/pwa-install.js",
  "/recruitment-ui.js",
  "/professional-profile-ui.js",
  "/direct-chat-ui.js",
  "/design-system.js",
  "/vendor/lucide.svg",
  "/fonts/InterVariable.woff2",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/logo.svg",
  "/social-card.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL_ASSETS.map((asset) =>
          fetch(asset, { cache: "reload" })
            .then((response) => {
              if (response.ok) return cache.put(asset, response);
              return undefined;
            })
            .catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (/\.(?:js|css)$/.test(url.pathname) && url.searchParams.has("v")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })());
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("/index.html") : Response.error())))
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message = {};
    try { message = event.data?.json() || {}; } catch { /* Show a generic notice for malformed payloads. */ }
    const allowed = {
      assignment: ["Novo trabalho atribuído", "Consulta a tua ordem ou tarefa na TrataPro."],
      schedule: ["Horário atualizado", "Consulta o teu planeamento na TrataPro."],
      dayOff: ["Pedido de folga decidido", "Consulta a decisão na TrataPro."],
      dayOffRequest: ["Novo pedido de folga", "Um pedido precisa de decisão no planeamento."],
      setback: ["Contratempo comunicado", "Uma tarefa precisa da atenção da empresa."],
      resolution: ["Contratempo resolvido", "Podes consultar a tarefa e retomar o trabalho."],
      message: ["Nova conversa", "Recebeste uma mensagem de trabalho na TrataPro."]
    };
    const kind = Object.hasOwn(allowed, message.kind) ? message.kind : "message";
    const [title, body] = allowed[kind];
    await self.registration.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png",
      tag: `tratapro-${kind}`, data: { kind }, renotify: false });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const kind = event.notification.data?.kind;
    const target = new URL("/", self.location.origin);
    if (["assignment", "schedule", "dayOff", "dayOffRequest", "setback", "resolution", "message"].includes(kind)) target.searchParams.set("push", kind);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target.href);
      return existing.focus();
    }
    return self.clients.openWindow(target.href);
  })());
});
