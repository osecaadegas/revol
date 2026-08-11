function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: String(value).length > 10 ? "2-digit" : undefined,
    minute: String(value).length > 10 ? "2-digit" : undefined
  }).format(date);
}

function empty(message) {
  return `<div class="empty"><span>${escapeHtml(message)}</span></div>`;
}

function statusLabel(data, status) {
  const labels = data.statusLabels || {};
  return labels[status] || status;
}

function getMvpSnapshot(data) {
  const users = data.users || [];
  const jobs = data.jobOffers || [];
  const applications = data.jobApplications || [];
  const workOrders = data.workOrders || [];
  const tasks = data.tasks || [];
  const evidences = data.evidences || [];
  const auditLogs = data.auditLogs || [];
  const pendingValidation = tasks.filter((task) => task.status === "pending_validation");
  const openJobs = jobs.filter((job) => job.status === "open");
  const nonManagerUsers = users.filter((user) => user.role !== "manager" && user.role !== "company");

  return {
    users,
    jobs,
    applications,
    workOrders,
    tasks,
    evidences,
    auditLogs,
    pendingValidation,
    openJobs,
    nonManagerUsers
  };
}

function mvpChecks(snapshot) {
  return [
    {
      title: "Mercado publico",
      detail: "Vagas abertas continuam visiveis fora da sessao; empresas gerem candidaturas no workspace.",
      ready: snapshot.openJobs.length > 0,
      metric: `${snapshot.openJobs.length} abertas`,
      action: "marketplace",
      actionLabel: "Abrir vagas"
    },
    {
      title: "Contas e permissoes",
      detail: "Empresa, gestor e equipa operacional devem existir antes de criar trabalho validavel.",
      ready: snapshot.users.length > 0 && snapshot.nonManagerUsers.length > 0,
      metric: `${snapshot.users.length} contas`,
      action: "team",
      actionLabel: "Gerir equipa"
    },
    {
      title: "Ordens e tarefas",
      detail: "O fluxo operacional precisa de ordens, tarefas atribuidas, estados e prazos.",
      ready: snapshot.workOrders.length > 0 && snapshot.tasks.length > 0,
      metric: `${snapshot.tasks.length} tarefas`,
      action: snapshot.workOrders.length ? "tasks" : "orders",
      actionLabel: snapshot.workOrders.length ? "Abrir tarefas" : "Criar ordem"
    },
    {
      title: "Evidencias",
      detail: "Cada tarefa enviada para validacao deve ter pelo menos uma fotografia privada.",
      ready: snapshot.evidences.length > 0,
      metric: `${snapshot.evidences.length} provas`,
      action: "tasks",
      actionLabel: "Submeter prova"
    },
    {
      title: "Auditoria",
      detail: "Acoes principais devem aparecer no historico da empresa para revisao e exportacao.",
      ready: snapshot.auditLogs.length >= 5,
      metric: `${snapshot.auditLogs.length} eventos`,
      action: "history",
      actionLabel: "Ver historico"
    }
  ];
}

function mvpStatus(check) {
  if (check.ready) return ["approved", "Pronto para teste"];
  return ["blocked", "Precisa de dados"];
}

function renderCompactTask(data, task) {
  return `
    <article class="task-card">
      <header>
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <div class="meta-row"><span>${escapeHtml(task.assigneeName)}</span><span>${formatDate(task.updatedAt)}</span></div>
        </div>
        <span class="chip ${escapeHtml(task.status)}">${escapeHtml(statusLabel(data, task.status))}</span>
      </header>
      <button class="btn ghost" data-open-task="${escapeHtml(task.id)}">Validar</button>
    </article>
  `;
}

function renderHistoryCard(log) {
  const detail = log.detail && typeof log.detail === "object"
    ? Object.entries(log.detail)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" | ")
    : "";

  return `
    <article class="history-card">
      <strong>${escapeHtml(log.action)}</strong>
      <p>${escapeHtml(log.actorName || "Sistema")} - ${formatDate(log.createdAt)}</p>
      ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
    </article>
  `;
}

