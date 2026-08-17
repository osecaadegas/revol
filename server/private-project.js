const productVersion = {
  version: "v0.6.0",
  stage: "Fase 1 - MVP em desenvolvimento",
  lastUpdated: "2026-08-11",
  completionLabel: "Progresso formal por validar",
  completionNote:
    "A percentagem contratual deve ser aprovada com o cliente. Esta vista mostra progresso por etapas e evidencias tecnicas."
};

const projectPhases = [
  ["Levantamento de requisitos", "completed", "Documentos de base e requisitos Phase 1 identificados."],
  ["Arquitetura do sistema", "completed", "Frontend estatico, API Node, persistencia local/Supabase."],
  ["Desenvolvimento do MVP", "in-development", "Mercado publico, contas, tarefas, evidencias, auditoria e roles client/developer implementados em iteracao."],
  ["Testes tecnicos", "in-development", "Syntax check e smoke test automatizado existem; testes de cliente ainda pendentes."],
  ["Validacao pelo cliente", "pending", "Pendente de revisao formal, feedback e criterios de aceitacao."],
  ["Producao", "pending", "Dependente de Supabase final, variaveis Vercel e validacao."]
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
    "Area do Cliente publica para acesso, com estado do projeto, roadmap, modulos e documentacao apenas para contas client/developer.",
    "Mercado de vagas publico com filtros por pesquisa, cargo, localizacao e raio.",
    "Registo de trabalhador para candidatura e registo de empresa para publicacao de vagas.",
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
  ["Portal de Projeto", "in-development", "Fundacao implementada", "Apresenta estado, roadmap, escopo, entregas, versoes e acesso preparado para cliente.", ["REQ-PORTAL-001", "REQ-DOC-001"]],
  ["Mercado de Vagas", "testing", "Fluxo API coberto por smoke test", "Vagas publicas, filtros, contas trabalhador/empresa, candidaturas e revisao pela empresa.", ["REQ-MKT-001", "REQ-MKT-002", "REQ-MKT-003"]],
  ["Operacoes e Tarefas", "testing", "MVP funcional", "Ordens de trabalho, atribuicao de tarefas, estados operacionais e bloqueios com justificacao.", ["REQ-OPS-001", "REQ-OPS-002"]],
  ["Evidencia e Validacao", "testing", "Privacidade de ficheiros validada em smoke test", "Fotografias privadas, notas, timestamp, localizacao pontual e decisao do gestor.", ["REQ-EVD-001", "REQ-EVD-002"]],
  ["Rastreabilidade de Requisitos", "planned", "Estrutura UI criada", "Modelo Manual -> Requisito -> Funcionalidade -> Estado, pronto para base de dados futura.", ["REQ-TRACE-001"]],
  ["Centro de Documentacao", "planned", "Catalogo protegido preparado", "Organizacao de manuais, especificacao MVP, roadmap, criterios e changelog sem expor ficheiros privados.", ["REQ-DOC-001"]]
];

const manualBlocks = [
  ["Bloco I", "Manual de Engenharia - Bloco I", "Base documental recebida; requisitos detalhados por mapear."],
  ["Bloco II", "Manual de Engenharia - Bloco II", "Base documental recebida; matriz tecnica preparada."],
  ["Bloco III", "Manual de Engenharia - Bloco III", "Base documental recebida; ligacao a modulos pendente."],
  ["Bloco IV", "Manual de Engenharia - Bloco IV", "Base documental recebida; validacao formal pendente."],
  ["Bloco V", "Manual de Engenharia - Bloco V", "Base documental recebida; criterios de software por aprovar."]
];

