(function () {
  const app = document.getElementById("app");
  const tokenKey = "meo_session_token";

  const state = {
    token: localStorage.getItem(tokenKey) || "",
    initialized: false,
    view: "marketplace",
    authMode: "login",
    data: null,
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
    company: "Empresa"
  };

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

  const productVersion = {
    name: "MANIFESTO",
    version: "v0.4.0",
    stage: "Fase 1 - MVP em desenvolvimento",
    lastUpdated: "2026-08-11",
    completionLabel: "Progresso formal por validar",
    completionNote:
      "A percentagem contratual deve ser aprovada com o cliente. Esta vista mostra progresso por etapas e evidencias tecnicas."
  };

  const publicNavItems = [
    ["Area do Cliente", "/cliente"]
  ];

  const projectPhases = [
    {
      title: "Levantamento de requisitos",
      status: "completed",
      note: "Documentos de base e requisitos Phase 1 identificados."
    },
    {
      title: "Arquitetura do sistema",
      status: "completed",
      note: "Frontend estatico, API Node, persistencia local/Supabase."
    },
    {
      title: "Desenvolvimento do MVP",
      status: "in-development",
      note: "Mercado publico, contas, tarefas, evidencias e auditoria implementados em iteracao."
    },
    {
      title: "Testes tecnicos",
      status: "in-development",
      note: "Syntax check e smoke test automatizado existem; testes de cliente ainda pendentes."
    },
    {
      title: "Validacao pelo cliente",
      status: "pending",
      note: "Pendente de revisao formal, feedback e criterios de aceitacao."
    },
    {
      title: "Producao",
      status: "pending",
      note: "Dependente de Supabase final, variaveis Vercel e validacao."
    }
  ];

  const roadmapSteps = [
    ["01", "Discovery", "completed", "Recolha documental e definicao do produto inicial."],
    ["02", "Arquitetura", "completed", "Modelo tecnico e separacao frontend/API/persistencia."],
    ["03", "MVP", "current", "Portal, mercado, operacoes, evidencias e auditabilidade."],
    ["04", "Testes", "pending", "Regressao UI, validacao cliente e verificacao Supabase."],
    ["05", "Validacao", "pending", "Aprovacao de escopo, criterios e entregaveis."],
    ["06", "Entrega", "pending", "Deploy final, documentacao operacional e handoff."]
  ];

  const mvpScope = {
    included: [
      "Area do Cliente publica para acesso, com estado do projeto, roadmap, modulos e documentacao apenas no workspace privado.",
      "Mercado de vagas publico com filtros por pesquisa, cargo, localizacao e raio.",
      "Registo de worker para candidatura e registo de empresa para publicacao de vagas.",
      "Area autenticada com ordens de trabalho, tarefas, evidencias fotograficas e validacao.",
      "Historico/auditoria basica das acoes principais.",
      "Persistencia local para desenvolvimento e Supabase para ambiente real."
    ],
    excluded: [
      "Aplicacoes nativas Android/iOS.",
      "Sincronizacao offline avancada e notificacoes push nativas.",
      "Analise automatica de imagens por IA.",
      "Pagamentos, faturacao, salarios, contabilidade ou seguros.",
      "Integracoes externas e automatizacoes avancadas.",
      "Aprovacoes legais, fiscais, laborais ou GDPR completas.",
      "Conteudo detalhado dos manuais sem mapeamento formal aprovado."
    ]
  };

  const platformComparison = [
    {
      title: "MANIFESTO MVP",
      status: "Contratado / em desenvolvimento",
      items: [
        "Portal de acompanhamento do projeto.",
        "Mercado de vagas e candidaturas autenticadas.",
        "Operacoes com ordens, tarefas e evidencias.",
        "Auditoria basica e documentacao tecnica."
      ]
    },
    {
      title: "Evolucao da Plataforma",
      status: "Possibilidades futuras",
      items: [
        "Analytics avancado e relatorios executivos.",
        "Automacao de workflows e permissoes granulares.",
        "Base de requisitos ligada a Supabase.",
        "Ferramentas assistidas por IA e dashboards adicionais.",
        "Integracoes externas quando forem formalmente aprovadas."
      ]
    }
  ];

  const modules = [
    {
      id: "portal",
      title: "Portal de Projeto",
      status: "in-development",
      progress: "Fundacao implementada",
      description: "Apresenta estado, roadmap, escopo, entregas, versoes e acesso preparado para cliente.",
      requirements: ["REQ-PORTAL-001", "REQ-DOC-001"],
      detail: "#projeto"
    },
    {
      id: "marketplace",
      title: "Mercado de Vagas",
      status: "testing",
      progress: "Fluxo API coberto por smoke test",
      description: "Vagas publicas, filtros, contas worker/empresa, candidaturas e revisao pela empresa.",
      requirements: ["REQ-MKT-001", "REQ-MKT-002", "REQ-MKT-003"],
      detail: "#mercado"
    },
    {
      id: "operations",
      title: "Operacoes e Tarefas",
      status: "testing",
      progress: "MVP funcional",
      description: "Ordens de trabalho, atribuicao de tarefas, estados operacionais e bloqueios com justificacao.",
      requirements: ["REQ-OPS-001", "REQ-OPS-002"],
      detail: "/cliente"
    },
    {
      id: "evidence",
      title: "Evidencia e Validacao",
      status: "testing",
      progress: "Privacidade de ficheiros validada em smoke test",
      description: "Fotografias privadas, notas, timestamp, localizacao pontual e decisao do gestor.",
      requirements: ["REQ-EVD-001", "REQ-EVD-002"],
      detail: "/cliente"
    },
    {
      id: "traceability",
      title: "Rastreabilidade de Requisitos",
      status: "planned",
      progress: "Estrutura UI criada",
      description: "Modelo Manual -> Requisito -> Funcionalidade -> Estado, pronto para base de dados futura.",
      requirements: ["REQ-TRACE-001"],
      detail: "#rastreabilidade"
    },
    {
      id: "documents",
      title: "Centro de Documentacao",
      status: "planned",
      progress: "Catalogo protegido preparado",
      description: "Organizacao de manuais, especificacao MVP, roadmap, criterios e changelog sem expor ficheiros privados.",
      requirements: ["REQ-DOC-001"],
      detail: "#documentacao"
    }
  ];

  const manualBlocks = [
    ["Bloco I", "Manual de Engenharia - Bloco I", "Base documental recebida; requisitos detalhados por mapear."],
    ["Bloco II", "Manual de Engenharia - Bloco II", "Base documental recebida; matriz tecnica preparada."],
    ["Bloco III", "Manual de Engenharia - Bloco III", "Base documental recebida; ligacao a modulos pendente."],
    ["Bloco IV", "Manual de Engenharia - Bloco IV", "Base documental recebida; validacao formal pendente."],
    ["Bloco V", "Manual de Engenharia - Bloco V", "Base documental recebida; criterios de software por aprovar."]
  ];

  const requirements = [
    {
      id: "REQ-MKT-001",
      source: "Contrato / correcao de conceito",
      name: "Vagas publicas",
      description: "O visitante consegue ver ofertas sem iniciar sessao.",
      module: "Mercado de Vagas",
      status: "implemented",
      validation: "Smoke test API"
    },
    {
      id: "REQ-MKT-002",
      source: "Contrato / correcao de conceito",
      name: "Candidatura autenticada",
      description: "A candidatura exige conta worker e impede duplicados por vaga.",
      module: "Mercado de Vagas",
      status: "implemented",
      validation: "Smoke test API"
    },
    {
      id: "REQ-MKT-003",
      source: "Contrato / correcao de conceito",
      name: "Publicacao por empresa",
      description: "Criar vagas exige conta empresa ou gestor autorizado.",
      module: "Mercado de Vagas",
      status: "implemented",
      validation: "Smoke test API"
    },
    {
      id: "REQ-OPS-001",
      source: "Anexo de fase 1",
      name: "Ordens e tarefas",
      description: "Gestor cria ordens e tarefas com responsavel e prazo.",
      module: "Operacoes e Tarefas",
      status: "implemented",
      validation: "Smoke test API"
    },
    {
      id: "REQ-EVD-001",
      source: "Anexo de fase 1",
      name: "Evidencia privada",
      description: "Fotografias sao privadas e servidas apenas por API autenticada.",
      module: "Evidencia e Validacao",
      status: "implemented",
      validation: "Smoke test API"
    },
    {
      id: "REQ-TRACE-001",
      source: "Manuais de Engenharia",
      name: "Rastreabilidade documental",
      description: "Manual, requisito, modulo e estado devem poder ser ligados futuramente.",
      module: "Rastreabilidade de Requisitos",
      status: "in-development",
      validation: "UI foundation"
    }
  ];

  const acceptanceCriteria = [
    {
      module: "Mercado de Vagas",
      status: "testing",
      checks: [
        ["Vagas abertas aparecem ao publico", "passed"],
        ["Worker autenticado consegue candidatar-se", "passed"],
        ["Empresa consegue publicar vaga", "passed"],
        ["Revisao de candidaturas pela empresa", "passed"],
        ["Validacao cliente", "not-tested"]
      ]
    },
    {
      module: "Operacoes e Evidencias",
      status: "testing",
      checks: [
        ["Gestor cria ordem de trabalho", "passed"],
        ["Gestor atribui tarefa", "passed"],
        ["Responsavel submete evidencia", "passed"],
        ["Imagem privada exige autenticacao", "passed"],
        ["Validacao em producao Supabase", "not-tested"]
      ]
    },
    {
      module: "Portal MANIFESTO",
      status: "testing",
      checks: [
        ["Informacao de escopo separa MVP e futuro", "testing"],
        ["Documentacao privada nao e ligada publicamente", "testing"],
        ["Cliente entende estado do projeto rapidamente", "not-tested"]
      ]
    }
  ];

  const deliverables = [
    {
      title: "Aplicacao web MVP",
      status: "completed",
      phase: "MVP",
      date: "2026-08-10",
      description: "Frontend, API Node, autenticacao, mercado, operacoes e evidencias."
    },
    {
      title: "Migrations Supabase",
      status: "completed",
      phase: "Base de dados",
      date: "2026-08-10",
      description: "Tabelas meo_*, RLS e bucket privado de evidencias."
    },
    {
      title: "Area do Cliente e workspace privado",
      status: "in-development",
      phase: "Acompanhamento",
      date: "2026-08-11",
      description: "Acesso publico controlado, com estado, roadmap, modulos, escopo e documentacao no workspace autenticado."
    },
    {
      title: "Validacao Supabase em producao",
      status: "pending",
      phase: "Producao",
      date: "Sem data formal",
      description: "Depende de reset SQL, variaveis Vercel e teste com dados reais."
    },
    {
      title: "Aprovacao formal do cliente",
      status: "pending",
      phase: "Validacao",
      date: "Sem data formal",
      description: "Criterios de aceitacao e feedback final por validar."
    }
  ];

  const versionHistory = [
    {
      version: "v0.4.0",
      date: "2026-08-11",
      added: ["Portal MANIFESTO", "Area do Cliente preparada", "Changelog privado"],
      improved: ["Arquitetura de dados UI", "Responsividade da area publica", "Documentacao de projeto"],
      fixed: ["Estado das vagas quando Supabase ainda nao esta preparado"]
    },
    {
      version: "v0.3.2",
      date: "2026-08-10",
      added: ["Adaptador Vercel", "Fallback publico para vagas"],
      improved: ["Deploy Node serverless"],
      fixed: ["Entrypoint de producao"]
    },
    {
      version: "v0.3.0",
      date: "2026-08-10",
      added: ["Mercado de vagas", "Registo worker/empresa", "Filtros por localizacao e raio"],
      improved: ["Modelo Supabase"],
      fixed: []
    }
  ];

  const documentGroups = [
    {
      title: "Engenharia",
      visibility: "Preparado para acesso protegido",
      items: ["Manual Bloco I", "Manual Bloco II", "Manual Bloco III", "Manual Bloco IV", "Manual Bloco V"]
    },
    {
      title: "Projeto",
      visibility: "Publico / operacional",
      items: ["Especificacao MVP", "Roadmap", "Arquitetura", "Acceptance Criteria", "Relatorio de Testes", "Changelog"]
    },
    {
      title: "Comercial / Legal",
      visibility: "Nao exposto publicamente",
      items: ["Contrato", "Proposta", "Entregaveis formais"]
    }
  ];

  const clientDashboardCards = [
    ["Progresso", "Estado por etapas e riscos pendentes."],
    ["Roadmap", "Fase atual, proxima fase e entrega."],
    ["Modulos", "O que existe, o que esta em teste e o que esta planeado."],
    ["Entregas", "Itens concluidos, em desenvolvimento e pendentes."],
    ["Documentos", "Centro preparado para acesso protegido."],
    ["Feedback", "Observacoes do cliente sem alterar escopo automaticamente."],
    ["Pedidos de alteracao", "Controlo formal de impacto em custo, prazo e escopo."],
    ["Testes", "Criterios mensuraveis e validacao por modulo."],
    ["Versoes", "Historico de alteracoes por versao."]
  ];

  const changeRequests = [];
  const feedbackItems = [];

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

  function canViewPrivateProject() {
    return ["manager", "company"].includes(currentUser()?.role);
  }

  function isWorker() {
    return currentUser()?.role === "worker";
  }

  function defaultViewForUser() {
    const role = currentUser()?.role;
    if (canViewPrivateProject()) return "project";
    if (role === "worker") return "marketplace";
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

  function statusDisplay(status) {
    const labels = {
      completed: "Concluido",
      "in-development": "Em desenvolvimento",
      current: "Fase atual",
      pending: "Pendente",
      planned: "Planeado",
      testing: "Em teste",
      implemented: "Implementado",
      passed: "Aprovado em teste",
      "not-tested": "Nao testado"
    };
    return labels[status] || status;
  }

  function renderStatusBadge(status) {
    return `<span class="status-badge ${escapeHtml(status)}">${escapeHtml(statusDisplay(status))}</span>`;
  }

  function renderPublicTopNav(activeRoute = "home") {
    return `
      <header class="public-topbar">
        <a class="public-brand" href="/">
          <span class="brand-mark">M</span>
          <div>
            <strong>MANIFESTO</strong>
            <span>Plataforma Digital de Engenharia</span>
          </div>
        </a>
        <button class="public-menu-button" type="button" data-action="toggle-public-menu" aria-expanded="${state.publicMenuOpen ? "true" : "false"}" aria-label="Abrir navegacao">
          <span></span><span></span><span></span>
        </button>
        <nav class="public-nav ${state.publicMenuOpen ? "open" : ""}" aria-label="Navegacao principal">
          ${publicNavItems
            .map(([label, href]) => `<a href="${href}" class="${activeRoute === "cliente" && href === "/cliente" ? "active" : ""}" data-close-public-menu>${escapeHtml(label)}</a>`)
            .join("")}
        </nav>
      </header>
    `;
  }

  function renderPublicShell(content, route = "home") {
    document.title = route === "cliente"
        ? "Area do Cliente - MANIFESTO"
        : "MANIFESTO - Plataforma Digital de Engenharia";
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
          <strong>MANIFESTO</strong>
          <span>Area publica de acesso</span>
        </div>
        <a href="/cliente">Area do cliente</a>
      </footer>
    `;
  }

  function renderManifestoHero() {
    return `
      <section class="manifesto-hero" id="manifesto">
        <div class="hero-copy">
          <p class="eyebrow">MANIFESTO</p>
          <h1>Plataforma Digital de Engenharia</h1>
          <p>Centraliza processos de engenharia, informacao de projeto, documentacao tecnica, fluxos operacionais e rastreabilidade de desenvolvimento num portal claro para cliente e equipa.</p>
          <div class="hero-actions">
            <a class="btn primary" href="#projeto">Ver Projeto</a>
            <a class="btn ghost" href="#roadmap">Acompanhar Desenvolvimento</a>
          </div>
          <div class="version-strip">
            <span>${escapeHtml(productVersion.stage)}</span>
            <strong>${escapeHtml(productVersion.version)}</strong>
            <span>Atualizado ${formatDate(productVersion.lastUpdated)}</span>
          </div>
        </div>
        <div class="engineering-panel" aria-label="Resumo tecnico do projeto">
          <div class="technical-grid">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
          <div class="system-stack">
            <div><span>Frontend</span><strong>Static JS</strong></div>
            <div><span>API</span><strong>Node</strong></div>
            <div><span>Dados</span><strong>Supabase-ready</strong></div>
            <div><span>Estado</span><strong>MVP</strong></div>
          </div>
        </div>
      </section>
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
    if (route === "cliente" || route === "home") {
      renderClientAreaPage();
      return;
    }
    if (route === "restricted") {
      renderRestrictedInfoPage();
      return;
    }
    renderClientAreaPage();
  }

  function renderProjectStatusSection() {
    const completed = projectPhases.filter((phase) => phase.status === "completed").length;
    const active = projectPhases.find((phase) => phase.status === "in-development");
    return `
      <section class="public-section" id="projeto">
        <div class="section-heading">
          <p class="eyebrow">Estado do Projeto</p>
          <h2>Controlo visivel da fase atual</h2>
          <p>${escapeHtml(productVersion.completionNote)}</p>
        </div>
        <div class="status-dashboard">
          <article class="status-summary">
            <span>Estado geral</span>
            <strong>${escapeHtml(productVersion.completionLabel)}</strong>
            <p>${completed} de ${projectPhases.length} etapas concluidas ou tecnicamente preparadas. Fase ativa: ${escapeHtml(active?.title || "por definir")}.</p>
          </article>
          <div class="phase-list">
            ${projectPhases.map(renderPhaseItem).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderPhaseItem(phase) {
    return `
      <article class="phase-item">
        <div>
          <strong>${escapeHtml(phase.title)}</strong>
          <p>${escapeHtml(phase.note)}</p>
        </div>
        ${renderStatusBadge(phase.status)}
      </article>
    `;
  }

  function renderRoadmapSection() {
    return `
      <section class="public-section alt" id="roadmap">
        <div class="section-heading">
          <p class="eyebrow">Roadmap</p>
          <h2>Da descoberta a entrega controlada</h2>
          <p>O roadmap separa trabalho concluido, fase atual e fases futuras sem apresentar funcionalidades especulativas como contratadas.</p>
        </div>
        <div class="roadmap">
          ${roadmapSteps.map(renderRoadmapStep).join("")}
        </div>
        <div class="next-phase">
          <span>Proxima fase</span>
          <strong>Validacao tecnica em Supabase e revisao do cliente</strong>
          <p>Depois da base publica e operacional, o foco passa para executar o reset SQL no projeto Supabase, confirmar variaveis Vercel e validar fluxos reais com criterios de aceitacao.</p>
        </div>
      </section>
    `;
  }

  function renderRoadmapStep([number, title, status, description]) {
    return `
      <article class="roadmap-step ${escapeHtml(status)}">
        <span>${escapeHtml(number)}</span>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
        ${renderStatusBadge(status)}
      </article>
    `;
  }

  function renderScopeSection() {
    return `
      <section class="public-section" id="ambito">
        <div class="section-heading">
          <p class="eyebrow">Ambito da Fase Atual</p>
          <h2>O MVP nao e a plataforma final</h2>
          <p>Esta separacao protege o contrato, reduz ambiguidade e evita scope creep durante a validacao.</p>
        </div>
        <div class="scope-grid">
          <article class="scope-panel included">
            <h3>Incluido nesta fase</h3>
            ${renderBulletList(mvpScope.included)}
          </article>
          <article class="scope-panel excluded">
            <h3>Fora do ambito desta fase</h3>
            ${renderBulletList(mvpScope.excluded)}
          </article>
        </div>
      </section>
    `;
  }

  function renderPlatformComparisonSection() {
    return `
      <section class="public-section split" id="evolucao">
        ${platformComparison.map((item) => `
          <article class="concept-panel">
            <span>${escapeHtml(item.status)}</span>
            <h2>${escapeHtml(item.title)}</h2>
            ${renderBulletList(item.items)}
          </article>
        `).join("")}
      </section>
    `;
  }

  function renderModulesSection() {
    return `
      <section class="public-section alt" id="modulos">
        <div class="section-heading">
          <p class="eyebrow">Modulos</p>
          <h2>Arquitetura funcional do MVP</h2>
          <p>Cada modulo tem estado, relacao a requisitos e caminho para detalhe. A estrutura esta pronta para migrar estes dados para Supabase.</p>
        </div>
        <div class="module-grid">
          ${modules.map(renderModuleCard).join("")}
        </div>
      </section>
    `;
  }

  function renderModuleCard(module) {
    return `
      <article class="module-card ${escapeHtml(module.status)}">
        <div class="module-card-head">
          <h3>${escapeHtml(module.title)}</h3>
          ${renderStatusBadge(module.status)}
        </div>
        <p>${escapeHtml(module.description)}</p>
        <div class="meta-row">
          <span>${escapeHtml(module.progress)}</span>
        </div>
        <div class="requirement-tags">
          ${module.requirements.map((requirement) => `<span>${escapeHtml(requirement)}</span>`).join("")}
        </div>
        <a class="text-link" href="${escapeHtml(module.detail)}">Ver detalhe</a>
      </article>
    `;
  }

  function renderTechnicalBaseSection() {
    return `
      <section class="public-section" id="base-tecnica">
        <div class="section-heading">
          <p class="eyebrow">Base Tecnica do Projeto</p>
          <h2>Manuais de Engenharia como fonte de rastreabilidade</h2>
          <p>Os ficheiros existem no repositorio, mas o conteudo detalhado nao e exposto publicamente. A matriz abaixo prepara a ligacao Manual -> Requisito -> Funcionalidade -> Estado.</p>
        </div>
        <div class="manual-grid">
          ${manualBlocks.map(renderManualCard).join("")}
        </div>
      </section>
    `;
  }

  function renderManualCard([block, title, note]) {
    return `
      <article class="manual-card">
        <span>${escapeHtml(block)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(note)}</p>
        <div class="trace-line">
          <span>Manual</span><span>Requirement</span><span>Modulo</span><span>Status</span>
        </div>
      </article>
    `;
  }

  function renderRequirementsSection() {
    return `
      <section class="public-section alt" id="rastreabilidade">
        <div class="section-heading">
          <p class="eyebrow">Requirement Traceability</p>
          <h2>Modelo reutilizavel de requisitos</h2>
          <p>IDs internos sao usados para estruturar o MVP atual. Requisitos detalhados dos manuais devem ser aprovados antes de preencher descricoes tecnicas finas.</p>
        </div>
        <div class="responsive-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Fonte</th>
                <th>Requisito</th>
                <th>Modulo</th>
                <th>Desenvolvimento</th>
                <th>Validacao</th>
              </tr>
            </thead>
            <tbody>
              ${requirements.map((requirement) => `
                <tr>
                  <td data-label="ID">${escapeHtml(requirement.id)}</td>
                  <td data-label="Fonte">${escapeHtml(requirement.source)}</td>
                  <td data-label="Requisito"><strong>${escapeHtml(requirement.name)}</strong><span>${escapeHtml(requirement.description)}</span></td>
                  <td data-label="Modulo">${escapeHtml(requirement.module)}</td>
                  <td data-label="Desenvolvimento">${renderStatusBadge(requirement.status)}</td>
                  <td data-label="Validacao">${escapeHtml(requirement.validation)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderAcceptanceSection() {
    return `
      <section class="public-section" id="criterios">
        <div class="section-heading">
          <p class="eyebrow">Acceptance Criteria</p>
          <h2>Conclusao medida por criterios, nao por impressao</h2>
          <p>Os criterios distinguem teste tecnico, teste em progresso e aceitacao formal pelo cliente.</p>
        </div>
        <div class="acceptance-grid">
          ${acceptanceCriteria.map(renderAcceptanceCard).join("")}
        </div>
      </section>
    `;
  }

  function renderAcceptanceCard(group) {
    return `
      <article class="acceptance-card">
        <div class="module-card-head">
          <h3>${escapeHtml(group.module)}</h3>
          ${renderStatusBadge(group.status)}
        </div>
        <div class="criteria-list">
          ${group.checks.map(([label, status]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              ${renderStatusBadge(status)}
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderDeliverablesSection() {
    return `
      <section class="public-section alt" id="entregas">
        <div class="section-heading">
          <p class="eyebrow">Entregas</p>
          <h2>O que existe, o que esta em curso e o que falta</h2>
        </div>
        <div class="deliverable-columns">
          ${["completed", "in-development", "pending"].map((status) => `
            <div>
              <h3>${escapeHtml(statusDisplay(status))}</h3>
              ${deliverables.filter((item) => item.status === status).map(renderDeliverableCard).join("") || empty("Sem itens nesta categoria.")}
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderDeliverableCard(deliverable) {
    return `
      <article class="deliverable-card">
        ${renderStatusBadge(deliverable.status)}
        <h4>${escapeHtml(deliverable.title)}</h4>
        <p>${escapeHtml(deliverable.description)}</p>
        <div class="meta-row"><span>${escapeHtml(deliverable.phase)}</span><span>${escapeHtml(deliverable.date)}</span></div>
      </article>
    `;
  }

  function renderDocumentationSection() {
    return `
      <section class="public-section" id="documentacao">
        <div class="section-heading">
          <p class="eyebrow">Documentation Center</p>
          <h2>Documentacao preparada sem expor ficheiros privados</h2>
          <p>O centro organiza os grupos certos agora e deixa areas privadas prontas para autenticacao/permissions.</p>
        </div>
        <div class="document-grid">
          ${documentGroups.map((group) => `
            <article class="document-card">
              <span>${escapeHtml(group.visibility)}</span>
              <h3>${escapeHtml(group.title)}</h3>
              ${renderBulletList(group.items)}
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderChangeRequestSection() {
    return `
      <section class="public-section split" id="alteracoes">
        <article class="concept-panel">
          <span>Scope control</span>
          <h2>Pedidos de Alteracao</h2>
          <p>Cada pedido devera registar prioridade, impacto de escopo, custo, prazo e decisao. Nenhum feedback informal altera automaticamente o MVP.</p>
          ${changeRequests.length ? changeRequests.map(renderChangeRequestCard).join("") : empty("Sem pedidos formais registados.")}
        </article>
        <article class="concept-panel">
          <span>Review loop</span>
          <h2>Feedback do Cliente</h2>
          <p>Observacoes do cliente ficam separadas de pedidos formais de alteracao para manter o processo controlado.</p>
          ${feedbackItems.length ? feedbackItems.map(renderFeedbackCard).join("") : empty("Sem feedback registado nesta estrutura.")}
        </article>
      </section>
    `;
  }

  function renderFeedbackSection() {
    return `
      <section class="public-section compact-section">
        <div class="section-heading">
          <p class="eyebrow">Estados futuros preparados</p>
          <h2>Loading, empty, error e success</h2>
          <p>As secoes dinamicas ja mostram estados vazios claros. Quando ligadas a base de dados, deverao manter loading, erro e sucesso por componente.</p>
        </div>
      </section>
    `;
  }

  function renderPublicJobsSection(options = {}) {
    const includeAuth = options.includeAuth !== false;
    const allJobs = state.publicJobs || [];
    const jobs = filterJobs(allJobs);
    return `
      <section class="public-section alt" id="mercado">
        <div class="public-grid manifesto-market ${includeAuth ? "" : "single"}">
          <div class="panel">
            <div class="public-heading">
              <p class="eyebrow">Mercado aberto</p>
              <h2>Vagas publicas</h2>
              <p>As oportunidades ficam visiveis para todos. Candidaturas exigem conta worker; publicacao exige conta empresa.</p>
            </div>
            ${renderMarketFilters("public", allJobs.length, jobs.length)}
            <div class="panel-header">
              <h3>Ofertas disponiveis</h3>
              <span class="chip">${jobs.length}/${allJobs.length}</span>
            </div>
            <div class="list">
              ${jobs.length ? jobs.map((job) => renderJobCard(job, { publicMode: true })).join("") : empty(activeMarketFilterCount() ? "Nenhuma vaga corresponde aos filtros escolhidos." : "Ainda nao existem vagas publicadas.")}
            </div>
          </div>
          ${includeAuth ? `<aside class="public-auth">${renderAuthSwitcher()}</aside>` : ""}
        </div>
      </section>
    `;
  }

  function renderClientCtaSection() {
    return `
      <section class="client-cta">
        <div>
          <span>Area do Cliente</span>
          <h2>Uma leitura executiva do projeto em menos de 10 segundos.</h2>
        </div>
        <a class="btn primary" href="/cliente">Abrir area do cliente</a>
      </section>
    `;
  }

  function renderClientAreaPage() {
    renderPublicShell(`
      ${noticeHtml()}
      ${state.publicJobsWarning ? `<div class="public-warning notice error">${escapeHtml(state.publicJobsWarning)}</div>` : ""}
      <section class="public-page-hero client-access-hero">
        <p class="eyebrow">Area do Cliente</p>
        <h1>Acesso ao workspace MANIFESTO</h1>
        <p>Esta area publica serve apenas para entrada, registo e descoberta de vagas. Estado do projeto, roadmap, requisitos, entregas, documentacao, feedback e changelog ficam reservados a cliente e equipa de desenvolvimento autenticados.</p>
      </section>
      <section class="public-section split client-access-grid">
        <article class="concept-panel">
          <span>Informacao privada</span>
          <h2>Conteudo de projeto bloqueado</h2>
          <p>O dashboard executivo, rastreabilidade, criterios, entregas e changelog aparecem apenas depois de iniciar sessao com uma conta autorizada de cliente ou desenvolvimento.</p>
        </article>
        <div>
          ${renderAuthSwitcher()}
        </div>
      </section>
      ${renderPublicJobsSection({ includeAuth: false })}
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
          <p>Roadmap, requisitos, entregas, changelog e documentacao ficam dentro do workspace autenticado.</p>
        </article>
        <div>
          ${renderAuthSwitcher()}
        </div>
      </section>
    `, "cliente");
  }

  function renderPrivateProjectView() {
    return `
      <div class="manifesto-shell private-project-shell">
        <section class="public-page-hero">
          <p class="eyebrow">Area privada</p>
          <h1>Dashboard MANIFESTO</h1>
          <p>Resumo executivo para cliente e equipa de desenvolvimento: estado do projeto, modulos, entregas, documentos, feedback, pedidos de alteracao, testes e versoes.</p>
        </section>
        <section class="public-section">
          <div class="client-dashboard-grid">
            ${clientDashboardCards.map(([title, description]) => `
              <article class="client-dashboard-card">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(description)}</p>
              </article>
            `).join("")}
          </div>
        </section>
        ${renderProjectStatusSection()}
        ${renderRoadmapSection()}
        ${renderScopeSection()}
        ${renderPlatformComparisonSection()}
        ${renderModulesSection()}
        ${renderTechnicalBaseSection()}
        ${renderRequirementsSection()}
        ${renderAcceptanceSection()}
        ${renderDeliverablesSection()}
        ${renderDocumentationSection()}
        ${renderChangeRequestSection()}
        ${renderFeedbackSection()}
        ${renderVersionHistorySection()}
      </div>
    `;
  }

  function renderVersionHistorySection() {
    return `
      <section class="public-section" id="changelog">
        <div class="section-heading">
          <p class="eyebrow">Versioning</p>
          <h2>Changelog MANIFESTO</h2>
          <p>Historico privado de alteracoes por versao. As entradas registam o que foi adicionado, melhorado e corrigido.</p>
        </div>
        <div class="changelog-list">
          ${versionHistory.map(renderChangelogEntry).join("")}
        </div>
      </section>
    `;
  }

  function renderChangelogEntry(entry) {
    return `
      <article class="changelog-entry">
        <header>
          <h2>${escapeHtml(entry.version)}</h2>
          <span>${formatDate(entry.date)}</span>
        </header>
        ${renderChangelogGroup("Added", entry.added)}
        ${renderChangelogGroup("Improved", entry.improved)}
        ${renderChangelogGroup("Fixed", entry.fixed)}
      </article>
    `;
  }

  function renderChangelogGroup(title, items) {
    if (!items.length) return "";
    return `
      <div class="changelog-group">
        <strong>${escapeHtml(title)}</strong>
        ${renderBulletList(items)}
      </div>
    `;
  }

  function renderBulletList(items) {
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderChangeRequestCard(request) {
    return `
      <article class="mini-record">
        <strong>${escapeHtml(request.title)}</strong>
        <p>${escapeHtml(request.description)}</p>
      </article>
    `;
  }

  function renderFeedbackCard(feedback) {
    return `
      <article class="mini-record">
        <strong>${escapeHtml(feedback.module)}</strong>
        <p>${escapeHtml(feedback.feedback)}</p>
      </article>
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

  function renderWorkerRegistrationForm() {
    return `
      <form class="form-grid" data-form="register-worker">
        <div>
          <h2>Registar worker</h2>
          <p class="muted">Conta individual para candidatar-se a vagas publicas.</p>
        </div>
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
        setNotice("Sessao iniciada.");
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
  }

  function bindMarketFilters(renderTarget) {
    document.querySelectorAll("[data-market-filter-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        form.querySelectorAll("[data-market-filter]").forEach((control) => {
          state.marketFilters[control.dataset.marketFilter] = control.value;
        });
        clearNotice();
        renderTarget();
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
            if (view === "team") return isManager();
            if (["orders", "tasks", "dashboard"].includes(view)) return currentUser()?.role !== "worker";
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
            if (view === "team") return isManager();
            if (["orders", "tasks", "dashboard"].includes(view)) return currentUser()?.role !== "worker";
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
    if (state.view === "marketplace") return renderMarketplace();
    if (state.view === "orders") return renderOrders();
    if (state.view === "tasks") return renderTasks();
    if (state.view === "team") return renderTeam();
    if (state.view === "history") return renderHistory();
    return renderDashboard();
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
          <p>${role === "worker" ? "Veja vagas abertas e acompanhe as suas candidaturas." : "Publique vagas, acompanhe candidaturas e mantenha as oportunidades visiveis no mercado."}</p>
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
          ${isManager() ? renderJobOfferForm() : renderWorkerApplications(applications)}
          ${isManager() ? renderCompanyApplications(applications) : ""}
        </div>
      </section>
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
    return `
      <article class="job-card">
        <header>
          <div>
            <h3>${escapeHtml(job.title)}</h3>
            <div class="meta-row">
              ${positionLabel ? `<span class="chip job-position">${escapeHtml(positionLabel)}</span>` : ""}
              <span>${escapeHtml(job.companyName || "Empresa")}</span>
              <span>${escapeHtml(job.location)}</span>
              <span>${formatDate(job.createdAt)}</span>
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
            <button class="btn accent" data-public-apply="${escapeHtml(job.id)}">Candidatar-me como worker</button>
            <button class="btn ghost" data-public-create-job>Publicar vaga</button>
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
                .filter((user) => user.role !== "manager")
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
    const workerOptions = state.data.users.filter((user) => user.active && user.role !== "manager");
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
    if (!isManager()) return renderDashboard();
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
            ${Object.entries(roleLabels).map(([role, label]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${label}</option>`).join("")}
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
            <option value="employee">Funcionario</option>
            <option value="contractor">Subempreiteiro</option>
            <option value="manager">Gestor</option>
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
            <option value="employee">Funcionario</option>
            <option value="contractor">Subempreiteiro</option>
            <option value="manager">Gestor</option>
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
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        if (button.dataset.filterOrder) {
          state.filters.query = orderById(button.dataset.filterOrder)?.title || "";
        }
        clearNotice();
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
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }

    const invitePath = location.pathname.match(/^\/invite\/([^/]+)$/);
    if (invitePath) {
      state.initialized = true;
      await renderInvite(decodeURIComponent(invitePath[1]));
      return;
    }

    try {
      await refreshPublicJobs();
      if (state.token) {
        try {
          await refreshData();
          state.view = defaultViewForUser();
          renderApp();
          return;
        } catch {
          localStorage.removeItem(tokenKey);
          state.token = "";
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