function renderPrivateMvpHtml(data) {
  const snapshot = getMvpSnapshot(data);
  const checks = mvpChecks(snapshot);
  const readyCount = checks.filter((check) => check.ready).length;
  const completion = Math.round((readyCount / checks.length) * 100);
  const nextCheck = checks.find((check) => !check.ready);
  const recentLogs = snapshot.auditLogs.slice(0, 5);

  return `
    <section class="view-heading">
      <div>
        <p class="eyebrow">Fase ativa</p>
        <h1>Desenvolvimento do MVP</h1>
        <p>Mercado publico, contas, tarefas, evidencias e auditoria ligados numa iteracao operacional que pode ser testada com dados reais.</p>
      </div>
      <button class="btn primary" data-view="${escapeHtml(nextCheck ? nextCheck.action : "dashboard")}">${escapeHtml(nextCheck ? nextCheck.actionLabel : "Abrir painel")}</button>
    </section>

    <section class="mvp-stage">
      <div>
        <span class="chip in_progress">Em iteracao</span>
        <h2>${completion}% da preparacao funcional com dados neste workspace</h2>
        <p>Esta leitura e calculada a partir das vagas, contas, ordens, tarefas, provas e eventos atualmente acessiveis pela empresa autenticada.</p>
      </div>
      <div class="mvp-progress-card">
        <span>${readyCount}/${checks.length} frentes prontas</span>
        <div class="mvp-progress-bar" aria-label="Progresso do MVP"><i style="width: ${completion}%"></i></div>
        <strong>${escapeHtml(nextCheck ? `Proximo: ${nextCheck.title}` : "Fluxo completo para validacao")}</strong>
      </div>
    </section>

    <section class="mvp-metrics-grid">
      <article class="metric-card"><span>Vagas abertas</span><strong>${snapshot.openJobs.length}</strong><p>${snapshot.applications.length} candidaturas recebidas/submetidas</p></article>
      <article class="metric-card"><span>Contas</span><strong>${snapshot.users.length}</strong><p>${snapshot.nonManagerUsers.length} operacionais para atribuicao</p></article>
      <article class="metric-card"><span>Tarefas</span><strong>${snapshot.tasks.length}</strong><p>${snapshot.pendingValidation.length} aguardam validacao</p></article>
      <article class="metric-card"><span>Provas</span><strong>${snapshot.evidences.length}</strong><p>${snapshot.auditLogs.length} eventos auditados</p></article>
    </section>

    <section class="mvp-module-grid">
      ${checks.map((check) => {
        const [statusClass, label] = mvpStatus(check);
        return `
          <article class="mvp-module-card">
            <div class="module-card-head">
              <h2>${escapeHtml(check.title)}</h2>
              <span class="chip ${escapeHtml(statusClass)}">${escapeHtml(label)}</span>
            </div>
            <strong>${escapeHtml(check.metric)}</strong>
            <p>${escapeHtml(check.detail)}</p>
            <button class="btn ghost" data-view="${escapeHtml(check.action)}">${escapeHtml(check.actionLabel)}</button>
          </article>
        `;
      }).join("")}
    </section>

    <section class="section-grid">
      <div class="panel">
        <div class="panel-header"><h2>Sequencia de construcao</h2><span class="chip">MVP</span></div>
        <div class="mvp-flow">
          ${[
            ["01", "Publicar vaga", "Empresa cria uma vaga com cargo, localizacao e condicoes.", "marketplace"],
            ["02", "Registar ou convidar equipa", "Gestor cria funcionarios/prestadores para receber tarefas.", "team"],
            ["03", "Criar ordem e tarefa", "Ordem define o servico; tarefa define responsavel, prazo e estado.", "orders"],
            ["04", "Submeter evidencia", "Responsavel anexa foto, nota e localizacao pontual quando autorizado.", "tasks"],
            ["05", "Validar e auditar", "Gestor aprova/rejeita e o historico guarda os eventos principais.", "history"]
          ].map(([step, title, text, view]) => `
            <article>
              <span>${escapeHtml(step)}</span>
              <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>
              <button class="btn flat" data-view="${escapeHtml(view)}">Abrir</button>
            </article>
          `).join("")}
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="panel-header"><h2>Validacao pendente</h2><span class="chip pending_validation">${snapshot.pendingValidation.length}</span></div>
          <div class="list">
            ${snapshot.pendingValidation.length ? snapshot.pendingValidation.slice(0, 4).map((task) => renderCompactTask(data, task)).join("") : empty("Nenhuma tarefa esta a aguardar validacao.")}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Ultima auditoria</h2></div>
          <div class="list">
            ${recentLogs.length ? recentLogs.map(renderHistoryCard).join("") : empty("Ainda nao existem eventos suficientes para auditar este MVP.")}
          </div>
        </div>
      </div>
    </section>
  `;
}

module.exports = { renderPrivateMvpHtml };