const requirements = [
  ["REQ-MKT-001", "Contrato / correcao de conceito", "Vagas publicas", "O visitante consegue ver ofertas sem iniciar sessao.", "Mercado de Vagas", "implemented", "Smoke test API"],
  ["REQ-MKT-002", "Contrato / correcao de conceito", "Candidatura autenticada", "A candidatura exige conta de trabalhador e impede duplicados por vaga.", "Mercado de Vagas", "implemented", "Smoke test API"],
  ["REQ-MKT-003", "Contrato / correcao de conceito", "Publicacao por empresa", "Criar vagas exige conta empresa ou gestor autorizado.", "Mercado de Vagas", "implemented", "Smoke test API"],
  ["REQ-OPS-001", "Anexo de fase 1", "Ordens e tarefas", "Gestor cria ordens e tarefas com responsavel e prazo.", "Operacoes e Tarefas", "implemented", "Smoke test API"],
  ["REQ-EVD-001", "Anexo de fase 1", "Evidencia privada", "Fotografias sao privadas e servidas apenas por API autenticada.", "Evidencia e Validacao", "implemented", "Smoke test API"],
  ["REQ-TRACE-001", "Manuais de Engenharia", "Rastreabilidade documental", "Manual, requisito, modulo e estado devem poder ser ligados futuramente.", "Rastreabilidade de Requisitos", "in-development", "UI foundation"]
];

const acceptanceCriteria = [
  ["Mercado de Vagas", "testing", [["Vagas abertas aparecem ao publico", "passed"], ["Trabalhador autenticado consegue candidatar-se", "passed"], ["Empresa consegue publicar vaga", "passed"], ["Revisao de candidaturas pela empresa", "passed"], ["Validacao cliente", "not-tested"]]],
  ["Operacoes e Evidencias", "testing", [["Gestor cria ordem de trabalho", "passed"], ["Gestor atribui tarefa", "passed"], ["Responsavel submete evidencia", "passed"], ["Imagem privada exige autenticacao", "passed"], ["Validacao em producao Supabase", "not-tested"]]],
  ["Portal MANIFESTO", "testing", [["Area publica nao expoe informacao privada", "passed"], ["Projeto privado visivel a client/developer", "passed"], ["Documentacao privada nao e ligada publicamente", "testing"], ["Aprovacao cliente", "not-tested"]]]
];

const deliverables = [
  ["Repositorio base", "completed", "Codigo fonte, API, frontend e documentacao inicial.", "Fundacao", "2026-08-10"],
  ["Modelo Supabase", "completed", "Tabelas meo_*, RLS e bucket privado de evidencias.", "Persistencia", "2026-08-10"],
  ["Area do Cliente e workspace privado", "in-development", "Acesso publico controlado, com estado, roadmap, modulos, escopo e documentacao no workspace autenticado.", "Acompanhamento", "2026-08-11"],
  ["Cockpit de Desenvolvimento do MVP", "in-development", "Vista privada com progresso vivo de mercado, contas, tarefas, evidencias, validacao e auditoria.", "MVP", "2026-08-11"],
  ["Roles client/developer", "completed", "Acesso privado do projeto separado dos perfis trabalhador, company e operacionais.", "Permissoes", "2026-08-11"],
  ["Validacao Supabase em producao", "pending", "Confirmar registo, vagas, candidaturas, tarefas e evidencias com ambiente real.", "QA", "Pendente"],
  ["Aprovacao formal do cliente", "pending", "Registo de aceitacao por criterios e pedidos de alteracao.", "Handoff", "Pendente"]
];

const versionHistory = [
  {
    version: "v0.6.0",
    date: "2026-08-11",
    added: ["Roles client/developer", "Permissao privada exclusiva para Projeto e MVP", "Migracao Supabase para novos perfis"],
    improved: ["Separacao entre contas de marketplace/operacao e contas de acompanhamento do projeto"],
    fixed: ["Company/manager deixaram de ser os perfis finais para informacao privada do projeto"]
  },
  {
    version: "v0.5.0",
    date: "2026-08-11",
    added: ["Cockpit privado de Desenvolvimento do MVP", "Indicadores vivos de mercado, contas, tarefas, evidencias e auditoria", "Sequencia guiada de construcao operacional"],
    improved: ["Acompanhamento da fase ativa", "Ligacao entre roadmap e workflows reais"],
    fixed: []
  },
  {
    version: "v0.4.0",
    date: "2026-08-11",
    added: ["Portal MANIFESTO", "Area do Cliente preparada", "Changelog privado"],
    improved: ["Arquitetura de dados UI", "Responsividade da area publica", "Documentacao de projeto"],
    fixed: ["Estado das vagas quando Supabase ainda nao esta preparado"]
  },
  {
    version: "v0.3.2",
    date: "2026-08-11",
    added: ["Adaptador Vercel", "Fallback publico para vagas"],
    improved: ["Deploy Node serverless"],
    fixed: ["Entrypoint ausente em Vercel"]
  },
  {
    version: "v0.3.0",
    date: "2026-08-10",
    added: ["Mercado de vagas", "Registo trabalhador/empresa", "Filtros por localizacao e raio"],
    improved: ["Conceito alinhado com marketplace publico"],
    fixed: []
  }
];

