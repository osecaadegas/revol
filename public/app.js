(function () {
  const app = document.getElementById("app");
  const tokenKey = "meo_session_token";

  const state = {
    token: localStorage.getItem(tokenKey) || "",
    initialized: false,
    view: "marketplace",
    authMode: "login",
    data: null,
    privateProjectHtml: "",
    privateMvpHtml: "",
    publicJobs: [],
    publicJobsWarning: "",
    publicMenuOpen: false,
    notice: null,
    selectedTaskId: null,
    filters: {
      query: "",
      status: "all",
      assignee: "all"
    },
    marketFilters: {
      query: "",
      position: "",
      location: "",
      radius: "all"
    },
    locationDraft: { status: "not_requested" },
    lastInviteLink: ""
  };

  const roleLabels = {
    manager: "Gestor",
    employee: "Funcionario",
    contractor: "Subempreiteiro",
    worker: "Worker",
    company: "Empresa",
    client: "Cliente",
    developer: "Developer"
  };

  const managedRoleOptions = [
    ["employee", "Funcionario"],
    ["contractor", "Subempreiteiro"],
    ["manager", "Gestor"],
    ["client", "Cliente"],
    ["developer", "Developer"]
  ];

  const defaultStatusLabels = {
    planned: "Planeada",
    assigned: "Atribuida",
    in_progress: "Em execucao",
    blocked: "Bloqueada / espera material",
    pending_validation: "A aguardar validacao",
    approved: "Aprovada",
    rejected: "Rejeitada"
  };

  const navItems = [
    ["project", "Projeto"],
    ["mvp", "MVP"],
    ["marketplace", "Vagas"],
    ["dashboard", "Painel"],
    ["orders", "Ordens"],
    ["tasks", "Tarefas"],
    ["team", "Equipa"],
    ["history", "Historico"]
  ];

  const knownLocations = {
    braga: { lat: 41.5454, lon: -8.4265, label: "Braga" },
    porto: { lat: 41.1579, lon: -8.6291, label: "Porto" },
    lisboa: { lat: 38.7223, lon: -9.1393, label: "Lisboa" },
    guimaraes: { lat: 41.4444, lon: -8.2962, label: "Guimaraes" },
    "celorico de basto": { lat: 41.3871, lon: -8.0002, label: "Celorico de Basto" },
    fafe: { lat: 41.4508, lon: -8.1726, label: "Fafe" },
    "vila real": { lat: 41.3006, lon: -7.7441, label: "Vila Real" },
    "viana do castelo": { lat: 41.6918, lon: -8.8344, label: "Viana do Castelo" },
    aveiro: { lat: 40.6405, lon: -8.6538, label: "Aveiro" },
    coimbra: { lat: 40.2033, lon: -8.4103, label: "Coimbra" },
    viseu: { lat: 40.6566, lon: -7.9125, label: "Viseu" },
    leiria: { lat: 39.7436, lon: -8.8071, label: "Leiria" },
    santarem: { lat: 39.2362, lon: -8.6850, label: "Santarem" },
    setubal: { lat: 38.5244, lon: -8.8882, label: "Setubal" },
    evora: { lat: 38.5710, lon: -7.9096, label: "Evora" },
    beja: { lat: 38.0151, lon: -7.8632, label: "Beja" },
    faro: { lat: 37.0194, lon: -7.9304, label: "Faro" },
    "castelo branco": { lat: 39.8222, lon: -7.4909, label: "Castelo Branco" },
    guarda: { lat: 40.5373, lon: -7.2658, label: "Guarda" },
    "ponta delgada": { lat: 37.7412, lon: -25.6756, label: "Ponta Delgada" },
    funchal: { lat: 32.6669, lon: -16.9241, label: "Funchal" }
  };

  const publicNavItems = [
    ["Vagas", "/"],
    ["Area do Cliente", "/cliente"]
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "Sem data";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: value.length > 10 ? "2-digit" : undefined,
      minute: value.length > 10 ? "2-digit" : undefined
    }).format(date);
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function resolveKnownLocation(value) {
    const normalized = normalizeSearch(value);
    if (!normalized) return null;
    if (knownLocations[normalized]) return knownLocations[normalized];
    const entry = Object.entries(knownLocations).find(
      ([key]) => normalized.includes(key) || key.includes(normalized)
    );
    return entry ? entry[1] : null;
  }

  function distanceKm(from, to) {
    if (!from || !to) return null;
    const earthRadiusKm = 6371;
    const dLat = degreesToRadians(to.lat - from.lat);
    const dLon = degreesToRadians(to.lon - from.lon);
    const lat1 = degreesToRadians(from.lat);
    const lat2 = degreesToRadians(to.lat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function degreesToRadians(value) {
    return (value * Math.PI) / 180;
  }

  function filterJobs(jobs) {
    const query = normalizeSearch(state.marketFilters.query);
    const position = normalizeSearch(state.marketFilters.position);
    const location = normalizeSearch(state.marketFilters.location);
    const radius = state.marketFilters.radius === "all" ? null : Number(state.marketFilters.radius);
    const origin = resolveKnownLocation(state.marketFilters.location);

    return jobs.filter((job) => {
      const titleAndDescription = normalizeSearch([
        job.title,
        job.position,
        job.companyName,
        job.description,
        job.requirements,
        job.contractType
      ].join(" "));
      const positionText = normalizeSearch([job.position, job.title, job.requirements].join(" "));
      const locationText = normalizeSearch(job.location);

      if (query && !titleAndDescription.includes(query)) return false;
      if (position && !positionText.includes(position)) return false;

      if (location) {
        if (origin && radius) {
          const jobLocation = resolveKnownLocation(job.location);
          if (!jobLocation) return locationText.includes(location);
          const distance = distanceKm(origin, jobLocation);
          return distance !== null && distance <= radius;
        }
        if (!locationText.includes(location)) return false;
      }

      return true;
    });
  }

  function activeMarketFilterCount() {
    return Object.values(state.marketFilters).filter((value) => value && value !== "all").length;
  }

  function clearMarketFilters() {
    state.marketFilters = {
      query: "",
      position: "",
      location: "",
      radius: "all"
    };
  }

  function topMarketValues(jobs, key, fallback = []) {
    const counts = new Map();
    jobs.forEach((job) => {
      const value = cleanDisplayValue(job[key]);
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    const values = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value)
      .slice(0, 5);
    return values.length ? values : fallback;
  }

  function cleanDisplayValue(value) {
    return String(value || "").trim();
  }

  function renderQuickFilterGroup(title, filter, values) {
    if (!values.length) return "";
    return `
      <section class="jobs-sidebar-block">
        <h2>${escapeHtml(title)}</h2>
        <div class="quick-filter-row">
          ${values
            .map(
              (value) => `
                <button
                  class="${state.marketFilters[filter] === value ? "active" : ""}"
                  type="button"
                  data-market-preset="${escapeHtml(filter)}"
                  data-market-value="${escapeHtml(value)}"
                >${escapeHtml(value)}</button>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderMarketFilters(context, totalJobs, shownJobs) {
    const activeCount = activeMarketFilterCount();
    const helperText = activeCount
      ? `${shownJobs} de ${totalJobs} vagas encontradas`
      : `${totalJobs} vagas abertas no mercado`;
    return `
      <form class="market-filter-bar" data-market-filter-form="${context}">
        <div class="market-filter-main">
          <div class="field compact">
            <label>Pesquisar</label>
            <input data-market-filter="query" value="${escapeHtml(state.marketFilters.query)}" placeholder="Empresa, palavra-chave ou contrato">
          </div>
          <div class="field compact">
            <label>Cargo / funcao</label>
            <input data-market-filter="position" value="${escapeHtml(state.marketFilters.position)}" placeholder="Ex: trabalhador agricola">
          </div>
          <div class="field compact">
            <label>Localizacao</label>
            <input data-market-filter="location" value="${escapeHtml(state.marketFilters.location)}" placeholder="Ex: Braga, Porto, Lisboa">
          </div>
          <div class="field compact">
            <label>Raio</label>
            <select data-market-filter="radius">
              ${[
                ["all", "Qualquer distancia"],
                ["5", "5 km"],
                ["10", "10 km"],
                ["25", "25 km"],
                ["50", "50 km"],
                ["100", "100 km"],
                ["250", "250 km"]
              ].map(([value, label]) => `<option value="${value}" ${state.marketFilters.radius === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="market-filter-actions">
          <span class="filter-summary">${escapeHtml(helperText)}</span>
          <button class="btn primary" type="submit">Filtrar vagas</button>
          ${activeCount ? `<button class="btn ghost" type="button" data-action="clear-market-filters" data-market-context="${context}">Limpar filtros</button>` : ""}
        </div>
      </form>
    `;
  }

  function statusLabel(status) {
    return (state.data?.statusLabels || defaultStatusLabels)[status] || status;
  }

  function setNotice(message, type = "success") {
    state.notice = { message, type };
  }

  function clearNotice() {
    state.notice = null;
  }

  function googleAuthMessage(code) {
    const messages = {
      google_not_configured: "Login Google ainda nao esta configurado no servidor.",
      google_account_not_registered: "Nao existe conta para esse email Google. Crie uma conta worker ou peca convite/acesso ao responsavel.",
      google_forbidden: "Essa conta Google nao pode iniciar sessao nesta aplicacao.",
      google_cancelled: "Login Google cancelado.",
      google_missing_code: "Resposta Google incompleta. Tente novamente.",
      google_failed: "Nao foi possivel concluir o login Google."
    };
    return messages[code] || messages.google_failed;
  }

  function consumeAuthQuery() {
    const params = new URLSearchParams(location.search);
    const auth = params.get("auth");
    const authError = params.get("auth_error");
    if (auth === "google") {
      setNotice("Sessao iniciada com Google.");
    } else if (authError) {
      setNotice(googleAuthMessage(authError), "error");
    }
    if (auth || authError) {
      params.delete("auth");
      params.delete("auth_error");
      const nextSearch = params.toString();
      history.replaceState({}, "", `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`);
    }
    return auth === "google";
  }

  function googleAuthUrl(intent = "login", next = "/") {
    return `/api/auth/google/start?intent=${encodeURIComponent(intent)}&next=${encodeURIComponent(next)}`;
  }

  function renderGoogleAuthButton(label, intent = "login", next = "/") {
    return `
      <a class="btn google full" href="${googleAuthUrl(intent, next)}">
        <span aria-hidden="true">G</span>
        ${escapeHtml(label)}
      </a>
    `;
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(path, {
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.blob();
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(tokenKey);
        state.token = "";
        state.data = null;
      }
      throw new Error(payload.error || "Pedido falhou.");
    }
    return payload;
  }

  function saveSession(session) {
    state.token = session.token;
    localStorage.setItem(tokenKey, session.token);
  }

  async function refreshData() {
    state.data = await api("/api/bootstrap");
  }

  async function refreshPrivateProject() {
    if (!canViewPrivateProject()) {
      state.privateProjectHtml = "";
      return;
    }
    const payload = await api("/api/project/private");
    state.privateProjectHtml = payload.html || "";
  }

  async function refreshPrivateMvp() {
    if (!canViewPrivateProject()) {
      state.privateMvpHtml = "";
      return;
    }
    const payload = await api("/api/mvp/private");
    state.privateMvpHtml = payload.html || "";
  }

  async function refreshActivePrivateView() {
    if (state.view === "project") {
      await refreshPrivateProject();
    }
    if (state.view === "mvp") {
      await refreshPrivateMvp();
    }
  }

  async function refreshPublicJobs() {
    const payload = await api("/api/jobs/public");
    state.publicJobs = payload.jobs || [];
    state.publicJobsWarning = payload.warning || "";
  }

  function currentUser() {
    return state.data?.user || null;
  }

  function isManager() {
    return ["manager", "company"].includes(currentUser()?.role);
  }

  function canUseOperations() {
    return ["manager", "company", "employee", "contractor"].includes(currentUser()?.role);
  }

  function canViewPrivateProject() {
    return ["client", "developer"].includes(currentUser()?.role);
  }

  function isWorker() {
    return currentUser()?.role === "worker";
  }

  function defaultViewForUser() {
    const role = currentUser()?.role;
    if (canViewPrivateProject()) return "project";
    if (role === "worker") return "marketplace";
    if (!canUseOperations()) return "marketplace";
    return "dashboard";
  }

  function userById(id) {
    return state.data?.users.find((user) => user.id === id) || null;
  }

  function orderById(id) {
    return state.data?.workOrders.find((order) => order.id === id) || null;
  }

  function taskById(id) {
    return state.data?.tasks.find((task) => task.id === id) || null;
  }

  function taskEvidence(taskId) {
    return (state.data?.evidences || []).filter((evidence) => evidence.taskId === taskId);
  }

  function orderEvidence(orderId) {
    return (state.data?.evidences || []).filter(
      (evidence) => evidence.workOrderId === orderId && !evidence.taskId
    );
  }

  function taskLogs(taskId) {
    const evidenceIds = new Set(taskEvidence(taskId).map((item) => item.id));
    return (state.data?.auditLogs || []).filter(
      (log) =>
        (log.entityType === "task" && log.entityId === taskId) ||
        (log.entityType === "evidence" && evidenceIds.has(log.entityId))
    );
  }

  function noticeHtml() {
    if (!state.notice) return "";
    return `<div class="notice ${state.notice.type}">${escapeHtml(state.notice.message)}</div>`;
  }

  function publicRoute() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/cliente" || path === "/dashboard") return "cliente";
    if (path === "/changelog") return "restricted";
    return "home";
  }

  function renderPublicTopNav(activeRoute = "home") {
    return `
      <header class="public-topbar">
        <a class="public-brand" href="/">
          <span class="brand-mark">LT</span>
          <div>
            <strong>LuisTrata Jobs</strong>
            <span>Vagas e trabalho</span>
          </div>
        </a>
        ${activeRoute === "home" ? `
          <form class="public-top-search" data-market-filter-form="topbar">
            <input data-market-filter="query" value="${escapeHtml(state.marketFilters.query)}" placeholder="Pesquisar vagas">
            <input data-market-filter="location" value="${escapeHtml(state.marketFilters.location)}" placeholder="Localizacao">
            <button type="submit">Pesquisar</button>
          </form>
        ` : ""}
        <button class="public-menu-button" type="button" data-action="toggle-public-menu" aria-expanded="${state.publicMenuOpen ? "true" : "false"}" aria-label="Abrir navegacao">
          <span></span><span></span><span></span>
        </button>
        <nav class="public-nav ${state.publicMenuOpen ? "open" : ""}" aria-label="Navegacao principal">
          ${publicNavItems
            .map(([label, href]) => {
              const active = (activeRoute === "home" && href === "/") || (activeRoute === "cliente" && href === "/cliente");
              return `<a href="${href}" class="${active ? "active" : ""}" data-close-public-menu>${escapeHtml(label)}</a>`;
            })
            .join("")}
          ${activeRoute === "home" ? `
            <a href="#acesso" data-auth-preset="login">Entrar</a>
            <button class="public-nav-button" type="button" data-auth-preset="company">Publicar vaga</button>
          ` : ""}
        </nav>
      </header>
    `;
  }

  function renderPublicShell(content, route = "home") {
    document.title = route === "cliente"
        ? "Area do Cliente - MANIFESTO"
        : "LuisTrata Jobs - Vagas abertas";
    app.innerHTML = `
      <main class="manifesto-shell">
        ${renderPublicTopNav(route)}
        ${content}
        ${renderPublicFooter()}
      </main>
    `;
    bindPublicEvents();
    bindAuthForms();
  }

  function renderPublicFooter() {
    return `
      <footer class="public-footer">
        <div>
          <strong>LuisTrata Jobs</strong>
          <span>Vagas abertas para consulta publica</span>
        </div>
        <a href="/">Vagas</a>
        <a href="/cliente">Area do cliente</a>
      </footer>
    `;
  }

  function renderAuthHero() {
    return `
      <section class="auth-hero access-hero">
        <div>
          <span class="brand-mark">M</span>
        </div>
        <div class="auth-title">
          <p class="eyebrow">Area reservada</p>
          <h1>MANIFESTO</h1>
          <p>Acesso privado para cliente, equipa de desenvolvimento e utilizadores autorizados.</p>
        </div>
        <div class="auth-facts">
          <div class="fact"><strong>01</strong><span>Entrar com conta autorizada</span></div>
          <div class="fact"><strong>02</strong><span>Gerir vagas ou operacoes</span></div>
          <div class="fact"><strong>03</strong><span>Consultar informacao privada no workspace</span></div>
        </div>
      </section>
    `;
  }

  function renderPublicBoard() {
    const route = publicRoute();
    if (route === "home") {
      renderPublicMarketplacePage();
      return;
    }
    if (route === "cliente") {
      renderClientAreaPage();
      return;
    }
    if (route === "restricted") {
      renderRestrictedInfoPage();
      return;
    }
    renderClientAreaPage();
  }

  function renderPublicMarketplacePage() {
    const allJobs = state.publicJobs || [];
    const jobs = filterJobs(allJobs);
    const openJobs = allJobs.filter((job) => job.status === "open").length;
    const companies = new Set(allJobs.map((job) => job.companyName).filter(Boolean)).size;
    const locations = topMarketValues(allJobs, "location", ["Braga", "Porto", "Lisboa", "Vila Real"]);
    const positions = topMarketValues(allJobs, "position", ["Agricultura", "Construcao", "Servicos", "Logistica"]);
    const hasFilters = activeMarketFilterCount() > 0;

    renderPublicShell(`
      ${noticeHtml()}
      ${state.publicJobsWarning ? `<div class="public-warning notice error">${escapeHtml(state.publicJobsWarning)}</div>` : ""}
      <section class="jobs-home">
        <section class="network-landing">
          <aside class="network-profile-card" aria-label="Entrada para candidatos">
            <div class="network-cover"></div>
            <div class="network-avatar">W</div>
            <h2>Perfil candidato</h2>
            <p>Crie uma conta worker para guardar candidaturas e responder a ofertas abertas.</p>
            <button class="btn accent full" type="button" data-auth-preset="worker">Criar perfil</button>
          </aside>

          <section class="network-search-card">
            <p class="eyebrow">Mercado de trabalho</p>
            <h1>Encontre trabalho, candidate-se e acompanhe oportunidades.</h1>
            <form class="landing-search-card" data-market-filter-form="landing">
              <div class="field compact">
                <label>Cargo, empresa ou palavra-chave</label>
                <input data-market-filter="query" value="${escapeHtml(state.marketFilters.query)}" placeholder="Ex: operador agricola, pintor, logistica">
              </div>
              <div class="field compact">
                <label>Localizacao</label>
                <input data-market-filter="location" value="${escapeHtml(state.marketFilters.location)}" placeholder="Braga, Porto, Lisboa">
              </div>
              <button class="btn primary" type="submit">Pesquisar vagas</button>
            </form>
            <div class="landing-suggestions" aria-label="Pesquisas rapidas">
              ${positions.slice(0, 4).map((value) => `<button type="button" data-market-preset="position" data-market-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("")}
            </div>
            <div class="network-metrics-row" aria-label="Resumo do mercado">
              <div><strong>${openJobs}</strong><span>vagas abertas</span></div>
              <div><strong>${companies}</strong><span>empresas ativas</span></div>
              <div><strong>${locations.length}</strong><span>zonas em destaque</span></div>
            </div>
          </section>

          <aside class="network-action-card" aria-label="Entrada para empresas">
            <h2>Contrate talento</h2>
            <p>Publique vagas, receba candidaturas e faça a triagem dentro da conta empresa.</p>
            <div class="network-action-list">
              <span>Vagas publicas sempre visiveis</span>
              <span>Candidaturas com conta worker</span>
              <span>Publicacao com conta empresa</span>
            </div>
            <button class="btn primary full" type="button" data-auth-preset="company">Publicar vaga</button>
            <a class="btn ghost full" href="/cliente">Area do cliente</a>
          </aside>
        </section>

        <section class="jobs-layout" id="vagas">
          <aside class="jobs-sidebar" aria-label="Filtros rapidos">
            <section class="jobs-sidebar-block jobs-stats">
              <h2>Mercado</h2>
              <div class="jobs-stat-grid">
                <div><strong>${openJobs}</strong><span>vagas abertas</span></div>
                <div><strong>${companies}</strong><span>empresas</span></div>
              </div>
            </section>
            ${renderQuickFilterGroup("Localizacoes", "location", locations)}
            ${renderQuickFilterGroup("Funcoes", "position", positions)}
          </aside>

          <main class="jobs-results">
            ${renderMarketFilters("public", allJobs.length, jobs.length)}
            <div class="jobs-feed-header">
              <div>
                <p class="eyebrow">Resultados</p>
                <h2>${jobs.length ? `${jobs.length} vagas ${hasFilters ? "encontradas" : "em destaque"}` : "Sem vagas encontradas"}</h2>
              </div>
              ${hasFilters ? `<button class="btn ghost" type="button" data-action="clear-market-filters" data-market-context="public">Limpar filtros</button>` : ""}
            </div>
            <div class="list jobs-feed">
              ${jobs.length ? jobs.map((job) => renderJobCard(job, { publicMode: true })).join("") : empty(activeMarketFilterCount() ? "Nenhuma vaga corresponde aos filtros escolhidos." : "Ainda nao existem vagas publicadas.")}
            </div>
          </main>

          <aside class="jobs-account-panel" id="acesso">
            <div class="jobs-sidebar-block">
              <h2>Acesso</h2>
              <p>Workers candidatam-se. Empresas publicam vagas. Cliente e developer entram pela area reservada.</p>
            </div>
            ${renderAuthSwitcher()}
          </aside>
        </section>
      </section>
    `, "home");
  }

  function renderClientAreaPage() {
    renderPublicShell(`
      ${noticeHtml()}
      ${state.publicJobsWarning ? `<div class="public-warning notice error">${escapeHtml(state.publicJobsWarning)}</div>` : ""}
      <section class="client-login-page">
        <article class="client-login-copy">
          <p class="eyebrow">Area do Cliente</p>
          <h1>Acesso reservado</h1>
          <p>Informacao de projeto, progresso do MVP, documentacao e acompanhamento ficam apenas no workspace autenticado para cliente e developer.</p>
          <div class="client-login-points">
            <span>Projeto</span>
            <span>MVP</span>
            <span>Documentacao</span>
          </div>
        </article>
        <div class="client-login-panel">
          ${renderClientLoginForm()}
        </div>
      </section>
    `, "cliente");
  }

  function renderRestrictedInfoPage() {
    renderPublicShell(`
      <section class="public-page-hero">
        <p class="eyebrow">Conteudo reservado</p>
        <h1>Informacao disponivel apenas no workspace</h1>
        <p>Esta rota deixou de expor dados do projeto em publico. Entre pela Area do Cliente para aceder com uma conta autorizada.</p>
      </section>
      <section class="public-section split client-access-grid">
        <article class="concept-panel">
          <span>Privado</span>
          <h2>Cliente / Developer</h2>
          <p>A informacao detalhada do projeto fica dentro do workspace autenticado.</p>
        </article>
        <div>
          ${renderAuthSwitcher()}
        </div>
      </section>
    `, "cliente");
  }

  function renderPrivateProjectView() {
    if (state.privateProjectHtml) return state.privateProjectHtml;
    return `
      <section class="view-heading">
        <div>
          <h1>Projeto</h1>
          <p>Informacao privada em carregamento.</p>
        </div>
      </section>
      ${empty("A carregar dashboard privado...")}
    `;
  }

  function renderPrivateMvpView() {
    if (state.privateMvpHtml) return state.privateMvpHtml;
    return `
      <section class="view-heading">
        <div>
          <h1>Area privada</h1>
          <p>Vista privada em carregamento.</p>
        </div>
      </section>
      ${empty("A carregar area privada...")}
    `;
  }

  function renderAuthSwitcher() {
    const mode = state.authMode;
    return `
      <div class="panel">
        <div class="segmented">
          <button class="${mode === "login" ? "active" : ""}" data-auth-mode="login">Entrar</button>
          <button class="${mode === "worker" ? "active" : ""}" data-auth-mode="worker">Worker</button>
          <button class="${mode === "company" ? "active" : ""}" data-auth-mode="company">Empresa</button>
        </div>
        ${mode === "worker" ? renderWorkerRegistrationForm() : mode === "company" ? renderCompanyRegistrationForm() : renderLoginForm()}
      </div>
    `;
  }

  function renderLoginForm() {
    return `
      <form class="form-grid" data-form="login">
        <div>
          <h2>Entrar</h2>
          <p class="muted">Aceda para candidatar-se, publicar vagas ou gerir operacoes.</p>
        </div>
        ${renderGoogleAuthButton("Entrar com Google", "login", "/")}
        <div class="auth-divider"><span>ou email</span></div>
        <div class="field">
          <label>Email</label>
          <input name="email" required type="email" autocomplete="email" placeholder="nome@empresa.pt">
        </div>
        <div class="field">
          <label>Password</label>
          <input name="password" required type="password" autocomplete="current-password">
        </div>
        <button class="btn primary full" type="submit">Entrar</button>
      </form>
    `;
  }

  function renderClientLoginForm() {
    return `
      <div class="panel">
        <form class="form-grid" data-form="login">
          <div>
            <h2>Entrar na area reservada</h2>
            <p class="muted">Use uma conta autorizada de cliente ou developer para acompanhar projeto, MVP e documentacao privada.</p>
          </div>
          ${renderGoogleAuthButton("Entrar com Google", "login", "/cliente")}
          <div class="auth-divider"><span>ou email</span></div>
          <div class="field">
            <label>Email</label>
            <input name="email" required type="email" autocomplete="email" placeholder="cliente@empresa.pt">
          </div>
          <div class="field">
            <label>Password</label>
            <input name="password" required type="password" autocomplete="current-password">
          </div>
          <button class="btn primary full" type="submit">Entrar</button>
        </form>
      </div>
    `;
  }

  function renderWorkerRegistrationForm() {
    return `
      <form class="form-grid" data-form="register-worker">
        <div>
          <h2>Registar worker</h2>
          <p class="muted">Conta individual para candidatar-se a vagas publicas.</p>
        </div>
        ${renderGoogleAuthButton("Criar worker com Google", "worker", "/")}
        <div class="auth-divider"><span>ou formulario</span></div>
        <div class="field"><label>Nome</label><input name="name" required autocomplete="name"></div>
        <div class="field"><label>Email</label><input name="email" required type="email" autocomplete="email"></div>
        <div class="field"><label>Password</label><input name="password" required type="password" minlength="8" autocomplete="new-password"></div>
        <div class="field"><label>Titulo profissional</label><input name="headline" placeholder="Ex: Operador agricola, jardineiro, pintor"></div>
        <div class="field"><label>Localizacao</label><input name="location" placeholder="Concelho ou regiao"></div>
        <div class="field"><label>Competencias</label><textarea name="skills" placeholder="Ferramentas, experiencia, certificacoes"></textarea></div>
        <button class="btn accent full" type="submit">Criar conta worker</button>
      </form>
    `;
  }

  function renderCompanyRegistrationForm() {
    return `
      <form class="form-grid" data-form="register-company">
        <div>
          <h2>Registar empresa</h2>
          <p class="muted">Conta empresarial para publicar vagas e rever candidaturas.</p>
        </div>
        <div class="field"><label>Empresa</label><input name="companyName" required autocomplete="organization"></div>
        <div class="field"><label>Responsavel</label><input name="name" required autocomplete="name"></div>
        <div class="field"><label>Email</label><input name="email" required type="email" autocomplete="email"></div>
        <div class="field"><label>Password</label><input name="password" required type="password" minlength="8" autocomplete="new-password"></div>
        <div class="field"><label>Localizacao</label><input name="location" placeholder="Cidade ou regiao"></div>
        <div class="field"><label>Setor</label><input name="sector" placeholder="Ex: agricultura, construcao, servicos"></div>
        <div class="field"><label>Website</label><input name="website" placeholder="https://..."></div>
        <button class="btn primary full" type="submit">Criar conta empresa</button>
      </form>
    `;
  }

  function renderSetup() {
    app.innerHTML = `
      <main class="auth-layout">
        ${renderAuthHero()}
        <section class="auth-panel">
          <form class="form-card form-grid" data-form="setup">
            ${noticeHtml()}
            <div>
              <p class="eyebrow" style="color: var(--accent-2)">Primeira configuracao</p>
              <h2>Criar empresa e gestor</h2>
              <p>Este passo cria a primeira conta de gestao. Depois pode criar funcionarios, prestadores, ordens e tarefas.</p>
            </div>
            <div class="field">
              <label>Empresa</label>
              <input name="companyName" required autocomplete="organization" placeholder="Nome da empresa">
            </div>
            <div class="field">
              <label>Nome do gestor</label>
              <input name="name" required autocomplete="name" placeholder="Nome completo">
            </div>
            <div class="field">
              <label>Email</label>
              <input name="email" required type="email" autocomplete="email" placeholder="gestor@empresa.pt">
            </div>
            <div class="field">
              <label>Password</label>
              <input name="password" required type="password" minlength="8" autocomplete="new-password" placeholder="Minimo 8 caracteres">
            </div>
            <button class="btn primary full" type="submit">Criar ambiente</button>
          </form>
        </section>
      </main>
    `;
    bindAuthForms();
  }

  function renderLogin() {
    app.innerHTML = `
      <main class="auth-layout">
        ${renderAuthHero()}
        <section class="auth-panel">
          <form class="form-card form-grid" data-form="login">
            ${noticeHtml()}
            <div>
              <p class="eyebrow" style="color: var(--accent-2)">Entrada</p>
              <h2>Aceder a aplicacao</h2>
              <p>Use a conta criada pelo gestor ou aceite um convite recebido.</p>
            </div>
            ${renderGoogleAuthButton("Entrar com Google", "login", "/")}
            <div class="auth-divider"><span>ou email</span></div>
            <div class="field">
              <label>Email</label>
              <input name="email" required type="email" autocomplete="email" placeholder="nome@empresa.pt">
            </div>
            <div class="field">
              <label>Password</label>
              <input name="password" required type="password" autocomplete="current-password">
            </div>
            <button class="btn primary full" type="submit">Entrar</button>
          </form>
        </section>
      </main>
    `;
    bindAuthForms();
  }

  async function renderInvite(token) {
    try {
      const payload = await api(`/api/invites/${encodeURIComponent(token)}`);
      app.innerHTML = `
        <main class="auth-layout">
          ${renderAuthHero()}
          <section class="auth-panel">
            <form class="form-card form-grid" data-form="accept-invite" data-token="${escapeHtml(token)}">
              ${noticeHtml()}
              <div>
                <p class="eyebrow" style="color: var(--accent-2)">Convite seguro</p>
                <h2>${escapeHtml(payload.company.name)}</h2>
                <p>Perfil: ${escapeHtml(roleLabels[payload.invite.role] || payload.invite.role)}. Defina a sua password para entrar.</p>
              </div>
              <div class="field">
                <label>Nome</label>
                <input name="name" required value="${escapeHtml(payload.invite.name || "")}" autocomplete="name">
              </div>
              <div class="field">
                <label>Email</label>
                <input name="email" required type="email" value="${escapeHtml(payload.invite.email || "")}" autocomplete="email">
              </div>
              <div class="field">
                <label>Password</label>
                <input name="password" required type="password" minlength="8" autocomplete="new-password">
              </div>
              <button class="btn primary full" type="submit">Aceitar convite</button>
            </form>
          </section>
        </main>
      `;
      bindAuthForms();
    } catch (error) {
      setNotice(error.message, "error");
      renderLogin();
    }
  }

  function bindAuthForms() {
    const form = document.querySelector("[data-form]");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearNotice();
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        let payload;
        if (form.dataset.form === "setup") {
          payload = await api("/api/setup", { method: "POST", body: data });
        } else if (form.dataset.form === "login") {
          payload = await api("/api/auth/login", { method: "POST", body: data });
        } else if (form.dataset.form === "register-worker") {
          payload = await api("/api/register/worker", { method: "POST", body: data });
        } else if (form.dataset.form === "register-company") {
          payload = await api("/api/register/company", { method: "POST", body: data });
        } else {
          const token = form.dataset.token;
          payload = await api(`/api/invites/${encodeURIComponent(token)}/accept`, {
            method: "POST",
            body: data
          });
          history.replaceState({}, "", "/");
        }
        saveSession(payload.session);
        state.data = payload.bootstrap;
        state.view = defaultViewForUser();
        if (["project", "mvp"].includes(state.view)) {
          try {
            await refreshActivePrivateView();
          } catch (error) {
            setNotice(error.message, "error");
          }
        }
        if (!state.notice) setNotice("Sessao iniciada.");
        renderApp();
      } catch (error) {
        setNotice(error.message, "error");
        if (form.dataset.form === "setup") renderSetup();
        else if (["login", "register-worker", "register-company"].includes(form.dataset.form)) {
          renderPublicBoard();
        }
        else renderInvite(form.dataset.token);
      }
    });
  }

  function bindPublicEvents() {
    bindMarketFilters(renderPublicBoard);

    document.querySelectorAll("[data-action='toggle-public-menu']").forEach((button) => {
      button.addEventListener("click", () => {
        state.publicMenuOpen = !state.publicMenuOpen;
        renderPublicBoard();
      });
    });

    document.querySelectorAll("[data-close-public-menu]").forEach((link) => {
      link.addEventListener("click", () => {
        state.publicMenuOpen = false;
        document.querySelector(".public-nav")?.classList.remove("open");
        document.querySelector("[data-action='toggle-public-menu']")?.setAttribute("aria-expanded", "false");
      });
    });

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = button.dataset.authMode;
        state.publicMenuOpen = false;
        clearNotice();
        renderPublicBoard();
      });
    });

    document.querySelectorAll("[data-public-apply]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = "worker";
        setNotice("Registe-se como worker para se candidatar a esta vaga.");
        renderPublicBoard();
      });
    });

    document.querySelectorAll("[data-public-create-job]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = "company";
        setNotice("Registe-se como empresa para publicar vagas.");
        renderPublicBoard();
      });
    });

    document.querySelectorAll("[data-auth-preset]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        state.authMode = button.dataset.authPreset || "login";
        clearNotice();
        renderPublicBoard();
        requestAnimationFrame(() => {
          document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    });

    document.querySelectorAll("[data-market-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.marketPreset;
        const value = button.dataset.marketValue || "";
        state.marketFilters[filter] = state.marketFilters[filter] === value ? "" : value;
        if (filter === "location" && value && state.marketFilters.radius === "all") {
          state.marketFilters.radius = "50";
        }
        clearNotice();
        renderPublicBoard();
      });
    });
  }

  function bindMarketFilters(renderTarget) {
    document.querySelectorAll("[data-market-filter-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const context = form.dataset.marketFilterForm;
        form.querySelectorAll("[data-market-filter]").forEach((control) => {
          state.marketFilters[control.dataset.marketFilter] = control.value;
        });
        clearNotice();
        renderTarget();
        if (["landing", "topbar"].includes(context)) {
          requestAnimationFrame(() => {
            document.getElementById("vagas")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      });
    });

    document.querySelectorAll("[data-action='clear-market-filters']").forEach((button) => {
      button.addEventListener("click", () => {
        clearMarketFilters();
        clearNotice();
        renderTarget();
      });
    });
  }

  function renderApp() {
    const user = currentUser();
    if (!state.data || !user) {
      renderPublicBoard();
      return;
    }
    app.innerHTML = `
      <div class="main-layout">
        <aside class="sidebar">
          <div class="side-brand">
            <span class="brand-mark">M</span>
            <div>
              <strong>MANIFESTO</strong>
              <span>${escapeHtml(state.data.company.name)}</span>
            </div>
          </div>
          ${renderNav("nav")}
          <div class="session-card">
            <strong>${escapeHtml(user.name)}</strong>
            <span>${escapeHtml(roleLabels[user.role] || user.role)}</span>
            <button class="btn ghost full" style="margin-top: 12px" data-action="logout">Sair</button>
          </div>
        </aside>
        <main class="content">
          <div class="topbar">
            <div class="side-brand" style="color: var(--ink)">
              <span class="brand-mark" style="color: var(--ink); border-color: var(--line)">M</span>
              <div>
                <strong>MANIFESTO</strong>
                <span style="color: var(--muted)">${escapeHtml(state.data.company.name)}</span>
              </div>
            </div>
            <button class="btn ghost" data-action="logout">Sair</button>
          </div>
          ${noticeHtml()}
          ${renderView()}
        </main>
      </div>
      ${renderMobileNav()}
      ${renderTaskDrawer()}
    `;
    bindAppEvents();
  }

  function renderNav(className) {
    return `
      <nav class="${className}">
        ${navItems
          .filter(([view]) => {
            if (view === "project") return canViewPrivateProject();
            if (view === "mvp") return canViewPrivateProject();
            if (view === "team") return isManager();
            if (["orders", "tasks", "dashboard", "history"].includes(view)) return canUseOperations();
            return true;
          })
          .map(
            ([view, label]) => `
              <button type="button" data-view="${view}" class="${state.view === view ? "active" : ""}">
                <span>${label}</span><span>${view === "tasks" ? state.data.tasks.length : ""}</span>
              </button>
            `
          )
          .join("")}
      </nav>
    `;
  }

  function renderMobileNav() {
    return `
      <nav class="mobile-nav">
        ${navItems
          .filter(([view]) => {
            if (view === "project") return canViewPrivateProject();
            if (view === "mvp") return canViewPrivateProject();
            if (view === "team") return isManager();
            if (["orders", "tasks", "dashboard", "history"].includes(view)) return canUseOperations();
            return true;
          })
          .map(
            ([view, label]) => `
              <button type="button" data-view="${view}" class="${state.view === view ? "active" : ""}">${label}</button>
            `
          )
          .join("")}
      </nav>
    `;
  }

  function renderView() {
    if (state.view === "project") return canViewPrivateProject() ? renderPrivateProjectView() : renderMarketplace();
    if (state.view === "mvp") return canViewPrivateProject() ? renderPrivateMvpView() : renderMarketplace();
    if (state.view === "marketplace") return renderMarketplace();
    if (state.view === "orders") return canUseOperations() ? renderOrders() : renderMarketplace();
    if (state.view === "tasks") return canUseOperations() ? renderTasks() : renderMarketplace();
    if (state.view === "team") return renderTeam();
    if (state.view === "history") return canUseOperations() ? renderHistory() : renderMarketplace();
    return canUseOperations() ? renderDashboard() : renderMarketplace();
  }

  function getCounts() {
    const tasks = state.data.tasks;
    return {
      total: tasks.length,
      active: tasks.filter((task) => ["assigned", "in_progress", "blocked"].includes(task.status)).length,
      pending: tasks.filter((task) => task.status === "pending_validation").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      approved: tasks.filter((task) => task.status === "approved").length
    };
  }

  function renderMarketplace() {
    const role = currentUser()?.role;
    const allJobs = state.data.jobOffers || [];
    const jobs = filterJobs(allJobs);
    const applications = state.data.jobApplications || [];
    return `
      <section class="view-heading">
        <div>
          <h1>Mercado de vagas</h1>
          <p>${role === "worker" ? "Veja vagas abertas e acompanhe as suas candidaturas." : isManager() ? "Publique vagas, acompanhe candidaturas e mantenha as oportunidades visiveis no mercado." : "Veja as vagas abertas sem acesso a candidaturas ou publicacao."}</p>
        </div>
      </section>
      ${renderMarketFilters("app", allJobs.length, jobs.length)}
      <section class="section-grid">
        <div class="panel">
          <div class="panel-header">
            <h2>${isManager() ? "Vagas da empresa" : "Vagas abertas"}</h2>
            <span class="chip">${jobs.length}/${allJobs.length}</span>
          </div>
          <div class="list">
            ${jobs.length ? jobs.map((job) => renderJobCard(job)).join("") : empty(activeMarketFilterCount() ? "Nenhuma vaga corresponde aos filtros escolhidos." : isManager() ? "A sua empresa ainda nao publicou vagas." : "Nao ha vagas abertas neste momento.")}
          </div>
        </div>
        <div>
          ${isManager() ? renderJobOfferForm() : isWorker() ? renderWorkerApplications(applications) : renderMarketplaceReadOnlyPanel()}
          ${isManager() ? renderCompanyApplications(applications) : ""}
        </div>
      </section>
    `;
  }

  function renderMarketplaceReadOnlyPanel() {
    return `
      <div class="panel">
        <div class="panel-header"><h2>Acesso de leitura</h2></div>
        <p class="muted">Esta conta pode consultar vagas abertas. Para candidatar-se use uma conta worker; para publicar vagas use uma conta empresa.</p>
      </div>
    `;
  }

  function renderJobOfferForm() {
    return `
      <form class="panel form-grid" data-form="create-job">
        <div class="panel-header"><h2>Nova vaga</h2></div>
        <div class="split-fields">
          <div class="field"><label>Titulo</label><input name="title" required placeholder="Ex: Equipa para vindima"></div>
          <div class="field"><label>Cargo / funcao</label><input name="position" required placeholder="Ex: Trabalhador agricola"></div>
        </div>
        <div class="field"><label>Localizacao</label><input name="location" required placeholder="Concelho, distrito ou remoto"></div>
        <div class="split-fields">
          <div class="field"><label>Contrato</label><input name="contractType" placeholder="Full-time, projeto, sazonal"></div>
          <div class="field"><label>Remuneracao</label><input name="salary" placeholder="Ex: A combinar"></div>
        </div>
        <div class="field"><label>Horario</label><input name="schedule" placeholder="Ex: Segunda a sexta"></div>
        <div class="field"><label>Descricao</label><textarea name="description" required placeholder="O que a pessoa vai fazer"></textarea></div>
        <div class="field"><label>Requisitos</label><textarea name="requirements" placeholder="Experiencia, carta, ferramentas, disponibilidade"></textarea></div>
        <button class="btn primary full" type="submit">Publicar vaga</button>
      </form>
    `;
  }

  function renderWorkerApplications(applications) {
    return `
      <div class="panel">
        <div class="panel-header"><h2>As minhas candidaturas</h2></div>
        <div class="list">
          ${applications.length ? applications.map(renderApplicationCard).join("") : empty("Ainda nao se candidatou a nenhuma vaga.")}
        </div>
      </div>
    `;
  }

  function renderCompanyApplications(applications) {
    return `
      <div class="panel">
        <div class="panel-header"><h2>Candidaturas recebidas</h2></div>
        <div class="list">
          ${applications.length ? applications.map(renderApplicationCard).join("") : empty("Sem candidaturas recebidas.")}
        </div>
      </div>
    `;
  }

  function renderJobCard(job, options = {}) {
    const applications = state.data?.jobApplications || [];
    const existingApplication = applications.find((application) => application.jobOfferId === job.id);
    const publicMode = options.publicMode;
    const positionLabel = job.position || job.title;
    const companyInitial = cleanDisplayValue(job.companyName || "Empresa").slice(0, 1).toUpperCase() || "E";
    return `
      <article class="job-card">
        <header>
          <div class="job-title-row">
            <span class="company-avatar">${escapeHtml(companyInitial)}</span>
            <div>
              <h3>${escapeHtml(job.title)}</h3>
              <div class="meta-row">
                ${positionLabel ? `<span class="chip job-position">${escapeHtml(positionLabel)}</span>` : ""}
                <span>${escapeHtml(job.companyName || "Empresa")}</span>
                <span>${escapeHtml(job.location)}</span>
                <span>${formatDate(job.createdAt)}</span>
              </div>
            </div>
          </div>
          <span class="chip ${job.status === "open" ? "approved" : "rejected"}">${job.status === "open" ? "Aberta" : "Fechada"}</span>
        </header>
        <div class="meta-row">
          ${job.contractType ? `<span>${escapeHtml(job.contractType)}</span>` : ""}
          ${job.salary ? `<span>${escapeHtml(job.salary)}</span>` : ""}
          ${job.schedule ? `<span>${escapeHtml(job.schedule)}</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(job.description)}</p>
        ${job.requirements ? `<p><strong>Requisitos:</strong> ${escapeHtml(job.requirements)}</p>` : ""}
        ${publicMode ? `
          <div class="card-actions">
            <button class="btn accent" data-public-apply="${escapeHtml(job.id)}">Candidatar-me</button>
            <button class="btn ghost" data-auth-preset="login">Entrar</button>
          </div>
        ` : isWorker() ? `
          ${existingApplication ? `<div class="notice success">Candidatura enviada: ${escapeHtml(applicationStatusLabel(existingApplication.status))}</div>` : `
            <form class="form-grid" data-form="apply-job" data-job-id="${escapeHtml(job.id)}">
              <div class="field">
                <label>Mensagem para a empresa</label>
                <textarea name="message" placeholder="Explique experiencia, disponibilidade e contacto preferido"></textarea>
              </div>
              <button class="btn accent" type="submit">Candidatar-me</button>
            </form>
          `}
        ` : isManager() ? `
          <div class="card-actions">
            <button class="btn ghost" data-toggle-job="${escapeHtml(job.id)}" data-job-status="${job.status === "open" ? "closed" : "open"}">${job.status === "open" ? "Fechar vaga" : "Reabrir vaga"}</button>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderApplicationCard(application) {
    const job = (state.data?.jobOffers || []).find((item) => item.id === application.jobOfferId);
    return `
      <article class="history-card">
        <strong>${escapeHtml(job?.title || "Vaga")} - ${escapeHtml(applicationStatusLabel(application.status))}</strong>
        <p>${escapeHtml(application.workerName || "Worker")} - ${formatDate(application.createdAt)}</p>
        ${application.message ? `<p>${escapeHtml(application.message)}</p>` : ""}
        ${application.decisionReason ? `<p>Decisao: ${escapeHtml(application.decisionReason)}</p>` : ""}
        ${isManager() ? `
          <form class="form-grid" data-form="update-application" data-application-id="${escapeHtml(application.id)}">
            <div class="field">
              <label>Estado</label>
              <select name="status">
                ${["submitted", "reviewed", "accepted", "rejected"].map((status) => `<option value="${status}" ${application.status === status ? "selected" : ""}>${applicationStatusLabel(status)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Nota de decisao</label><textarea name="decisionReason">${escapeHtml(application.decisionReason || "")}</textarea></div>
            <button class="btn ghost" type="submit">Atualizar candidatura</button>
          </form>
        ` : ""}
      </article>
    `;
  }

  function applicationStatusLabel(status) {
    const labels = {
      submitted: "Submetida",
      reviewed: "Em analise",
      accepted: "Aceite",
      rejected: "Rejeitada"
    };
    return labels[status] || status;
  }

  function renderDashboard() {
    const counts = getCounts();
    const nextTasks = [...state.data.tasks]
      .filter((task) => !["approved", "rejected"].includes(task.status))
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 6);
    const pending = state.data.tasks.filter((task) => task.status === "pending_validation").slice(0, 5);

    return `
      <section class="view-heading">
        <div>
          <h1>Painel operacional</h1>
          <p>Estado geral das ordens, tarefas atribuidas, provas submetidas e validacoes pendentes.</p>
        </div>
        ${isManager() ? `<button class="btn primary" data-view="orders">Nova ordem</button>` : ""}
      </section>
      <section class="metrics-grid">
        <article class="metric-card"><span>Tarefas</span><strong>${counts.total}</strong><p>Total acessivel</p></article>
        <article class="metric-card"><span>Ativas</span><strong>${counts.active}</strong><p>Atribuidas ou em curso</p></article>
        <article class="metric-card"><span>Validacao</span><strong>${counts.pending}</strong><p>Aguardam gestor</p></article>
        <article class="metric-card"><span>Bloqueios</span><strong>${counts.blocked}</strong><p>Precisam de decisao</p></article>
      </section>
      <section class="section-grid">
        <div class="panel">
          <div class="panel-header">
            <h2>Proximas tarefas</h2>
            <button class="btn ghost" data-view="tasks">Ver todas</button>
          </div>
          <div class="list">
            ${nextTasks.length ? nextTasks.map(renderTaskCard).join("") : empty("Sem tarefas ativas.")}
          </div>
        </div>
        <div>
          <div class="panel">
            <div class="panel-header"><h2>A aguardar validacao</h2></div>
            <div class="list">
              ${pending.length ? pending.map(renderCompactTask).join("") : empty("Nao ha tarefas pendentes.")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Ultimos eventos</h2></div>
            <div class="list">
              ${state.data.auditLogs.slice(0, 6).map(renderHistoryCard).join("") || empty("Sem historico.")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderOrders() {
    return `
      <section class="view-heading">
        <div>
          <h1>Ordens de trabalho</h1>
          <p>Crie servicos com morada, descricao e fotografias iniciais. Depois atribua tarefas a responsaveis.</p>
        </div>
      </section>
      <section class="section-grid">
        <div class="panel">
          <div class="panel-header"><h2>Ordens acessiveis</h2></div>
          <div class="list">
            ${state.data.workOrders.length ? state.data.workOrders.map(renderOrderCard).join("") : empty("Ainda nao existem ordens.")}
          </div>
        </div>
        <div>
          ${isManager() ? renderOrderForm() : renderWorkerHint()}
        </div>
      </section>
    `;
  }

  function renderOrderForm() {
    return `
      <form class="panel form-grid" data-form="create-order">
        <div class="panel-header"><h2>Nova ordem</h2></div>
        <div class="field">
          <label>Titulo</label>
          <input name="title" required placeholder="Ex: Tratamento jardim Braga">
        </div>
        <div class="field">
          <label>Morada ou localizacao textual</label>
          <input name="address" required placeholder="Rua, freguesia, referencia">
        </div>
        <div class="field">
          <label>Descricao</label>
          <textarea name="description" placeholder="Contexto, materiais, notas de entrada"></textarea>
        </div>
        <div class="field">
          <label>Fotografias iniciais opcionais</label>
          <input name="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple>
        </div>
        <button class="btn primary full" type="submit">Criar ordem</button>
      </form>
    `;
  }

  function renderWorkerHint() {
    return `
      <div class="panel">
        <h2>Acesso limitado</h2>
        <p class="muted">Este perfil consulta ordens apenas quando tem tarefas atribuidas nessa ordem.</p>
      </div>
    `;
  }

  function renderOrderCard(order) {
    const tasks = state.data.tasks.filter((task) => task.workOrderId === order.id);
    const photos = orderEvidence(order.id);
    return `
      <article class="order-card">
        <header>
          <div>
            <h3>${escapeHtml(order.title)}</h3>
            <div class="meta-row">
              <span>${escapeHtml(order.address)}</span>
              <span>${formatDate(order.createdAt)}</span>
            </div>
          </div>
          <span class="chip">${tasks.length} tarefas</span>
        </header>
        ${order.description ? `<p class="muted">${escapeHtml(order.description)}</p>` : ""}
        ${photos.length ? `<div class="evidence-grid">${photos.map(renderEvidenceCard).join("")}</div>` : ""}
        <div class="card-actions">
          <button class="btn ghost" data-view="tasks" data-filter-order="${escapeHtml(order.id)}">Ver tarefas</button>
        </div>
      </article>
    `;
  }

  function renderTasks() {
    const tasks = filteredTasks();
    return `
      <section class="view-heading">
        <div>
          <h1>Tarefas</h1>
          <p>Atualize estados, submeta provas, justifique bloqueios e acompanhe decisoes.</p>
        </div>
      </section>
      <section class="section-grid">
        <div class="panel">
          <div class="filter-row">
            <input data-filter="query" value="${escapeHtml(state.filters.query)}" placeholder="Pesquisar tarefa, ordem, morada">
            <select data-filter="status">
              ${["all", ...Object.keys(defaultStatusLabels)]
                .map((status) => `<option value="${status}" ${state.filters.status === status ? "selected" : ""}>${status === "all" ? "Todos os estados" : statusLabel(status)}</option>`)
                .join("")}
            </select>
            <select data-filter="assignee">
              <option value="all">Todos os responsaveis</option>
              ${state.data.users
                .filter((user) => ["employee", "contractor"].includes(user.role))
                .map((user) => `<option value="${user.id}" ${state.filters.assignee === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="list">
            ${tasks.length ? tasks.map(renderTaskCard).join("") : empty("Nenhuma tarefa corresponde aos filtros.")}
          </div>
        </div>
        <div>
          ${isManager() ? renderTaskForm() : renderEvidenceSummary()}
        </div>
      </section>
    `;
  }

  function filteredTasks() {
    const query = state.filters.query.trim().toLowerCase();
    return state.data.tasks.filter((task) => {
      const order = orderById(task.workOrderId);
      const haystack = [task.title, task.description, task.assigneeName, order?.title, order?.address]
        .join(" ")
        .toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (state.filters.status !== "all" && task.status !== state.filters.status) return false;
      if (state.filters.assignee !== "all" && task.assigneeId !== state.filters.assignee) return false;
      return true;
    });
  }

  function renderTaskForm() {
    const workerOptions = state.data.users.filter((user) => user.active && ["employee", "contractor"].includes(user.role));
    return `
      <form class="panel form-grid" data-form="create-task">
        <div class="panel-header"><h2>Nova tarefa</h2></div>
        <div class="field">
          <label>Ordem</label>
          <select name="workOrderId" required>
            <option value="">Escolher ordem</option>
            ${state.data.workOrders.map((order) => `<option value="${order.id}">${escapeHtml(order.title)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Titulo</label>
          <input name="title" required placeholder="Ex: Aplicar primeira camada">
        </div>
        <div class="field">
          <label>Responsavel</label>
          <select name="assigneeId" required>
            <option value="">Escolher responsavel</option>
            ${workerOptions.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} - ${escapeHtml(roleLabels[user.role])}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Prazo</label>
          <input name="dueDate" required type="date">
        </div>
        <div class="field">
          <label>Descricao</label>
          <textarea name="description" placeholder="Detalhe do trabalho esperado"></textarea>
        </div>
        <button class="btn primary full" type="submit" ${!state.data.workOrders.length || !workerOptions.length ? "disabled" : ""}>Criar tarefa</button>
        ${!state.data.workOrders.length ? `<p class="muted">Crie uma ordem antes de criar tarefas.</p>` : ""}
        ${!workerOptions.length ? `<p class="muted">Crie um funcionario ou prestador antes de atribuir tarefas.</p>` : ""}
      </form>
    `;
  }

  function renderEvidenceSummary() {
    const pending = state.data.tasks.filter((task) => task.status === "assigned" || task.status === "in_progress");
    return `
      <div class="panel">
        <h2>Fluxo do responsavel</h2>
        <p class="muted">Abra uma tarefa para iniciar, bloquear com justificacao, adicionar fotografias e concluir para validacao.</p>
        <p><strong>${pending.length}</strong> tarefas ainda precisam de execucao.</p>
      </div>
    `;
  }

  function renderTaskCard(task) {
    const order = orderById(task.workOrderId);
    const evidenceCount = taskEvidence(task.id).length;
    return `
      <article class="task-card">
        <header>
          <div>
            <h3>${escapeHtml(task.title)}</h3>
            <div class="meta-row">
              <span>${escapeHtml(order?.title || "Ordem removida")}</span>
              <span>${escapeHtml(task.assigneeName)}</span>
              <span>Prazo ${formatDate(task.dueDate)}</span>
            </div>
          </div>
          <span class="chip ${task.status}">${escapeHtml(statusLabel(task.status))}</span>
        </header>
        ${task.description ? `<p class="muted">${escapeHtml(task.description)}</p>` : ""}
        <div class="meta-row">
          <span>${evidenceCount} provas</span>
          ${task.blockReason ? `<span>Bloqueio: ${escapeHtml(task.blockReason)}</span>` : ""}
          ${task.validationComment ? `<span>Decisao: ${escapeHtml(task.validationComment)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn primary" data-open-task="${escapeHtml(task.id)}">Abrir</button>
        </div>
      </article>
    `;
  }

  function renderCompactTask(task) {
    return `
      <article class="task-card">
        <header>
          <div>
            <h3>${escapeHtml(task.title)}</h3>
            <div class="meta-row"><span>${escapeHtml(task.assigneeName)}</span><span>${formatDate(task.updatedAt)}</span></div>
          </div>
          <span class="chip ${task.status}">${escapeHtml(statusLabel(task.status))}</span>
        </header>
        <button class="btn ghost" data-open-task="${escapeHtml(task.id)}">Validar</button>
      </article>
    `;
  }

  function renderTeam() {
    if (!isManager()) return canUseOperations() ? renderDashboard() : renderMarketplace();
    return `
      <section class="view-heading">
        <div>
          <h1>Equipa e convites</h1>
          <p>Crie utilizadores ou gere convites associados a esta empresa e ao perfil definido.</p>
        </div>
      </section>
      <section class="section-grid">
        <div class="panel">
          <div class="panel-header"><h2>Utilizadores</h2></div>
          <div class="list">
            ${state.data.users.map(renderUserCard).join("")}
          </div>
        </div>
        <div>
          ${renderUserForm()}
          ${renderInviteForm()}
          ${renderInviteList()}
        </div>
      </section>
    `;
  }

  function renderUserCard(user) {
    return `
      <article class="user-card">
        <header>
          <div>
            <h3>${escapeHtml(user.name)}</h3>
            <div class="meta-row"><span>${escapeHtml(user.email)}</span><span>${escapeHtml(roleLabels[user.role] || user.role)}</span></div>
          </div>
          <span class="chip ${user.active ? "approved" : "rejected"}">${user.active ? "Ativo" : "Inativo"}</span>
        </header>
        <div class="card-actions">
          <select data-user-role="${escapeHtml(user.id)}" ${user.id === currentUser().id ? "disabled" : ""}>
            ${managedRoleOptions.map(([role, label]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <button class="btn ghost" data-toggle-user="${escapeHtml(user.id)}" ${user.id === currentUser().id ? "disabled" : ""}>
            ${user.active ? "Desativar" : "Ativar"}
          </button>
        </div>
      </article>
    `;
  }

  function renderUserForm() {
    return `
      <form class="panel form-grid" data-form="create-user">
        <div class="panel-header"><h2>Criar utilizador</h2></div>
        <div class="field"><label>Nome</label><input name="name" required></div>
        <div class="field"><label>Email</label><input name="email" type="email" required></div>
        <div class="field">
          <label>Perfil</label>
          <select name="role" required>
            ${managedRoleOptions.map(([role, label]) => `<option value="${role}">${label}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Password temporaria</label><input name="password" type="password" minlength="8" required></div>
        <button class="btn primary full" type="submit">Criar utilizador</button>
      </form>
    `;
  }

  function renderInviteForm() {
    return `
      <form class="panel form-grid" data-form="create-invite">
        <div class="panel-header"><h2>Gerar convite</h2></div>
        ${state.lastInviteLink ? `<div class="copy-box"><code>${escapeHtml(state.lastInviteLink)}</code><button class="btn ghost" type="button" data-copy="${escapeHtml(state.lastInviteLink)}">Copiar</button></div>` : ""}
        <div class="field"><label>Nome sugerido</label><input name="name"></div>
        <div class="field"><label>Email sugerido</label><input name="email" type="email"></div>
        <div class="field">
          <label>Perfil</label>
          <select name="role" required>
            ${managedRoleOptions.map(([role, label]) => `<option value="${role}">${label}</option>`).join("")}
          </select>
        </div>
        <button class="btn accent full" type="submit">Gerar link</button>
      </form>
    `;
  }

  function renderInviteList() {
    return `
      <div class="panel">
        <div class="panel-header"><h2>Convites recentes</h2></div>
        <div class="list">
          ${state.data.invites.length ? state.data.invites.slice(0, 8).map((invite) => `
            <article class="history-card">
              <strong>${escapeHtml(roleLabels[invite.role] || invite.role)} ${invite.usedAt ? "- usado" : "- pendente"}</strong>
              <p>${escapeHtml(invite.email || invite.name || "Sem destinatario")} - expira ${formatDate(invite.expiresAt)}</p>
            </article>
          `).join("") : empty("Sem convites.")}
        </div>
      </div>
    `;
  }

  function renderHistory() {
    return `
      <section class="view-heading">
        <div>
          <h1>Historico</h1>
          <p>Registo basico das principais acoes, estados, provas e decisoes.</p>
        </div>
        ${isManager() ? `<a class="btn ghost" href="/api/export/basic" target="_blank" rel="noreferrer">Exportar JSON</a>` : ""}
      </section>
      <section class="panel">
        <div class="list">
          ${state.data.auditLogs.length ? state.data.auditLogs.map(renderHistoryCard).join("") : empty("Sem eventos registados.")}
        </div>
      </section>
    `;
  }

  function renderHistoryCard(log) {
    return `
      <article class="history-card">
        <strong>${escapeHtml(actionLabel(log.action))}</strong>
        <p>${escapeHtml(log.actorName || "Sistema")} - ${formatDate(log.createdAt)}</p>
        ${log.detail && Object.keys(log.detail).length ? `<p>${escapeHtml(detailLabel(log.detail))}</p>` : ""}
      </article>
    `;
  }

  function actionLabel(action) {
    const labels = {
      "setup.completed": "Ambiente criado",
      "auth.login": "Entrada na aplicacao",
      "auth.google_login": "Entrada com Google",
      "worker.google_registered": "Worker registado com Google",
      "user.created": "Utilizador criado",
      "user.updated": "Utilizador atualizado",
      "invite.created": "Convite criado",
      "invite.accepted": "Convite aceite",
      "work_order.created": "Ordem criada",
      "task.created": "Tarefa criada",
      "task.status_changed": "Estado da tarefa alterado",
      "evidence.created": "Prova fotografica submetida",
      "task.approved": "Tarefa aprovada",
      "task.rejected": "Tarefa rejeitada"
    };
    return labels[action] || action;
  }

  function detailLabel(detail) {
    return Object.entries(detail)
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | ");
  }

  function renderTaskDrawer() {
    if (!state.selectedTaskId) return "";
    const task = taskById(state.selectedTaskId);
    if (!task) return "";
    const order = orderById(task.workOrderId);
    const evidence = taskEvidence(task.id);
    const logs = taskLogs(task.id);
    return `
      <div class="drawer-backdrop" data-close-drawer>
        <aside class="detail-panel" role="dialog" aria-modal="true" aria-label="Detalhe da tarefa" data-drawer-panel>
          <div class="detail-head">
            <div>
              <span class="chip ${task.status}">${escapeHtml(statusLabel(task.status))}</span>
              <h2>${escapeHtml(task.title)}</h2>
              <div class="meta-row">
                <span>${escapeHtml(order?.title || "Ordem removida")}</span>
                <span>${escapeHtml(task.assigneeName)}</span>
                <span>Prazo ${formatDate(task.dueDate)}</span>
              </div>
            </div>
            <button class="btn ghost" data-action="close-drawer">Fechar</button>
          </div>
          ${task.description ? `<p class="muted">${escapeHtml(task.description)}</p>` : ""}
          ${task.blockReason ? `<div class="notice error">Bloqueio: ${escapeHtml(task.blockReason)}</div>` : ""}
          ${task.validationComment ? `<div class="notice success">Decisao: ${escapeHtml(task.validationComment)}</div>` : ""}
          ${renderTaskActions(task)}
          <div class="panel">
            <div class="panel-header"><h2>Provas</h2><span class="chip">${evidence.length}</span></div>
            ${renderEvidenceForm(task)}
            <div class="evidence-grid" style="margin-top: 14px">
              ${evidence.length ? evidence.map(renderEvidenceCard).join("") : empty("Sem fotografias submetidas.")}
            </div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Historico da tarefa</h2></div>
            <div class="list">
              ${logs.length ? logs.map(renderHistoryCard).join("") : empty("Sem historico nesta tarefa.")}
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function renderTaskActions(task) {
    const canOperate = isManager() || task.assigneeId === currentUser().id;
    const canChange = canOperate && task.status !== "approved";
    return `
      <div class="panel">
        <div class="panel-header"><h2>Acoes</h2></div>
        <div class="card-actions">
          <button class="btn accent" data-task-status="${task.id}" data-next-status="in_progress" ${!canChange ? "disabled" : ""}>Iniciar</button>
          <button class="btn warn" data-action="show-block" ${!canChange ? "disabled" : ""}>Bloquear</button>
          <button class="btn primary" data-task-status="${task.id}" data-next-status="pending_validation" ${!canChange ? "disabled" : ""}>Concluir para validacao</button>
        </div>
        <form class="form-grid" data-form="block-task" data-task-id="${escapeHtml(task.id)}" style="display:none; margin-top: 12px">
          <div class="field">
            <label>Justificacao do bloqueio</label>
            <textarea name="blockReason" required placeholder="Ex: falta de material, acesso fechado, decisao pendente"></textarea>
          </div>
          <button class="btn warn" type="submit">Registar bloqueio</button>
        </form>
        ${isManager() && task.status === "pending_validation" ? `
          <form class="form-grid" data-form="decision" data-task-id="${escapeHtml(task.id)}" style="margin-top: 14px">
            <div class="split-fields">
              <button class="btn accent" name="decision" value="approved" type="submit">Aprovar</button>
              <button class="btn danger" name="decision" value="rejected" type="submit">Rejeitar</button>
            </div>
            <div class="field">
              <label>Fundamentacao</label>
              <textarea name="reason" placeholder="Obrigatoria se rejeitar"></textarea>
            </div>
          </form>
        ` : ""}
      </div>
    `;
  }

  function renderEvidenceForm(task) {
    const canAdd = (isManager() || task.assigneeId === currentUser().id) && task.status !== "approved";
    if (!canAdd) return `<p class="muted">Esta tarefa ja nao aceita novas provas.</p>`;
    return `
      <form class="form-grid" data-form="evidence" data-task-id="${escapeHtml(task.id)}">
        <div class="field">
          <label>Fotografia</label>
          <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required>
        </div>
        <div class="field">
          <label>Observacao</label>
          <textarea name="note" placeholder="Nota curta sobre a prova"></textarea>
        </div>
        <div class="card-actions">
          <button class="btn ghost" type="button" data-action="capture-location">Pedir localizacao pontual</button>
          <span class="chip" id="location-status">${locationLabel(state.locationDraft)}</span>
        </div>
        <button class="btn primary" type="submit">Submeter prova</button>
      </form>
    `;
  }

  function locationLabel(location) {
    if (!location || location.status === "not_requested") return "Localizacao nao pedida";
    if (location.status === "granted") return "Localizacao autorizada";
    if (location.status === "denied") return "Localizacao recusada";
    return "Localizacao indisponivel";
  }

  function renderEvidenceCard(evidence) {
    return `
      <article class="evidence-card">
        <img src="${escapeHtml(evidence.fileUrl)}" alt="Prova fotografica" loading="lazy">
        <div>
          <strong>${escapeHtml(evidence.userName || "Utilizador")}</strong><br>
          <span>${formatDate(evidence.createdAt)}</span><br>
          <span>${escapeHtml(locationLabel(evidence.location))}</span>
          ${evidence.note ? `<p>${escapeHtml(evidence.note)}</p>` : ""}
        </div>
      </article>
    `;
  }

  function empty(message) {
    return `<div class="empty"><span>${escapeHtml(message)}</span></div>`;
  }

  function bindAppEvents() {
    bindMarketFilters(renderApp);

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", async () => {
        state.view = button.dataset.view;
        if (button.dataset.filterOrder) {
          state.filters.query = orderById(button.dataset.filterOrder)?.title || "";
        }
        clearNotice();
        if (state.view === "project" && canViewPrivateProject() && !state.privateProjectHtml) {
          renderApp();
          try {
            await refreshPrivateProject();
          } catch (error) {
            setNotice(error.message, "error");
          }
        }
        if (state.view === "mvp" && canViewPrivateProject()) {
          state.privateMvpHtml = "";
          renderApp();
          try {
            await refreshPrivateMvp();
          } catch (error) {
            setNotice(error.message, "error");
          }
        }
        renderApp();
      });
    });

    document.querySelectorAll("[data-action='logout']").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await api("/api/auth/logout", { method: "POST" });
        } catch {}
        localStorage.removeItem(tokenKey);
        state.token = "";
        state.data = null;
        state.privateProjectHtml = "";
        state.privateMvpHtml = "";
        state.selectedTaskId = null;
        state.authMode = "login";
        await refreshPublicJobs();
        setNotice("Sessao terminada.");
        renderPublicBoard();
      });
    });

    document.querySelectorAll("[data-open-task]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedTaskId = button.dataset.openTask;
        state.locationDraft = { status: "not_requested" };
        renderApp();
      });
    });

    document.querySelectorAll("[data-close-drawer], [data-action='close-drawer']").forEach((element) => {
      element.addEventListener("click", (event) => {
        if (event.target.dataset.drawerPanel !== undefined) return;
        state.selectedTaskId = null;
        renderApp();
      });
    });

    const drawer = document.querySelector("[data-drawer-panel]");
    if (drawer) {
      drawer.addEventListener("click", (event) => event.stopPropagation());
    }

    document.querySelectorAll("[data-filter]").forEach((control) => {
      control.addEventListener("input", () => {
        state.filters[control.dataset.filter] = control.value;
        renderApp();
      });
      control.addEventListener("change", () => {
        state.filters[control.dataset.filter] = control.value;
        renderApp();
      });
    });

    document.querySelectorAll("[data-task-status]").forEach((button) => {
      button.addEventListener("click", () => updateTaskStatus(button.dataset.taskStatus, button.dataset.nextStatus));
    });

    document.querySelectorAll("[data-action='show-block']").forEach((button) => {
      button.addEventListener("click", () => {
        const form = document.querySelector("[data-form='block-task']");
        if (form) form.style.display = form.style.display === "none" ? "grid" : "none";
      });
    });

    document.querySelectorAll("[data-action='capture-location']").forEach((button) => {
      button.addEventListener("click", captureLocation);
    });

    document.querySelectorAll("[data-toggle-user]").forEach((button) => {
      button.addEventListener("click", () => toggleUser(button.dataset.toggleUser));
    });

    document.querySelectorAll("[data-user-role]").forEach((select) => {
      select.addEventListener("change", () => updateUserRole(select.dataset.userRole, select.value));
    });

    document.querySelectorAll("[data-toggle-job]").forEach((button) => {
      button.addEventListener("click", () => updateJobStatus(button.dataset.toggleJob, button.dataset.jobStatus));
    });

    document.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(button.dataset.copy);
        setNotice("Link copiado.");
        renderApp();
      });
    });

    bindForms();
  }

  function bindForms() {
    document.querySelectorAll("form[data-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNotice();
        try {
          const type = form.dataset.form;
          if (type === "create-order") await createOrder(form);
          if (type === "create-task") await createTask(form);
          if (type === "create-user") await createUser(form);
          if (type === "create-invite") await createInvite(form);
          if (type === "create-job") await createJob(form);
          if (type === "apply-job") await applyToJob(form);
          if (type === "update-application") await updateApplication(form);
          if (type === "evidence") await submitEvidence(form);
          if (type === "block-task") await blockTask(form);
          if (type === "decision") await decideTask(event, form);
          renderApp();
        } catch (error) {
          setNotice(error.message, "error");
          renderApp();
        }
      });
    });
  }

  async function createOrder(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const input = form.querySelector("input[type='file']");
    const photos = await filesToPhotos(input.files, 4);
    const payload = await api("/api/work-orders", {
      method: "POST",
      body: { ...data, photos }
    });
    state.data = payload.bootstrap;
    state.view = "orders";
    setNotice("Ordem criada.");
  }

  async function createTask(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api("/api/tasks", { method: "POST", body: data });
    state.data = payload.bootstrap;
    state.view = "tasks";
    setNotice("Tarefa criada e atribuida.");
  }

  async function createUser(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api("/api/users", { method: "POST", body: data });
    state.data = payload.bootstrap;
    setNotice("Utilizador criado.");
  }

  async function createInvite(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api("/api/invites", { method: "POST", body: data });
    state.data = payload.bootstrap;
    state.lastInviteLink = `${location.origin}/invite/${payload.token}`;
    setNotice("Convite gerado.");
  }

  async function createJob(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api("/api/job-offers", { method: "POST", body: data });
    state.data = payload.bootstrap;
    state.view = "marketplace";
    setNotice("Vaga publicada.");
  }

  async function applyToJob(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api(`/api/job-offers/${form.dataset.jobId}/apply`, {
      method: "POST",
      body: data
    });
    state.data = payload.bootstrap;
    setNotice("Candidatura submetida.");
  }

  async function updateApplication(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api(`/api/applications/${form.dataset.applicationId}`, {
      method: "PATCH",
      body: data
    });
    state.data = payload.bootstrap;
    setNotice("Candidatura atualizada.");
  }

  async function updateJobStatus(jobId, status) {
    try {
      const payload = await api(`/api/job-offers/${jobId}`, {
        method: "PATCH",
        body: { status }
      });
      state.data = payload.bootstrap;
      setNotice(status === "closed" ? "Vaga fechada." : "Vaga reaberta.");
      renderApp();
    } catch (error) {
      setNotice(error.message, "error");
      renderApp();
    }
  }

  async function submitEvidence(form) {
    const input = form.querySelector("input[type='file']");
    const [photo] = await filesToPhotos(input.files, 1);
    if (!photo) throw new Error("Escolha uma fotografia.");
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api(`/api/tasks/${form.dataset.taskId}/evidence`, {
      method: "POST",
      body: {
        photo,
        note: data.note,
        location: state.locationDraft || { status: "not_requested" }
      }
    });
    state.data = payload.bootstrap;
    state.locationDraft = { status: "not_requested" };
    setNotice("Prova submetida.");
  }

  async function blockTask(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    await updateTaskStatus(form.dataset.taskId, "blocked", { blockReason: data.blockReason });
  }

  async function decideTask(event, form) {
    const submitter = event.submitter;
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = await api(`/api/tasks/${form.dataset.taskId}/decision`, {
      method: "POST",
      body: {
        decision: submitter.value,
        reason: data.reason
      }
    });
    state.data = payload.bootstrap;
    setNotice(submitter.value === "approved" ? "Tarefa aprovada." : "Tarefa rejeitada.");
  }

  async function updateTaskStatus(taskId, status, extra = {}) {
    try {
      const payload = await api(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        body: { status, ...extra }
      });
      state.data = payload.bootstrap;
      setNotice("Estado atualizado.");
      renderApp();
    } catch (error) {
      setNotice(error.message, "error");
      renderApp();
    }
  }

  async function toggleUser(userId) {
    const user = userById(userId);
    if (!user) return;
    try {
      const payload = await api(`/api/users/${userId}`, {
        method: "PATCH",
        body: { active: !user.active }
      });
      state.data = payload.bootstrap;
      setNotice("Utilizador atualizado.");
      renderApp();
    } catch (error) {
      setNotice(error.message, "error");
      renderApp();
    }
  }

  async function updateUserRole(userId, role) {
    try {
      const payload = await api(`/api/users/${userId}`, {
        method: "PATCH",
        body: { role }
      });
      state.data = payload.bootstrap;
      setNotice("Perfil atualizado.");
      renderApp();
    } catch (error) {
      setNotice(error.message, "error");
      renderApp();
    }
  }

  async function filesToPhotos(fileList, max) {
    const files = Array.from(fileList || []).slice(0, max);
    return Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
            reader.onerror = () => reject(new Error("Nao foi possivel ler a fotografia."));
            reader.readAsDataURL(file);
          })
      )
    );
  }

  function captureLocation() {
    const status = document.getElementById("location-status");
    if (!navigator.geolocation) {
      state.locationDraft = { status: "unavailable" };
      if (status) status.textContent = locationLabel(state.locationDraft);
      return;
    }
    if (status) status.textContent = "A pedir autorizacao...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.locationDraft = {
          status: "granted",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        if (status) status.textContent = locationLabel(state.locationDraft);
      },
      () => {
        state.locationDraft = { status: "denied" };
        if (status) status.textContent = locationLabel(state.locationDraft);
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 0 }
    );
  }

  async function init() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => registration.update().catch(() => {}))
        .catch(() => {});
    }

    const googleSessionStarted = consumeAuthQuery();
    const invitePath = location.pathname.match(/^\/invite\/([^/]+)$/);
    if (invitePath) {
      state.initialized = true;
      await renderInvite(decodeURIComponent(invitePath[1]));
      return;
    }

    try {
      await refreshPublicJobs();
      if (state.token || googleSessionStarted) {
        try {
          await refreshData();
          state.view = defaultViewForUser();
          if (["project", "mvp"].includes(state.view)) {
            try {
              await refreshActivePrivateView();
            } catch (error) {
              setNotice(error.message, "error");
            }
          }
          renderApp();
          return;
        } catch (error) {
          localStorage.removeItem(tokenKey);
          state.token = "";
          if (googleSessionStarted) {
            setNotice(error.message, "error");
          }
        }
      }
      renderPublicBoard();
    } catch (error) {
      app.innerHTML = `
        <div class="boot-card">
          <div class="notice error">${escapeHtml(error.message)}</div>
          <button class="btn primary" onclick="location.reload()">Recarregar</button>
        </div>
      `;
    }
  }

  init();
})();
