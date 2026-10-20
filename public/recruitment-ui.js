(function () {
  window.createRecruitmentUI = function (h) {
    const e = h.escapeHtml;
    const icon = window.TrataDesign.icon;
    const professional = window.createProfessionalProfileUI(h);
    const chat = window.createDirectChatUI(h);
    let tab = "jobs", adminData = null, candidateQuery = "", candidateResults = null, candidateFilters = {}, candidatePage = 1, candidateTotal = 0;
    let justificationOpen = false, selectedAttendanceTaskId = "";
    const r = () => h.state.data?.recruitment || {};
    const stages = { submitted: "Candidatura enviada", viewed: "Vista pela empresa", reviewed: "Em analise", contacted: "Contactado", interview: "Entrevista", offer: "Oferta", accepted: "Contratado", hired: "Contratado", rejected: "Nao selecionado" };
    const field = (name, label, value = "", type = "text", attrs = "") => `<label class="field">${e(label)}<input name="${name}" type="${type}" value="${e(value ?? "")}" ${attrs}></label>`;
    const area = (name, label, value = "") => `<label class="field">${e(label)}<textarea name="${name}">${e(value)}</textarea></label>`;
    const select = (name, label, values, value = "") => `<label class="field">${e(label)}<select name="${name}">${values.map(([v, l]) => `<option value="${v}" ${String(value) === v ? "selected" : ""}>${e(l)}</option>`).join("")}</select></label>`;
    const toggle = (name, label, value) => `<label class="check-field"><input type="checkbox" name="${name}" ${value ? "checked" : ""}> ${e(label)}</label>`;
    const button = (action, label, id = "", extra = "") => `<button type="button" class="btn ghost" data-recruitment="${action}" data-id="${e(id)}" ${extra}>${label}</button>`;
    const modes = [["onsite", "Presencial"], ["remote", "Remoto"], ["hybrid", "Hibrido"]];
    const shifts = [["", "A combinar"], ["day", "Diurno"], ["night", "Noturno"], ["rotating", "Rotativo"], ["weekends", "Fins de semana"]];
    const pendingEmploymentRequests = () => h.isWorker()
      ? (h.state.data?.professional?.employments || []).filter(item => item.verificationStatus === "pending" && !item.workerConfirmedAt)
      : [];
    const activeEmployments = () => (h.state.data?.professional?.employments || []).filter(item => item.verificationStatus === "verified" && item.employmentStatus === "active");
    function tabItems() {
      const items = h.isWorker() ? [...(activeEmployments().length ? [["home", "Perfil"]] : []), ["jobs", "Vagas"], ["applications", "Candidaturas"], ["profile", "Meu CV"], ["employment", "Percurso profissional"], ["saved", "Guardadas"], ["messages", "Correspondência"], ["chat", "Conversas"], ["settings", "Privacidade"]]
        : [["jobs", "Vagas"], ["applications", "Candidaturas"], ["employment", "Trabalhadores"], ["evaluations", "Percurso e avaliações"], ["candidates", "Procurar candidatos"], ["create", "Criar vaga"], ["company", "Empresa"], ["messages", "Correspondência"], ["chat", "Conversas"]];
      if (h.isWorker() && h.state.data.workOrders?.length) items.splice(4, 0, ["orders", "Ordens"]);
      if (h.isWorker() && h.state.data.tasks?.length) items.splice(4, 0, ["tasks", "Tarefas"]);
      if (r().platformAdmin) items.push(["admin", "Administracao"]);
      return items;
    }
    function tabs() {
      const items = tabItems();
      const symbols = {home:"user-round",jobs:"briefcase-business",applications:"file-text",profile:"user-round",employment:"history",orders:"folder",tasks:"clipboard-list",evaluations:"clipboard-check",access:"shield-check",saved:"bookmark",messages:"mail",chat:"message-circle",settings:"settings-2",candidates:"users",create:"plus",company:"building-2",admin:"shield-check"};
      const pendingCount = pendingEmploymentRequests().length;
      const activeTasks = (h.state.data.tasks || []).filter(item => ["assigned", "in_progress", "blocked"].includes(item.status)).length;
      return `<nav class="recruitment-tabs" aria-label="Recrutamento">${items.map(([id, name]) => `<button class="btn ghost" data-recruitment="tab" data-id="${id}" aria-current="${h.state.view === "marketplace" && tab === id ? "page" : "false"}">${icon(symbols[id])}<span>${name}</span>${id === "employment" && pendingCount ? `<span class="nav-alert-count" aria-label="${pendingCount} vinculo pendente">${pendingCount}</span>` : id === "tasks" && activeTasks ? `<span class="nav-alert-count" aria-label="${activeTasks} tarefas ativas">${activeTasks}</span>` : id === "chat" && chat.unreadCount() ? `<span class="nav-alert-count" aria-label="${chat.unreadCount()} mensagens não lidas">${chat.unreadCount()}</span>` : ""}</button>`).join("")}</nav>`;
    }
    function mobileTabs() {
      const label = tabItems().find(([id]) => id === tab)?.[1] || "Vagas";
      return `<details class="mobile-recruitment-menu"><summary>${icon("menu")}<span>${h.state.view === "marketplace" ? `Área atual: <strong>${e(label)}</strong>` : "Áreas de recrutamento"}</span></summary>${tabs()}</details>`;
    }

    function employmentAlert() {
      const pending = pendingEmploymentRequests();
      if (!pending.length || tab === "employment") return "";
      const first = pending[0];
      return `<section class="employment-confirmation-alert" role="status" aria-live="polite"><div>${icon("bell")}<div><strong>${pending.length === 1 ? "Tem um vínculo de emprego por confirmar" : `Tem ${pending.length} vínculos de emprego por confirmar`}</strong><p>${e(first.companyName)} registou ${e(first.position)}. Confirme ou recuse os dados no seu percurso profissional.</p></div></div><button type="button" class="btn primary" data-recruitment="open-employment">Ver pedido</button></section>`;
    }
    const setbackSeenKey = task => `tratapro_setback_seen:${h.state.data.user.id}:${task.id}`;
    function resolvedSetbackAlerts() {
      if (!h.isWorker()) return [];
      return (h.state.data.tasks || []).filter(task => {
        if (!["assigned", "in_progress"].includes(task.status) || !task.lastSetbackResolution?.resolvedAt) return false;
        try { return localStorage.getItem(setbackSeenKey(task)) !== task.lastSetbackResolution.resolvedAt; }
        catch { return true; }
      }).sort((a, b) => b.lastSetbackResolution.resolvedAt.localeCompare(a.lastSetbackResolution.resolvedAt));
    }
    function setbackResolutionAlert() {
      const pending = resolvedSetbackAlerts();
      if (!pending.length) return "";
      const task = pending[0], order = (h.state.data.workOrders || []).find(item => item.id === task.workOrderId);
      return `<section class="employment-confirmation-alert setback-resolution-alert"><div>${icon("check")}<div><strong>${pending.length === 1 ? "Contratempo resolvido — podes retomar a tarefa" : `${pending.length} contratempos resolvidos — podes retomar as tarefas`}</strong><p>${e(task.title)}${order ? ` · ${e(order.title)}` : ""}. ${e(task.lastSetbackResolution.text)}</p></div></div><button type="button" class="btn primary" data-open-task="${e(task.id)}" data-setback-task="${e(task.id)}">Ver tarefa</button></section>`;
    }
    function acknowledgeSetback(taskId) {
      const task = (h.state.data.tasks || []).find(item => item.id === taskId);
      if (!task?.lastSetbackResolution?.resolvedAt) return;
      try { localStorage.setItem(setbackSeenKey(task), task.lastSetbackResolution.resolvedAt); }
      catch { /* O aviso permanece visível se o armazenamento local estiver indisponível. */ }
    }
    function preferences() {
      const p = h.state.data.user.profile.workerCv?.preferences || {};
      return `<form class="form-grid recruitment-form" data-recruitment-form="preferences"><h2>Disponibilidade e preferencias</h2>
        ${select("available", "Estado", [["false", "Nao estou a procura neste momento"], ["true", "Disponivel para trabalhar"]], String(p.available === true))}
        <div class="split-fields">${field("availableFrom", "Disponivel a partir de", p.availableFrom, "date")}${field("experienceYears", "Anos de experiencia", p.experienceYears, "number", 'min="0" max="80"')}</div>
        <div class="split-fields">${field("minimumSalary", "Salario minimo mensal (EUR)", p.minimumSalary, "number", 'min="0"')}${select("radius", "Raio de trabalho", [["", "Sem limite"], ...[5, 10, 25, 50, 100].map(n => [String(n), `${n} km`])], p.radius)}</div>
        <div class="split-fields">${field("latitude", "Latitude", p.coordinates?.latitude, "number", 'step="any" min="-90" max="90"')}${field("longitude", "Longitude", p.coordinates?.longitude, "number", 'step="any" min="-180" max="180"')}</div>
        ${button("locate", "Usar a minha localizacao")}
        ${area("certifications", "Certificacoes", (p.certifications || []).join("\n"))}${field("languages", "Idiomas", (p.languages || []).join(", "))}
        ${field("categories", "Profissoes pretendidas", (p.categories || []).join(", "))}${field("preferredLocations", "Locais preferidos", (p.preferredLocations || []).join(", "))}
        <fieldset><legend>Horarios</legend>${shifts.filter(([v]) => v).map(([v, l]) => toggle(`schedules:${v}`, l, p.schedules?.includes(v))).join("")}</fieldset>
        <fieldset><legend>Modalidade</legend>${modes.map(([v, l]) => toggle(`workModes:${v}`, l, p.workModes?.includes(v))).join("")}</fieldset>
        <fieldset><legend>Tempo de trabalho</legend>${[["FULL_TIME", "Tempo inteiro"], ["PART_TIME", "Tempo parcial"]].map(([v, l]) => toggle(`employmentTypes:${v}`, l, p.employmentTypes?.includes(v))).join("")}</fieldset>
        ${toggle("drivingLicence", "Carta de conducao", p.drivingLicence)}${toggle("ownVehicle", "Transporte proprio", p.ownVehicle)}<button class="btn primary">Guardar preferencias</button></form>`;
    }
    function documents() {
      return `<section class="recruitment-form"><h2>CV e certificados</h2><p>Documentos privados. Apenas tu e as empresas a que te candidatas podem descarrega-los, de acordo com a visibilidade do perfil.</p><ul class="document-list">${(r().documents || []).map(d => `<li><span>${e(d.name)} · ${e(d.kind === "cv" ? "CV" : "Certificado")}</span><a class="btn ghost" href="/api/recruitment/documents/${encodeURIComponent(d.id)}">Descarregar</a>${button("delete-document", "Eliminar", d.id)}</li>`).join("") || '<li>Ainda nao adicionaste documentos.</li>'}</ul><form class="form-grid" data-recruitment-form="document">${select("kind", "Tipo", [["cv", "CV"], ["certificate", "Certificado"]])}<label class="field">Documento PDF (ate 6 MB)<input type="file" name="document" accept="application/pdf" required></label><button class="btn primary">Adicionar documento</button></form></section>`;
    }
    function settings() {
      const p = h.state.data.user.profile.workerCv?.preferences || {};
      return `<section class="recruitment-form"><h2>Privacidade do perfil</h2><form class="form-grid" data-recruitment-form="visibility">${select("visibility", "Quem pode consultar o meu perfil", [["private", "Privado"], ["applications", "Apenas empresas a que me candidato"], ["verified", "Empresas verificadas"]], p.visibility || "applications")}<p>Na pesquisa, as empresas verificadas veem apenas um resumo profissional. Os contactos e documentos ficam reservados as empresas a que te candidatas. A data de nascimento e referencias nao aparecem na pesquisa.</p><button class="btn primary">Guardar visibilidade</button></form><p><a class="btn ghost" href="/api/recruitment/export">Descarregar os meus dados</a></p><details><summary>Eliminar conta</summary><form class="form-grid" data-recruitment-form="delete-account"><p>A conta, candidaturas, mensagens e ficheiros privados serao eliminados ou anonimizados. Registos factuais de emprego, avaliacoes e auditoria podem ficar restritos durante o periodo de retencao aplicavel. Pode pedir eliminacao ou restricao especifica em Historico verificado.</p>${field("confirm", "Escreve ELIMINAR para confirmar", "", "text", 'required pattern="ELIMINAR"')}<button class="btn danger">Eliminar a minha conta</button></form></details></section>`;
    }
    function saved() {
      const jobs = (h.state.data.jobOffers || []).filter(j => r().savedJobs?.includes(j.id));
      return `<h2>Vagas guardadas</h2><div class="market-job-list">${jobs.map(j => h.renderJobCard(j)).join("") || '<p class="empty">Ainda nao guardaste vagas.</p>'}</div><section class="recruitment-form"><h2>Pesquisas guardadas</h2>${(r().savedSearches || []).map(s => `<div class="document-list"><span>${e(s.query)} · ${e(s.location)} · ${e(s.frequency === "off" ? "Sem email" : s.frequency)}</span>${button("delete-search", "Eliminar", s.id)}</div>`).join("")}<form class="form-grid" data-recruitment-form="search">${field("query", "Cargo ou palavra-chave", h.state.marketFilters.query)}${field("location", "Localizacao", h.state.marketFilters.location)}<div class="split-fields">${field("radius", "Raio (km)", "", "number", 'min="1" max="1000"')}${field("minimumSalary", "Salario minimo mensal (EUR)", "", "number", 'min="0"')}</div>${select("frequency", "Notificacoes por email", [["off", "Guardar sem email"], ...(r().emailAlertsEnabled ? [["instant", "Assim que possivel"], ["daily", "Diarias"], ["weekly", "Semanais"]] : [])])}${!r().emailAlertsEnabled ? '<p>Os alertas por email ainda nao estao disponiveis.</p>' : ""}<button class="btn primary">Guardar pesquisa</button></form></section>`;
    }
    function company() {
      const c = h.state.data.company, p = c.recruitment || {};
      const labels = { pending: "Por verificar", verified: "Verificada", rejected: "Verificacao recusada", suspended: "Suspensa" };
      return `<form class="form-grid recruitment-form" data-recruitment-form="company"><h2>Perfil da empresa</h2><p class="chip">${labels[p.verification] || labels.pending}</p>
        ${p.logo ? `<img class="company-profile-logo" src="/api/recruitment/company-logo/${encodeURIComponent(c.id)}" alt="Logotipo da empresa" width="96" height="96">` : ""}
        <label class="field">Logotipo (PNG, JPEG ou WebP, ate 6 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp"></label>
        ${field("name", "Nome da empresa", c.name, "text", "required")}${field("nif", "NIF / NIPC", p.nif, "text", `inputmode="numeric" pattern="[0-9]{9}" ${c.nifConfigured ? 'readonly aria-readonly="true"' : ""}`)}${field("location", "Localizacao", c.location)}${field("sector", "Setor", c.sector)}${field("size", "Dimensao da empresa", p.size)}${field("website", "Website", c.website, "url")}${area("description", "Sobre a empresa", c.description)}${area("benefits", "Beneficios", p.benefits)}${toggle("requestVerification", "Pedir revisao da empresa", false)}<button class="btn primary">Guardar empresa</button></form>`;
    }
    function messages() {
      const messages = r().messages || [];
      const conversations = new Map();
      for (const m of messages) conversations.set(`${m.jobOfferId}:${m.workerId}`, m);
      for (const a of h.state.data.jobApplications || []) if (!conversations.has(`${a.jobOfferId}:${a.workerId}`)) conversations.set(`${a.jobOfferId}:${a.workerId}`, a);
      return `<h2>Correspondência de recrutamento e entrevistas</h2><p>Comunicações associadas a candidaturas, vagas e marcações de entrevista.</p>${[...conversations.values()].map(c => {
        const job = h.state.data.jobOffers.find(j => j.id === c.jobOfferId);
        const items = messages.filter(m => m.jobOfferId === c.jobOfferId && m.workerId === c.workerId);
        return `<section class="conversation"><h3>${e(job?.title || "Vaga")} ${h.isWorker() ? "" : `· ${e(c.workerName || h.state.data.jobApplications.find(a => a.workerId === c.workerId)?.workerName || "Candidato")}`}</h3>${items.map(m => `<article class="message ${m.senderId === h.state.data.user.id ? "sent" : "received"}"><p>${e(m.body)}</p><small>${e(new Date(m.createdAt).toLocaleString("pt-PT"))}</small>${m.interviewAt ? `<p>Entrevista: ${e(new Date(m.interviewAt).toLocaleString("pt-PT"))}</p><p>${m.response === "accepted" ? "Entrevista aceite" : m.response === "alternative" ? "Pedido de outro horario" : "A aguardar resposta"}</p>${h.isWorker() && !m.response ? `${button("accept-interview", "Aceitar", m.id)}${button("alternative-interview", "Sugerir outro horario", m.id)}` : ""}` : ""}${!m.readAt && m.senderId !== h.state.data.user.id ? button("read-message", "Marcar como lida", m.id) : ""}</article>`).join("")}<form class="form-grid" data-recruitment-form="message"><input type="hidden" name="jobId" value="${e(c.jobOfferId)}"><input type="hidden" name="workerId" value="${e(c.workerId)}">${area("body", "Mensagem")}${!h.isWorker() ? field("interviewAt", "Convidar para entrevista (opcional)", "", "datetime-local") : ""}<button class="btn primary">Enviar</button></form></section>`;
      }).join("") || '<p class="empty">As conversas comecam a partir de uma candidatura ou convite.</p>'}`;
    }
    function candidates() {
      const profiles = candidateResults || (h.state.data.workerProfiles || []);
      if (h.state.data.company.recruitment?.verification !== "verified") return '<p class="empty">A pesquisa de candidatos esta reservada a empresas verificadas. Completa o perfil da empresa e pede a verificacao.</p>';
      return `<h2>Procurar candidatos</h2>
        <form class="form-grid recruitment-form" data-recruitment-form="candidate-filter">
          ${field("query", "Profissao, competencia ou localizacao", candidateQuery)}
          <details><summary>Mais filtros</summary><div class="split-fields">
            ${select("jobId", "Comparar com a vaga", [["", "Selecionar"], ...h.state.data.jobOffers.map(j => [j.id, j.title])], candidateFilters.jobId)}
            ${field("radius", "Distancia da vaga (km)", candidateFilters.radius, "number", 'min="1" max="1000"')}
            ${field("experience", "Experiencia minima (anos)", candidateFilters.experience, "number", 'min="0" max="80"')}
            ${field("certification", "Certificacao", candidateFilters.certification)}${field("language", "Idioma", candidateFilters.language)}
            ${select("available", "Disponibilidade", [["", "Qualquer"], ["true", "Disponivel para trabalhar"]], candidateFilters.available)}
            ${select("drivingLicence", "Carta de conducao", [["", "Qualquer"], ["true", "Com carta"]], candidateFilters.drivingLicence)}
            ${select("ownVehicle", "Transporte", [["", "Qualquer"], ["true", "Transporte proprio"]], candidateFilters.ownVehicle)}
          </div></details><button class="btn primary">Pesquisar</button>
        </form><div class="market-job-list">${profiles.map(p => `<article class="job-card">
          <h3>${e(p.name)}</h3><p>${e(p.headline)} · ${e(p.location)}</p><p>${e(p.skills.join(" · "))}</p>
          <p>${p.preferences?.available ? "Disponivel para trabalhar" : "Nao procura neste momento"}</p>
          ${p.preferences?.experienceYears != null ? `<p>${e(p.preferences.experienceYears)} anos de experiencia</p>` : ""}
          ${p.match?.distance != null ? `<p>${e(p.match.distance)} km da vaga</p>` : ""}
          ${p.match?.percent != null ? `<p>${e(p.match.percent)}% de compatibilidade · ${p.match.factors} fatores comparados</p><p>${e(p.match.reasons.join(" · "))}</p>` : ""}
          <details><summary>Ver perfil profissional</summary><p>${e(p.bio)}</p><p>${e((p.preferences?.certifications || []).join(" · "))}</p><p>${e((p.preferences?.languages || []).join(" · "))}</p></details>
          <form class="form-grid" data-recruitment-form="message"><input type="hidden" name="workerId" value="${e(p.id)}">
            ${select("jobId", "Convidar para uma vaga", h.state.data.jobOffers.filter(j => j.status === "open").map(j => [j.id, j.title]))}${area("body", "Convite")}
            <button class="btn primary" ${h.state.data.jobOffers.some(j => j.status === "open") ? "" : "disabled"}>Convidar a candidatar-se</button>
          </form></article>`).join("") || '<p class="empty">Nenhum candidato corresponde a esta pesquisa.</p>'}</div>
          ${candidateResults ? `<div class="card-actions">${candidatePage > 1 ? button("candidate-page", "Anterior", String(candidatePage - 1)) : ""}<span>Pagina ${candidatePage}</span>${candidatePage * 30 < candidateTotal ? button("candidate-page", "Seguinte", String(candidatePage + 1)) : ""}</div>` : ""}`;
    }
    function adminView() {
      if (!adminData) return `<h2>Administracao</h2>${button("load-admin", "Carregar registos")}`;
      return `<h2>Administracao</h2><p>${adminData.metrics.workers} trabalhadores · ${adminData.metrics.companies} empresas · ${adminData.metrics.applications} candidaturas · ${adminData.metrics.hires} contratacoes</p><h3>Verificacao de empresas</h3>${adminData.companies.map(c => `<form class="form-grid moderation-row" data-recruitment-form="admin"><input type="hidden" name="companyId" value="${e(c.id)}"><strong>${e(c.name)}</strong><span>NIF: ${e(c.recruitment?.nif || "Por preencher")}</span>${select("verification", "Verificacao", [["pending", "Pendente"], ["verified", "Verificada"], ["rejected", "Recusada"], ["suspended", "Suspensa"]], c.recruitment?.verification)}<button class="btn primary">Atualizar</button></form>`).join("")}<h3>Denuncias</h3>${adminData.reports.map(report => `<form class="form-grid moderation-row" data-recruitment-form="admin"><input type="hidden" name="reportId" value="${e(report.id)}"><p>${e(report.jobOfferId)} · ${e(report.reason)} · ${e(report.detail)}</p>${select("status", "Decisao", [["reviewed", "Revista"], ["dismissed", "Arquivada"]], report.status)}<button class="btn primary">Guardar</button></form>`).join("") || '<p>Sem denuncias.</p>'}<h3>Vagas</h3>${adminData.jobs.map(j => `<p>${e(j.title)} ${button("suspend-job", j.recruitment?.suspended ? "Reativar" : "Suspender", j.id, `data-value="${!j.recruitment?.suspended}"`)}</p>`).join("")}<h3>Contas</h3>${adminData.users.map(u => `<p>${e(u.name)} · ${e(u.role)} ${u.id === h.state.data.user.id ? "" : button("suspend-user", u.active ? "Suspender" : "Reativar", u.id, `data-value="${!u.active}"`)}</p>`).join("")}<details><summary>Historico de auditoria</summary>${adminData.audit.map(a => `<p>${e(a.createdAt)} · ${e(a.actorName)} · ${e(a.action)}</p>`).join("")}</details>`;
    }
    function content() {
      if (tab === "home") return workerHome();
      if (tab === "profile") return professional.cv();
      if (tab === "orders") return h.renderOrders();
      if (tab === "tasks") return h.renderTasks();
      if (tab === "employment") return h.isWorker() ? professional.workerEmployment() : professional.companyEmployment();
      if (tab === "evaluations") return professional.evaluations();
      if (tab === "settings") return settings();
      if (tab === "saved") return saved();
      if (tab === "company") return company();
      if (tab === "messages") return messages();
      if (tab === "chat") return chat.render();
      if (tab === "candidates") return candidates();
      if (tab === "admin") return `<section class="admin-workspace">${adminView()}</section>`;
      if (tab === "create") return h.renderJobOfferForm();
      if (tab === "applications") return `<section class="applications-workspace"><h2>Candidaturas</h2>${!h.isWorker() ? `<p>${r().metrics?.applications || 0} candidaturas · ${r().metrics?.applicationToInterview == null ? "Sem dados de conversao" : `${r().metrics.applicationToInterview}% avancaram para entrevista`} · ${r().metrics?.hires || 0} contratacoes</p>` : ""}${(h.state.data.jobApplications || []).map(h.renderApplicationCard).join("") || `<p class="empty">${h.isWorker() ? "Ainda nao te candidataste a nenhuma vaga." : "Ainda nao recebeste candidaturas."}</p>`}</section>`;
      return "";
    }
    function workerHome() {
      const jobs = h.state.data.tasks || [], punches = h.state.data.attendanceEntries || [], justifications = h.state.data.attendanceJustifications || [];
      const attendanceAvailable = h.state.data.attendanceAvailable !== false;
      const reports = (h.state.data.professional?.reportSummaries || []).filter(item => ["submitted", "corrected"].includes(item.status));
      const open = punches.find(item => !item.clockedOutAt);
      const availableTasks = jobs.filter(item => !["approved", "pending_validation"].includes(item.status));
      const selectedTask = availableTasks.find(item => item.id === (open?.taskId || selectedAttendanceTaskId)) || availableTasks[0];
      selectedAttendanceTaskId = selectedTask?.id || "";
      const currentTask = open ? jobs.find(item => item.id === open.taskId) : selectedTask;
      return `<section class="worker-home"><header><p class="eyebrow">Área do trabalhador</p><h2>Olá, ${e(h.state.data.user.name.split(" ")[0])}</h2><p>O teu trabalho, registos de presença e avaliações das empresas num só lugar.</p></header>
        <section class="panel worker-attendance"><h3>Registo de trabalho</h3>${attendanceAvailable ? "" : '<p class="notice error">Registo horário e justificações indisponíveis até ser aplicada a migração da base de dados.</p>'}
          <div class="worker-attendance-context">
            ${currentTask ? `<strong>${e(currentTask.title)}</strong><small>${e(currentTask.workAddress || "Morada não indicada")} · ${e(currentTask.scheduledStartAt ? new Date(currentTask.scheduledStartAt).toLocaleString("pt-PT") : "Horário a combinar")}</small>` : '<p class="empty">Ainda não tens tarefas disponíveis para registar trabalho.</p>'}
            ${!open && availableTasks.length > 1 ? `<label class="field">Tarefa de hoje<select data-attendance-task-select>${availableTasks.map(task => `<option value="${e(task.id)}" ${task.id === selectedAttendanceTaskId ? "selected" : ""}>${e(task.title)}</option>`).join("")}</select></label>` : ""}
          </div>
          <div class="worker-attendance-actions" role="group" aria-label="Ações de registo de trabalho">
            <button class="worker-attendance-button entry" type="button" data-attendance="clock-in" data-task-id="${e(selectedTask?.id || "")}" ${!attendanceAvailable || !selectedTask || open ? "disabled" : ""}>Entrar ao trabalho</button>
            <button class="worker-attendance-button justification" type="button" data-recruitment="toggle-justification" aria-controls="worker-justification" aria-expanded="${justificationOpen}">Justificação</button>
            <button class="worker-attendance-button exit" type="button" data-attendance="clock-out" data-task-id="${e(open?.taskId || "")}" ${!attendanceAvailable || !open ? "disabled" : ""}>Saída</button>
          </div>
          ${open ? `<p class="notice" role="status">Em serviço desde ${e(new Date(open.clockedInAt).toLocaleString("pt-PT"))}.</p>` : ""}
          <details class="worker-attendance-privacy"><summary>Como funciona o registo?</summary><p>Escolhe a tarefa e toca em «Entrar ao trabalho» quando começares. No fim, toca em «Saída». A hora fica guardada automaticamente em «Últimos registos». Se faltares, usa «Justificação».</p></details>
          <details><summary>Últimos registos</summary>${punches.slice(0, 10).map(item => `<p>${e(new Date(item.clockedInAt).toLocaleString("pt-PT"))} — ${item.clockedOutAt ? e(new Date(item.clockedOutAt).toLocaleString("pt-PT")) : "Em curso"}</p>`).join("") || '<p>Ainda não há registos.</p>'}</details>
        </section>
        <section class="panel worker-justification-panel" id="worker-justification" ${justificationOpen ? "" : "hidden"}><h3>Justificar ausência</h3><p>Indica o dia e escreve um motivo ou anexa um documento. Não incluas diagnósticos ou outros dados de saúde desnecessários; o anexo fica privado.</p>
          <form class="form-grid" data-recruitment-form="attendance-justification"><label class="field">Empresa<select name="employmentId" required>${activeEmployments().map(item => `<option value="${e(item.id)}">${e(item.companyName)}</option>`).join("")}</select></label><label class="field">Dia de ausência<input type="date" name="absenceDate" required></label><label class="field">Motivo (opcional com documento)<textarea name="reason" maxlength="1200" rows="2"></textarea></label><label class="field">Documento privado (PDF, PNG ou JPEG; até 6 MB)<input type="file" name="document" accept="application/pdf,image/png,image/jpeg"></label><button class="btn primary" type="submit" ${attendanceAvailable ? "" : "disabled"}>Enviar justificação</button></form>
          <details><summary>Justificações enviadas (${justifications.length})</summary>${justifications.map(item => `<p>${e(item.absenceDate)} · ${e(item.reason || "Documento enviado")}${item.downloadUrl ? ` · <a href="${e(item.downloadUrl)}">Descarregar anexo</a>` : ""}</p>`).join("") || '<p>Ainda não há justificações.</p>'}</details>
        </section>
        <section class="panel"><h3>Avaliações profissionais</h3><p>Mostradas por empresa, sem pontuação universal ou decisão automática.</p>${reports.map(report => `<article class="worker-rating-card"><strong>${e(report.companyName)} · ${e(report.workerRole || "Função")}</strong><small>${e(new Date(report.submittedAt || report.createdAt).toLocaleDateString("pt-PT"))}</small><div>${(report.categoryAverages || []).map(category => `<span>${e(category.label)}: <b>${e(category.average)}/10</b> (${category.scoredAnswerCount})</span>`).join("") || "Sem dados suficientes"}</div></article>`).join("") || '<p class="empty">Ainda não existem avaliações submetidas.</p>'}<button class="btn ghost" type="button" data-recruitment="tab" data-id="employment">Ver percurso e responder</button></section>
      </section>`;
    }
    function jobFields(job = {}) {
      const p = job.recruitment || {};
      return `<details open><summary>Salario e condicoes</summary><div class="split-fields">${field("salaryMin", "Salario minimo (EUR)", p.salaryMin, "number", 'min="0"')}${field("salaryMax", "Salario maximo (EUR)", p.salaryMax, "number", 'min="0"')}</div>${select("salaryPeriod", "Periodo", [["MONTH", "Mes"], ["HOUR", "Hora"], ["DAY", "Dia"], ["WEEK", "Semana"], ["YEAR", "Ano"]], p.salaryPeriod || "MONTH")}${select("employmentType", "Tempo de trabalho", [["", "A combinar"], ["FULL_TIME", "Tempo inteiro"], ["PART_TIME", "Tempo parcial"], ["TEMPORARY", "Temporario"], ["CONTRACTOR", "Prestacao de servicos"], ["INTERN", "Estagio"]], p.employmentType)}${select("workMode", "Modalidade", modes, p.workMode)}${select("shift", "Turno", shifts, p.shift)}${field("deadline", "Prazo de candidatura", p.deadline?.slice(0, 10), "date")}${area("benefits", "Beneficios", p.benefits)}</details><details><summary>Requisitos e local exato</summary>${field("experienceYears", "Experiencia minima (anos)", p.experienceYears, "number", 'min="0" max="80"')}${field("skills", "Competencias", (p.skills || []).join(", "))}${field("certifications", "Certificacoes", (p.certifications || []).join(", "))}${toggle("immediate", "Entrada imediata", p.immediate)}${toggle("drivingLicence", "Carta de conducao obrigatoria", p.drivingLicence)}${toggle("ownVehicle", "Transporte proprio obrigatorio", p.ownVehicle)}<div class="split-fields">${field("latitude", "Latitude do local", p.coordinates?.latitude, "number", 'step="any"')}${field("longitude", "Longitude do local", p.coordinates?.longitude, "number", 'step="any"')}</div>${button("locate", "Usar localizacao atual")}</details><details><summary>Perguntas aos candidatos</summary>${[0, 1, 2].map(i => `<fieldset><legend>Pergunta ${i + 1}</legend>${field(`question${i}`, "Pergunta", p.screening?.[i]?.question)}${select(`type${i}`, "Tipo de resposta", [["boolean", "Sim / Nao"], ["number", "Numero"], ["choice", "Escolha multipla"], ["text", "Texto curto"]], p.screening?.[i]?.type)}${field(`options${i}`, "Opcoes (separadas por virgula)", (p.screening?.[i]?.options || []).join(", "))}</fieldset>`).join("")}</details><button class="btn ghost" type="button" data-recruitment="preview-job">Pre-visualizar</button><div data-job-preview aria-live="polite"></div>`;
    }
    function jobBody(form) {
      const data = Object.fromEntries(new FormData(form));
      data.coordinates = { latitude: data.latitude, longitude: data.longitude };
      for (const key of ["immediate", "drivingLicence", "ownVehicle"]) data[key] = form.elements[key]?.checked || false;
      data.screening = [0, 1, 2].filter(i => data[`question${i}`]?.trim()).map(i => ({ id: `q${i}`, question: data[`question${i}`], type: data[`type${i}`], options: data[`options${i}`] }));
      if (data.salaryMin || data.salaryMax) data.salary = `${data.salaryMin || ""}${data.salaryMin && data.salaryMax ? " - " : ""}${data.salaryMax || ""} EUR / ${{MONTH:"mes",HOUR:"hora",DAY:"dia",WEEK:"semana",YEAR:"ano"}[data.salaryPeriod]}`;
      return data;
    }
    function screening(job) {
      return (job.recruitment?.screening || []).map(q => q.type === "boolean" ? select(`answer:${q.id}`, q.question, [["", "Selecionar"], ["yes", "Sim"], ["no", "Nao"]]) : q.type === "choice" ? select(`answer:${q.id}`, q.question, [["", "Selecionar"], ...q.options.map(o => [e(o), o])]) : field(`answer:${q.id}`, q.question, "", q.type === "number" ? "number" : "text", q.required ? "required" : "")).join("");
    }
    async function send(path, method, body) {
      const result = await h.api(`/api/recruitment/${path}`, { method, body });
      if (result.bootstrap) h.state.data = result.bootstrap;
      h.setNotice("Alteracoes guardadas.");
      return result;
    }
    function bind() {
      document.querySelectorAll("[data-recruitment]").forEach(el => el.addEventListener("click", async () => {
        el.disabled = true;
        try {
          const action = el.dataset.recruitment, id = el.dataset.id;
          if (action === "toggle-justification") {
            justificationOpen = !justificationOpen;
            h.renderApp();
            document.querySelector('[data-recruitment="toggle-justification"]')?.focus();
            return;
          }
          if (action === "tab") {
            h.state.data = await h.api("/api/bootstrap");
            h.state.view = "marketplace";
            tab = id; if (id === "create") h.state.editJobId = null;
            if (id !== "home") justificationOpen = false;
            if (id === "chat") await chat.load();
            if (id === "applications" && !h.isWorker()) for (const application of h.state.data.jobApplications.filter(a => !a.recruitment?.viewedAt)) await send("application-view", "POST", { id: application.id });
          }
          if (action === "open-employment") {
            h.state.data = await h.api("/api/bootstrap");
            h.state.view = "marketplace";
            tab = "employment";
          }
          if (action === "new-job") { h.state.view = "marketplace"; h.state.editJobId = null; tab = "create"; }
          if (action === "edit-job") { h.state.editJobId = id; tab = "create"; }
          if (action === "candidate-page") { candidatePage = Number(id); const result = await h.api(`/api/recruitment/candidates?${new URLSearchParams({ ...candidateFilters, page: candidatePage })}`); candidateResults = result.profiles; candidateTotal = result.total; }
          if (action === "save-job") await send("saved-jobs", "POST", { jobId: id });
          if (action === "delete-document") await send("documents", "DELETE", { id });
          if (action === "delete-search") await send("searches", "DELETE", { id });
          if (action === "read-message") await send("messages", "PATCH", { id });
          if (action === "accept-interview" || action === "alternative-interview") await send("messages", "PATCH", { id, response: action === "accept-interview" ? "accepted" : "alternative" });
          if (action === "notifications") await send("notifications", "PATCH", {});
          if (action === "load-admin") adminData = await h.api("/api/recruitment/admin");
          if (action === "suspend-job") { await send("admin", "PATCH", { jobId: id, suspended: el.dataset.value === "true" }); adminData = await h.api("/api/recruitment/admin"); }
          if (action === "suspend-user") { await send("admin", "PATCH", { userId: id, active: el.dataset.value === "true" }); adminData = await h.api("/api/recruitment/admin"); }
          if (action === "locate") {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 60000 }));
            const form = el.closest("form"); form.elements.latitude.value = position.coords.latitude; form.elements.longitude.value = position.coords.longitude; return;
          }
          if (action === "preview-job") {
            const form = el.closest("form"), data = jobBody(form);
            form.querySelector("[data-job-preview]").innerHTML = `<article class="job-card"><h3>${e(data.title)}</h3><p>${e(data.location)} · ${e(data.salary)}</p><p>${e(data.description)}</p><p>${e(data.requirements)}</p><p>${e(data.benefits)}</p></article>`; return;
          }
          h.renderApp();
        } catch (err) { h.setNotice(err.message, "error"); h.renderApp(); }
        finally { el.disabled = false; }
      }));
      document.querySelectorAll("[data-recruitment-form]").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"], button:not([type])');
        if (submit) submit.disabled = true;
        try {
          const type = form.dataset.recruitmentForm, data = Object.fromEntries(new FormData(form));
          if (type === "attendance-justification") {
            const file = form.elements.document.files[0];
            if (!String(data.reason || "").trim() && !file) throw new Error("Escreva o motivo ou anexe um documento.");
            if (file) {
              if (file.size > 6 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("Use PDF, PNG ou JPEG até 6 MB.");
              data.document = { name: file.name, dataUrl: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }) };
            }
            const result = await h.api("/api/attendance/justifications", { method: "POST", body: data });
            h.state.data = result.bootstrap;
            h.setNotice("Justificação enviada em privado.");
          }
          if (type === "preferences") {
            data.coordinates = { latitude: data.latitude, longitude: data.longitude };
            for (const key of ["schedules", "workModes", "employmentTypes"]) data[key] = [...form.querySelectorAll(`input[name^='${key}:']:checked`)].map(el => el.name.split(":")[1]);
            for (const key of ["drivingLicence", "ownVehicle"]) data[key] = form.elements[key].checked;
            await send("preferences", "PATCH", data);
          }
          if (type === "visibility") await send("preferences", "PATCH", data);
          if (type === "company") {
            data.requestVerification = form.elements.requestVerification.checked;
            const file = form.elements.logo?.files[0];
            if (file) {
              if (file.size > 6 * 1024 * 1024) throw new Error("A imagem deve ter ate 6 MB.");
              data.logo = { name: file.name, dataUrl: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }) };
            }
            await send("company", "PATCH", data);
          }
          if (type === "document") {
            const file = form.elements.document.files[0];
            if (file.size > 6 * 1024 * 1024) throw new Error("O PDF deve ter ate 6 MB.");
            const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
            await send("documents", "POST", { kind: data.kind, name: file.name, dataUrl });
          }
          if (type === "search") { const point = h.resolveKnownLocation(data.location); if (point) data.coordinates = { latitude: point.lat, longitude: point.lon }; if (data.radius && !point) throw new Error("Escolha uma localizacao conhecida para usar o raio."); await send("searches", "POST", data); }
          if (type === "message") { if (data.interviewAt) data.interviewAt = new Date(data.interviewAt).toISOString(); await send("messages", "POST", data); }
          if (type === "report") { await send("reports", "POST", data); h.setNotice("Denuncia enviada para revisao."); }
          if (type === "candidate-filter") { candidateQuery = data.query; candidateFilters = data; candidatePage = 1; const result = await h.api(`/api/recruitment/candidates?${new URLSearchParams(data)}`); candidateResults = result.profiles; candidateTotal = result.total; }
          if (type === "admin") { await send("admin", "PATCH", data); adminData = await h.api("/api/recruitment/admin"); }
          if (type === "delete-account") { await send("account", "DELETE", data); localStorage.removeItem("meo_session_token"); location.assign("/"); return; }
          h.renderApp();
        } catch (err) {
          let error = form.querySelector(".form-error");
          if (!error) { error = document.createElement("p"); error.className = "notice error form-error"; error.setAttribute("role", "alert"); form.prepend(error); }
          error.textContent = err.message;
        } finally { if (submit) submit.disabled = false; }
      }));
      document.querySelectorAll("[data-attendance-task-select]").forEach(select => select.addEventListener("change", () => {
        selectedAttendanceTaskId = select.value;
        h.renderApp();
        document.querySelector("[data-attendance-task-select]")?.focus();
      }));
      document.querySelectorAll("[data-attendance]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const result = await h.api(`/api/attendance/tasks/${encodeURIComponent(button.dataset.taskId)}/${button.dataset.attendance}`, { method: "POST" });
          h.state.data = result.bootstrap;
          h.setNotice(button.dataset.attendance === "clock-in" ? "Entrada registada." : "Saída registada.");
          h.renderApp();
        } catch (error) { h.setNotice(error.message, "error"); h.renderApp(); }
      }));
      professional.bind();
      chat.bind();
    }
    function report(job) {
      return `<details><summary>Denunciar vaga</summary><form class="form-grid" data-recruitment-form="report"><input type="hidden" name="jobId" value="${e(job.id)}">${select("reason", "Motivo", [["fake", "Empresa falsa"], ["fraud", "Fraude"], ["salary", "Salario enganador"], ["discrimination", "Discriminacao"], ["money", "Pedido de dinheiro"], ["closed", "Vaga indisponivel"], ["spam", "Spam"], ["other", "Outro"]])}${area("detail", "Detalhes")}<button class="btn ghost">Enviar denuncia</button></form></details>`;
    }
    return { tabs, mobileTabs, content, bind, jobFields, jobBody, screening, report, stages, button, current: () => tab, defaultWorkerHome: () => { if (h.isWorker() && activeEmployments().length) tab = "home"; }, employmentAlert, setbackResolutionAlert, acknowledgeSetback, reset: () => { tab = "jobs"; justificationOpen = false; selectedAttendanceTaskId = ""; adminData = null; candidateResults = null; candidateFilters = {}; professional.reset(); chat.reset(); },
      notifications: () => {
        const recruitmentNotifications = r().notifications || [], employmentRequests = pendingEmploymentRequests();
        const count = recruitmentNotifications.length + employmentRequests.length;
        if (!count) return "";
        return `<details class="notifications"><summary>${count} notificacoes</summary>${employmentRequests.map(item => `<div class="notification-action"><p><strong>Vínculo por confirmar</strong><br>${e(item.companyName)} · ${e(item.position)}</p>${button("open-employment", "Ver pedido")}</div>`).join("")}${recruitmentNotifications.slice(0, 15).map(n => `<p>${e(n.text)}</p>`).join("")}${recruitmentNotifications.length ? button("notifications", "Marcar atualizacoes como lidas") : ""}</details>`;
      } };
  };
})();