const documentGroups = [
  { visibility: "Privado", title: "Contratual", items: ["Contrato", "Orcamento", "Escopo aprovado", "Pedidos de alteracao"] },
  { visibility: "Privado", title: "Manuais de Engenharia", items: ["Bloco I", "Bloco II", "Bloco III", "Bloco IV", "Bloco V"] },
  { visibility: "Workspace", title: "Produto e QA", items: ["Especificacao MVP", "Roadmap", "Arquitetura", "Acceptance Criteria", "Relatorio de Testes", "Changelog"] }
];

const clientDashboardCards = [
  ["Resumo executivo", "Estado do projeto e proxima decisao necessaria."],
  ["Modulos", "Arquitetura funcional e estado por componente."],
  ["Documentacao", "Contrato, manuais, setup, requisitos e changelog organizados por visibilidade."],
  ["Aceitacao", "Criterios de conclusao separados de desenvolvimento tecnico."],
  ["Pedidos de alteracao", "Base para controlar impacto em prazo, custo e escopo."],
  ["Feedback", "Observacoes do cliente sem alterar escopo automaticamente."]
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium" }).format(new Date(value));
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

function badge(status) {
  return `<span class="status-badge ${escapeHtml(status)}">${escapeHtml(statusDisplay(status))}</span>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function empty(message) {
  return `<div class="empty"><span>${escapeHtml(message)}</span></div>`;
}

function projectStatusSection() {
  const completed = projectPhases.filter(([, status]) => status === "completed").length;
  const active = projectPhases.find(([, status]) => status === "in-development");
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
          <p>${completed} de ${projectPhases.length} etapas concluidas ou tecnicamente preparadas. Fase ativa: ${escapeHtml(active?.[0] || "por definir")}.</p>
        </article>
        <div class="phase-list">
          ${projectPhases.map(([title, status, note]) => `
            <article class="phase-item">
              <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(note)}</p></div>
              ${badge(status)}
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function roadmapSection() {
  return `
    <section class="public-section alt" id="roadmap">
      <div class="section-heading">
        <p class="eyebrow">Roadmap</p>
        <h2>Da descoberta a entrega controlada</h2>
        <p>O roadmap separa trabalho concluido, fase atual e fases futuras sem apresentar funcionalidades especulativas como contratadas.</p>
      </div>
      <div class="roadmap">
        ${roadmapSteps.map(([number, title, status, description]) => `
          <article class="roadmap-step ${escapeHtml(status)}">
            <span>${escapeHtml(number)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${badge(status)}
          </article>
        `).join("")}
      </div>
      <div class="next-phase">
        <span>Proxima fase</span>
        <strong>Validacao tecnica em Supabase e revisao do cliente</strong>
        <p>Depois da base publica e operacional, o foco passa para confirmar Supabase, variaveis Vercel e fluxos reais com criterios de aceitacao.</p>
      </div>
    </section>
  `;
}

function scopeSection() {
  return `
    <section class="public-section" id="ambito">
      <div class="section-heading">
        <p class="eyebrow">Ambito da Fase Atual</p>
        <h2>O MVP nao e a plataforma final</h2>
        <p>Esta separacao protege o contrato, reduz ambiguidade e evita scope creep durante a validacao.</p>
      </div>
      <div class="scope-grid">
        <article class="scope-panel included"><h3>Incluido nesta fase</h3>${list(mvpScope.included)}</article>
        <article class="scope-panel excluded"><h3>Fora do ambito desta fase</h3>${list(mvpScope.excluded)}</article>
      </div>
    </section>
  `;
}

function comparisonSection() {
  return `
    <section class="public-section split" id="evolucao">
      ${platformComparison.map((item) => `
        <article class="concept-panel">
          <span>${escapeHtml(item.status)}</span><h2>${escapeHtml(item.title)}</h2>${list(item.items)}
        </article>
      `).join("")}
    </section>
  `;
}

function modulesSection() {
  return `
    <section class="public-section alt" id="modulos">
      <div class="section-heading">
        <p class="eyebrow">Modulos</p>
        <h2>Arquitetura funcional do MVP</h2>
        <p>Cada modulo tem estado, relacao a requisitos e caminho para detalhe. A estrutura esta pronta para migrar estes dados para Supabase.</p>
      </div>
      <div class="module-grid">
        ${modules.map(([title, status, progress, description, requirementIds]) => `
          <article class="module-card ${escapeHtml(status)}">
            <div class="module-card-head"><h3>${escapeHtml(title)}</h3>${badge(status)}</div>
            <p>${escapeHtml(description)}</p>
            <div class="meta-row"><span>${escapeHtml(progress)}</span></div>
            <div class="requirement-tags">${requirementIds.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function technicalBaseSection() {
  return `
    <section class="public-section" id="base-tecnica">
      <div class="section-heading">
        <p class="eyebrow">Base Tecnica do Projeto</p>
        <h2>Manuais de Engenharia como fonte de rastreabilidade</h2>
        <p>Os ficheiros existem no repositorio, mas o conteudo detalhado nao e exposto publicamente. A matriz abaixo prepara a ligacao Manual -> Requisito -> Funcionalidade -> Estado.</p>
      </div>
      <div class="manual-grid">
        ${manualBlocks.map(([block, title, note]) => `
          <article class="manual-card">
            <span>${escapeHtml(block)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(note)}</p>
            <div class="trace-line"><span>Manual</span><span>Requirement</span><span>Modulo</span><span>Status</span></div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function requirementsSection() {
  return `
    <section class="public-section alt" id="rastreabilidade">
      <div class="section-heading">
        <p class="eyebrow">Requirement Traceability</p>
        <h2>Modelo reutilizavel de requisitos</h2>
        <p>IDs internos sao usados para estruturar o MVP atual. Requisitos detalhados dos manuais devem ser aprovados antes de preencher descricoes tecnicas finas.</p>
      </div>
      <div class="responsive-table">
        <table>
          <thead><tr><th>ID</th><th>Fonte</th><th>Requisito</th><th>Modulo</th><th>Desenvolvimento</th><th>Validacao</th></tr></thead>
          <tbody>
            ${requirements.map(([id, source, name, description, moduleName, status, validation]) => `
              <tr>
                <td data-label="ID">${escapeHtml(id)}</td>
                <td data-label="Fonte">${escapeHtml(source)}</td>
                <td data-label="Requisito"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(description)}</span></td>
                <td data-label="Modulo">${escapeHtml(moduleName)}</td>
                <td data-label="Desenvolvimento">${badge(status)}</td>
                <td data-label="Validacao">${escapeHtml(validation)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function acceptanceSection() {
  return `
    <section class="public-section" id="criterios">
      <div class="section-heading">
        <p class="eyebrow">Acceptance Criteria</p>
        <h2>Conclusao medida por criterios, nao por impressao</h2>
        <p>Os criterios distinguem teste tecnico, teste em progresso e aceitacao formal pelo cliente.</p>
      </div>
      <div class="acceptance-grid">
        ${acceptanceCriteria.map(([moduleName, groupStatus, checks]) => `
          <article class="acceptance-card">
            <div class="module-card-head"><h3>${escapeHtml(moduleName)}</h3>${badge(groupStatus)}</div>
            <div class="criteria-list">
              ${checks.map(([label, status]) => `<div><span>${escapeHtml(label)}</span>${badge(status)}</div>`).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function deliverablesSection() {
  return `
    <section class="public-section alt" id="entregas">
      <div class="section-heading"><p class="eyebrow">Entregas</p><h2>O que existe, o que esta em curso e o que falta</h2></div>
      <div class="deliverable-columns">
        ${["completed", "in-development", "pending"].map((status) => `
          <div>
            <h3>${escapeHtml(statusDisplay(status))}</h3>
            ${deliverables.filter(([, itemStatus]) => itemStatus === status).map(([title, itemStatus, description, phase, date]) => `
              <article class="deliverable-card">${badge(itemStatus)}<h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p><div class="meta-row"><span>${escapeHtml(phase)}</span><span>${escapeHtml(date)}</span></div></article>
            `).join("") || empty("Sem itens nesta categoria.")}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function documentationSection() {
  return `
    <section class="public-section" id="documentacao">
      <div class="section-heading">
        <p class="eyebrow">Documentation Center</p>
        <h2>Documentacao preparada sem expor ficheiros privados</h2>
        <p>O centro organiza os grupos certos agora e deixa areas privadas prontas para autenticacao/permissions.</p>
      </div>
      <div class="document-grid">
        ${documentGroups.map((group) => `<article class="document-card"><span>${escapeHtml(group.visibility)}</span><h3>${escapeHtml(group.title)}</h3>${list(group.items)}</article>`).join("")}
      </div>
    </section>
  `;
}

function changeRequestSection() {
  return `
    <section class="public-section split" id="alteracoes">
      <article class="concept-panel">
        <span>Scope control</span><h2>Pedidos de Alteracao</h2>
        <p>Cada pedido devera registar prioridade, impacto de escopo, custo, prazo e decisao. Nenhum feedback informal altera automaticamente o MVP.</p>
        ${empty("Sem pedidos formais registados.")}
      </article>
      <article class="concept-panel">
        <span>Review loop</span><h2>Feedback do Cliente</h2>
        <p>Observacoes do cliente ficam separadas de pedidos formais de alteracao para manter o processo controlado.</p>
        ${empty("Sem feedback registado nesta estrutura.")}
      </article>
    </section>
  `;
}

function feedbackSection() {
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

function versionHistorySection() {
  return `
    <section class="public-section" id="changelog">
      <div class="section-heading">
        <p class="eyebrow">Versioning</p>
        <h2>Changelog MANIFESTO</h2>
        <p>Historico privado de alteracoes por versao. As entradas registam o que foi adicionado, melhorado e corrigido.</p>
      </div>
      <div class="changelog-list">
        ${versionHistory.map((entry) => `
          <article class="changelog-entry">
            <header><h2>${escapeHtml(entry.version)}</h2><span>${formatDate(entry.date)}</span></header>
            ${["added", "improved", "fixed"].map((key) => entry[key].length ? `<div class="changelog-group"><strong>${escapeHtml(key[0].toUpperCase() + key.slice(1))}</strong>${list(entry[key])}</div>` : "").join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPrivateProjectHtml() {
  return `
    <div class="manifesto-shell private-project-shell">
      <section class="public-page-hero">
        <p class="eyebrow">Area privada</p>
        <h1>Dashboard MANIFESTO</h1>
        <p>Resumo executivo para cliente e equipa de desenvolvimento: estado do projeto, modulos, entregas, documentos, feedback, pedidos de alteracao, testes e versoes.</p>
        <div class="version-strip"><span>${escapeHtml(productVersion.stage)}</span><strong>${escapeHtml(productVersion.version)}</strong><span>Atualizado ${formatDate(productVersion.lastUpdated)}</span></div>
      </section>
      <section class="public-section">
        <div class="client-dashboard-grid">
          ${clientDashboardCards.map(([title, description]) => `<article class="client-dashboard-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></article>`).join("")}
        </div>
      </section>
      ${projectStatusSection()}
      ${roadmapSection()}
      ${scopeSection()}
      ${comparisonSection()}
      ${modulesSection()}
      ${technicalBaseSection()}
      ${requirementsSection()}
      ${acceptanceSection()}
      ${deliverablesSection()}
      ${documentationSection()}
      ${changeRequestSection()}
      ${feedbackSection()}
      ${versionHistorySection()}
    </div>
  `;
}

module.exports = { renderPrivateProjectHtml };
