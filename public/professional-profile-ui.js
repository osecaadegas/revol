(function () {
  window.createProfessionalProfileUI = function (h) {
    const e = h.escapeHtml;
    const icon = window.TrataDesign.icon;
    let openReport = null, appliedDocumentId = null;
    const data = () => h.state.data?.professional || {};
    const field = (name, label, value = "", type = "text", attrs = "") => `<label class="field"><span>${e(label)}</span><input name="${name}" type="${type}" value="${e(value ?? "")}" ${attrs}></label>`;
    const area = (name, label, value = "", attrs = "") => `<label class="field"><span>${e(label)}</span><textarea name="${name}" ${attrs}>${e(value || "")}</textarea></label>`;
    const select = (name, label, options, value = "", attrs = "") => `<label class="field"><span>${e(label)}</span><select name="${name}" ${attrs}>${options.map(([key, text]) => `<option value="${e(key)}" ${String(value) === String(key) ? "selected" : ""}>${e(text)}</option>`).join("")}</select></label>`;
    const checked = value => value ? "checked" : "";
    const formatDate = value => value ? new Date(`${String(value).slice(0,10)}T12:00:00Z`).toLocaleDateString("pt-PT") : "Atual";
    const statusLabel = status => ({ draft:"Rascunho",published:"Publicado",pending:"A confirmar",verified:"Verificado",self_declared:"Declarado",rejected:"Recusado",submitted:"Submetido",corrected:"Corrigido",superseded:"Substituido",expired:"Revisao expirada",open:"Aberto",under_review:"Em analise",resolved:"Resolvido",pending_dpia:"Bloqueado ate DPIA",extracted:"Sugestoes extraidas",manual_review:"Revisao manual",failed:"Extracao indisponivel",correction:"Correcao",context:"Contexto",dispute:"Contestacao",restriction:"Restricao",deletion:"Eliminacao",access:"Acesso" }[status] || status || "-");
    const rows = (items, count) => { const output = Array.isArray(items) ? [...items] : []; while (output.length < count) output.push({}); return output.slice(0, count); };
    const list = value => String(value || "").split(/[\n,;]+/).map(item => item.trim()).filter(Boolean);

    function cvPreview(profile) {
      if (!profile) return "";
      return `<article class="digital-cv-preview">
        <header><div><p class="eyebrow">TrataPro Digital CV</p><h2>${e(profile.personalDetails?.name || h.state.data.user.name)}</h2><p>${e(profile.headline || "Titulo profissional por preencher")}</p></div><span class="status-pill ${e(profile.status)}">${e(statusLabel(profile.status))}</span></header>
        <div class="meta-row"><span>${e(profile.personalDetails?.location || "Localizacao por preencher")}</span><span>${e(profile.personalDetails?.phone || "")}</span><span>ID ${e(profile.stableProfileId || profile.id)}</span></div>
        ${profile.summary ? `<section><h3>Perfil</h3><p>${e(profile.summary)}</p></section>` : ""}
        ${profile.skills?.length ? `<section><h3>Competencias</h3><div class="profile-chip-row">${profile.skills.map(item => `<span class="chip">${e(item)}</span>`).join("")}</div></section>` : ""}
        ${profile.education?.length ? `<section><h3>Educacao</h3>${profile.education.map(item => `<div class="history-row"><strong>${e(item.course)}</strong><span>${e(item.institution)} · ${e(formatDate(item.startDate))} — ${e(formatDate(item.endDate))}</span><p>${e(item.details)}</p></div>`).join("")}</section>` : ""}
        ${profile.workHistory?.length ? `<section><h3>Experiencia declarada</h3>${profile.workHistory.map(item => `<div class="history-row"><strong>${e(item.title)}</strong><span>${e(item.company)} · ${e(formatDate(item.startDate))} — ${e(formatDate(item.endDate))}</span><p>${e(item.description)}</p></div>`).join("")}</section>` : ""}
        ${profile.verifiedEmployment?.length ? `<section><h3>Historico de emprego verificado</h3>${profile.verifiedEmployment.map(item => `<div class="history-row verified"><strong>${icon("badge-check")} ${e(item.position)}</strong><span>${e(item.companyName)} · ${e(formatDate(item.startDate))} — ${e(formatDate(item.endDate))}</span></div>`).join("")}</section>` : ""}
        <footer>As avaliacoes confidenciais nunca fazem parte do CV nem do PDF.</footer>
      </article>`;
    }

    function cv() {
      const profile = data().cv || {}, versions = data().versions || [], documents = data().documents || [];
      const education = rows(profile.education, 3), work = rows(profile.workHistory, 4), languages = rows(profile.languages, 3);
      return `<section class="professional-workspace">
        <div class="workspace-toolbar"><div><p class="eyebrow">Perfil profissional privado</p><h2>Perfil e versoes</h2><p>Guarde versoes, importe um documento e confirme sempre os dados extraidos antes de os aplicar.</p></div><div class="card-actions"><button class="btn ghost" type="button" data-professional="preview-cv">${icon("eye")} Pre-visualizar</button><a class="btn ghost" href="/api/professional/cv.pdf">${icon("download")} Exportar PDF</a></div></div>
        <div data-cv-preview hidden>${cvPreview(profile)}</div>
        <form class="panel form-grid digital-cv-form" data-professional-form="cv">
          <nav class="cv-stepper" aria-label="Etapas do CV">${[[0,"Dados"],[1,"Competencias"],[2,"Experiencia"],[3,"Preferencias"]].map(([step,label]) => `<button type="button" data-professional="cv-step" data-step="${step}" class="${step === 0 ? "active" : ""}"><span>${step + 1}</span>${label}</button>`).join("")}</nav>
          <section class="cv-step" data-cv-step="0">
            <div class="profile-section-title"><span>1</span><div><h3>Dados pessoais e resumo</h3><p>O nome e o email pertencem a conta e nao sao alterados por importacoes.</p></div></div>
            <div class="split-fields">${field("headline","Titulo profissional",profile.headline,"text","maxlength=160")}${field("location","Localizacao",profile.personalDetails?.location,"text","maxlength=180")}</div>
            <div class="split-fields">${field("phone","Telefone",profile.personalDetails?.phone,"tel","autocomplete=tel")}${field("birthDate","Data de nascimento (opcional)",profile.personalDetails?.birthDate,"date")}</div>
            ${area("summary","Resumo profissional",profile.summary,"maxlength=2400")}
          </section>
          <section class="cv-step" data-cv-step="1" hidden>
            <div class="profile-section-title"><span>2</span><div><h3>Competencias e qualificacoes</h3><p>Use uma entrada por linha. Nao inclua caracteristicas pessoais protegidas.</p></div></div>
            ${area("skills","Competencias",(profile.skills || []).join("\n"))}${area("qualifications","Qualificacoes",(profile.qualifications || []).join("\n"))}${area("certifications","Certificacoes",(profile.certifications || []).join("\n"))}${area("licences","Licencas e cartas",(profile.licences || []).join("\n"))}
            <h4>Idiomas</h4>${languages.map((item,index) => `<div class="split-fields">${field(`language${index}`,`Idioma ${index + 1}`,item.language)}${field(`languageLevel${index}`,"Nivel",item.level)}</div>`).join("")}
          </section>
          <section class="cv-step" data-cv-step="2" hidden>
            <div class="profile-section-title"><span>3</span><div><h3>Educacao e experiencia</h3><p>O historico declarado fica separado dos empregos confirmados por empresas.</p></div></div>
            <h4>Educacao</h4>${education.map((item,index) => `<div class="profile-entry"><div class="split-fields">${field(`educationCourse${index}`,"Curso ou qualificacao",item.course)}${field(`educationInstitution${index}`,"Instituicao",item.institution)}</div><div class="split-fields">${field(`educationStartDate${index}`,"Inicio",item.startDate,"date")}${field(`educationEndDate${index}`,"Fim",item.endDate,"date")}</div>${area(`educationDetails${index}`,"Detalhes",item.details)}</div>`).join("")}
            <h4>Experiencia declarada</h4>${work.map((item,index) => `<div class="profile-entry"><div class="split-fields">${field(`workTitle${index}`,"Cargo",item.title)}${field(`workCompany${index}`,"Empresa",item.company)}</div><div class="split-fields">${field(`workLocation${index}`,"Local",item.location)}${field(`workStartDate${index}`,"Inicio",item.startDate,"date")}${field(`workEndDate${index}`,"Fim",item.endDate,"date")}</div>${area(`workDescription${index}`,"Funcoes e resultados",item.description)}</div>`).join("")}
          </section>
          <section class="cv-step" data-cv-step="3" hidden>
            <div class="profile-section-title"><span>4</span><div><h3>Preferencias e disponibilidade</h3><p>Estes dados ajudam a encontrar vagas; nao geram ranking nem rejeicao automatica.</p></div></div>
            ${area("preferredLocations","Locais preferidos",(profile.preferences?.preferredLocations || []).join("\n"))}${area("roles","Funcoes pretendidas",(profile.preferences?.roles || []).join("\n"))}
            <fieldset><legend>Modalidade</legend>${[["onsite","Presencial"],["remote","Remoto"],["hybrid","Hibrido"]].map(([key,label]) => `<label class="check-field"><input type="checkbox" name="workMode:${key}" ${checked(profile.preferences?.workModes?.includes(key))}> ${label}</label>`).join("")}</fieldset>
            <fieldset><legend>Tipo de trabalho</legend>${[["FULL_TIME","Tempo inteiro"],["PART_TIME","Tempo parcial"],["TEMPORARY","Temporario"],["CONTRACTOR","Prestacao de servicos"]].map(([key,label]) => `<label class="check-field"><input type="checkbox" name="employmentType:${key}" ${checked(profile.preferences?.employmentTypes?.includes(key))}> ${label}</label>`).join("")}</fieldset>
            <fieldset><legend>Turnos disponiveis</legend>${[["day","Diurno"],["night","Noturno"],["rotating","Rotativo"],["weekends","Fim de semana"]].map(([key,label]) => `<label class="check-field"><input type="checkbox" name="shift:${key}" ${checked(profile.availability?.shifts?.includes(key))}> ${label}</label>`).join("")}</fieldset>
            <div class="split-fields"><label class="check-field"><input type="checkbox" name="available" ${checked(profile.availability?.available)}> Disponivel para propostas</label>${field("availableFrom","Disponivel a partir de",profile.availability?.availableFrom,"date")}</div>
          </section>
          <div class="card-actions"><button class="btn ghost" type="submit" name="intent" value="draft" formnovalidate>Guardar rascunho</button><button class="btn primary" type="submit" name="intent" value="publish">Publicar nova versao</button></div>
        </form>
        <section class="panel private-documents"><div class="panel-header"><div><h3>Documentos privados</h3><p>PDF ou DOCX. A extracao cria apenas sugestoes e nunca substitui o perfil sem confirmacao.</p></div></div>
          <form class="form-grid" data-professional-form="document"><label class="field"><span>CV ou documento</span><input type="file" name="document" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx" required></label><button class="btn primary">Carregar em privado</button></form>
          <div class="document-grid">${documents.map(document => `<article><div><strong>${e(document.originalName)}</strong><span>${e(document.mimeType.includes("wordprocessing") ? "DOCX" : "PDF")} · ${Math.ceil(document.byteSize / 1024)} KB · ${e(statusLabel(document.extractionStatus))}</span></div>${document.extractionStatus === "extracted" ? `<button class="btn ghost" type="button" data-professional="apply-extraction" data-id="${e(document.id)}">Rever sugestoes</button>` : ""}<a class="btn ghost" href="${e(document.downloadUrl)}">Descarregar</a><button class="btn danger" type="button" data-professional="delete-document" data-id="${e(document.id)}">Eliminar</button></article>`).join("") || '<p class="empty">Ainda nao existem documentos.</p>'}</div>
        </section>
        <section class="panel"><div class="panel-header"><h3>Versoes guardadas</h3><span class="chip">${versions.length}</span></div><div class="compact-list">${versions.map(version => `<div><strong>Versao ${version.version}</strong><span>${e(new Date(version.createdAt).toLocaleString("pt-PT"))} · ${e(version.changeSource)}</span></div>`).join("") || '<p class="empty">A primeira versao sera criada quando guardar.</p>'}</div></section>
      </section>`;
    }

    function employmentCard(item, worker) {
      const needsConfirmation = item.verificationStatus === "pending" && (worker ? !item.workerConfirmedAt : !item.companyConfirmedAt);
      return `<article class="employment-card"><header><div><h3>${e(item.position)}</h3><p>${e(item.companyName)}${worker ? "" : ` · ${e(item.workerName)}`}</p></div><span class="status-pill ${e(item.verificationStatus)}">${e(statusLabel(item.verificationStatus))}</span></header><p>${e(formatDate(item.startDate))} — ${e(formatDate(item.endDate))} · ${item.employmentStatus === "active" ? "Em curso" : "Terminado"}</p><div class="verification-pair"><span class="${item.workerConfirmedAt ? "done" : ""}">${icon(item.workerConfirmedAt ? "check" : "clock")} Trabalhador</span><span class="${item.companyConfirmedAt ? "done" : ""}">${icon(item.companyConfirmedAt ? "check" : "clock")} Empresa</span></div>${needsConfirmation ? `<div class="card-actions"><button class="btn primary" type="button" data-professional="confirm-employment" data-id="${e(item.id)}">Confirmar vinculo</button><button class="btn ghost" type="button" data-professional="reject-employment" data-id="${e(item.id)}">Recusar</button></div>` : ""}</article>`;
    }

    function reportList() {
      const reports = data().reportSummaries || [];
      return `<section class="panel"><div class="panel-header"><div><h3>Percurso Profissional e Avaliações</h3><p>Histórico cronológico, mais recente primeiro.</p></div><span class="chip">${reports.length}</span></div><p class="privacy-callout">Cada avaliação pertence à empresa identificada. Não existe pontuação universal, ranking ou decisão automática.</p><div class="report-list evaluation-timeline">${reports.map(report => `<article><div><strong>${e(report.companyName)} · ${e(report.workerRole || "Função não indicada")}</strong><span>${e(formatDate(report.periodStart))} — ${e(formatDate(report.periodEnd))} · ${e(statusLabel(report.status))}${report.submittedAt ? ` · ${e(new Date(report.submittedAt).toLocaleDateString("pt-PT"))}` : ""}</span><small>${report.scoredAnswerCount ? `${report.scoredAnswerCount} respostas pontuadas` : "Sem dados suficientes"}</small></div><button class="btn ghost" type="button" data-professional="view-report" data-id="${e(report.id)}">${report.status === "draft" ? "Editar rascunho" : "Ver avaliação"}</button></article>`).join("") || '<p class="empty">Ainda não existem avaliações.</p>'}</div>${openReport && openReport.status !== "draft" ? renderReport(openReport) : ""}</section>`;
    }

    function renderReport(report) {
      const answerLabel = item => {
        if (item.answerState !== "score") return item.answerState === "not_observed" ? "Não observado" : item.answerState === "not_applicable" ? "Não aplicável" : "Sem resposta";
        const historicalLabel = item.question?.scoringDefinition?.[item.score];
        return historicalLabel && historicalLabel !== `${item.score}/10` ? `${item.score} — ${historicalLabel}` : `${item.score}/10`;
      };
      const groups = Object.values((report.answers || []).reduce((result,item) => { const key = item.question.categoryKey; (result[key] ||= { label:item.question.categoryLabel,items:[] }).items.push(item); return result; },{}));
      return `<article class="evaluation-detail"><header><div><p class="eyebrow">Avaliação confidencial</p><h3>${e(report.companyName)} · ${e(report.workerRole)}</h3><p>Avaliador: ${e(report.authorName)} (${e(report.evaluatorRole)}) · ${e(formatDate(report.periodStart))} — ${e(formatDate(report.periodEnd))}</p></div><span class="status-pill">${e(statusLabel(report.status))}</span></header>
        <div class="category-average-grid">${report.categoryAverages?.length ? report.categoryAverages.map(item => `<span><strong>${e(item.average.toLocaleString("pt-PT",{ minimumFractionDigits:1,maximumFractionDigits:2 }))}</strong><small>${e(item.label)} · ${item.scoredAnswerCount}</small></span>`).join("") : '<p class="empty">Sem dados suficientes</p>'}</div>
        ${report.assessmentContext ? `<section><h4>Contexto</h4><p>${e(report.assessmentContext)}</p></section>` : ""}${report.strengths ? `<section><h4>Pontos fortes</h4><p>${e(report.strengths)}</p></section>` : ""}${report.improvements ? `<section><h4>Aspetos a melhorar</h4><p>${e(report.improvements)}</p></section>` : ""}
        <div class="evaluation-answer-groups">${groups.map(group => `<details open><summary>${e(group.label)}</summary>${group.items.map(item => `<div class="evaluation-answer ${item.source === "custom" ? "custom" : "standard"}"><div><strong>${e(item.question.questionText)}</strong>${item.source === "custom" ? '<span class="chip">Pergunta da empresa</span>' : ""}<small>${e(item.question.description || "")}</small></div><b>${e(answerLabel(item))}</b>${item.comment ? `<p>${e(item.comment)}</p>` : ""}</div>`).join("")}</details>`).join("")}</div>
        <div class="fact-grid"><span>${report.factualExperience?.nightShift ? "Confirmado" : "Não indicado"}<small>Turno noturno</small></span><span>${report.factualExperience?.weekend ? "Confirmado" : "Não indicado"}<small>Fim de semana</small></span><span>${report.factualExperience?.overtime ? "Confirmado" : "Não indicado"}<small>Horas extra realizadas</small></span><span>${report.factualExperience?.travel ? "Confirmado" : "Não indicado"}<small>Deslocações realizadas</small></span></div>${report.workerResponses?.length ? `<section><h4>Resposta do trabalhador</h4>${report.workerResponses.map(item => `<p>${e(item.workerResponse || item.description)} · ${e(statusLabel(item.status))}</p>`).join("")}</section>` : ""}<p class="privacy-callout">Ausências protegidas, indisponibilidade fora do acordado, recusa de horas extra opcionais e limites contratuais não são critérios de desempenho.</p></article>`;
    }

    function workerEmployment() {
      const companies = data().verifiedCompanies || [], employments = data().employments || [], requests = data().accessRequests || [], history = data().accessHistory || [];
      return `<section class="professional-workspace"><div class="workspace-toolbar"><div><p class="eyebrow">Dados sob o teu controlo</p><h2>Percurso Profissional e Avaliações</h2><p>Os factos do vínculo e as avaliações profissionais permanecem separados.</p></div></div>
        <section class="panel"><h3>Adicionar emprego</h3><form class="form-grid" data-professional-form="employment">${select("companyId","Empresa verificada",[["","Outra empresa / sem verificacao"],...companies.map(company => [company.id,company.name])])}${field("companyName","Nome da empresa (se nao estiver na lista)")}${field("position","Cargo","","text","required")}<div class="split-fields">${field("startDate","Inicio","","date","required")}${field("endDate","Fim (opcional)","","date")}</div><button class="btn primary">Adicionar ao historico</button></form></section>
        <section class="employment-grid">${employments.map(item => employmentCard(item,true)).join("") || '<p class="empty">Ainda nao existe historico de emprego.</p>'}</section>
        ${reportList()}
        <section class="panel"><h3>Correcoes, resposta e direitos de dados</h3><form class="form-grid" data-professional-form="dispute">${select("type","Tipo de pedido",[["correction","Correcao"],["context","Adicionar contexto"],["dispute","Contestar informacao"],["restriction","Restringir tratamento"],["deletion","Pedir eliminacao"],["access","Pedir acesso"]])}${select("reportId","Relatorio relacionado (opcional)",[["","Nenhum"],...(data().reportSummaries || []).map(report => [report.id,`${report.companyName} · v${report.version}`])])}${area("description","Pedido e motivo","","required maxlength=2400")}${area("workerResponse","Resposta contextual que deve acompanhar o relatorio") }<button class="btn primary">Submeter pedido</button></form><div class="compact-list">${(data().disputes || []).map(item => `<div><strong>${e(statusLabel(item.type))}</strong><span>${e(statusLabel(item.status))} · ${e(item.description)}</span>${item.resolution ? `<p>Resposta: ${e(item.resolution)}</p>` : ""}</div>`).join("") || '<p class="empty">Sem pedidos ativos.</p>'}</div></section>
        <section class="panel"><h3>Pedidos de acesso entre empresas</h3><p class="privacy-callout">A visibilidade de avaliacoes entre empresas esta desativada ate existir DPIA e validacao independente da base legal e dos controlos.</p>${requests.map(item => `<div class="access-request"><div><strong>${e(item.requesterCompanyName)} · ${e(item.purpose)}</strong><span>${e(item.lawfulBasis)} · ${e(statusLabel(item.status))}</span></div>${item.status === "pending_dpia" ? `<button class="btn ghost" type="button" data-professional="reject-access" data-id="${e(item.id)}">Recusar</button>` : ""}</div>`).join("") || '<p class="empty">Sem pedidos de partilha.</p>'}</section>
        <section class="panel"><h3>Historico de acessos</h3><div class="compact-list">${history.map(item => `<div><strong>${e(item.action)}</strong><span>${e(new Date(item.createdAt).toLocaleString("pt-PT"))} · ${e(item.viewerCompanyName || item.viewerName)} · ${e(item.purpose)}</span></div>`).join("") || '<p class="empty">Ainda nao existem acessos registados.</p>'}</div></section>
      </section>`;
    }

    function companyEmployment() {
      const workers = data().eligibleWorkers || [], employments = data().employments || [];
      return `<section class="professional-workspace"><div class="workspace-toolbar"><div><p class="eyebrow">Gestao da empresa</p><h2>Gestao de vinculos</h2><p>A empresa so pode criar um vinculo para uma candidatura contratada. A confirmacao do trabalhador continua obrigatoria.</p></div></div>
        ${h.state.data.company.recruitment?.verification !== "verified" ? '<div class="notice error">A conta da empresa tem de estar verificada antes de confirmar empregos ou submeter avaliacoes.</div>' : ""}
        <section class="panel"><form class="form-grid" data-professional-form="employment">${select("workerId","Trabalhador elegivel",[["","Selecionar"],...workers.map(worker => [worker.id,`${worker.name} · ${worker.email}`])],"","required")}${field("position","Cargo","","text","required")}<div class="split-fields">${field("startDate","Inicio","","date","required")}${field("endDate","Fim (opcional)","","date")}</div><button class="btn primary">Criar vinculo para confirmacao</button></form></section>
        <label class="field employment-search"><span>Pesquisar historico</span><input type="search" data-employment-search placeholder="Nome, empresa ou cargo"></label>
        <section class="employment-grid" data-employment-results>${employments.map(item => employmentCard(item,false)).join("") || '<p class="empty">Ainda nao existem vinculos.</p>'}</section>
      </section>`;
    }

    function evaluations() {
      const verified = (data().employments || []).filter(item => item.verificationStatus === "verified");
      const editing = openReport?.status === "draft" ? openReport : null, answerMap = new Map((editing?.answers || []).map(item => [item.question.questionKey,item]));
      const ratingScale = (key,value) => `<fieldset class="rating-scale"><legend>Classificação (0–10)</legend><div class="rating-options" role="radiogroup" aria-label="Classificação de 0 a 10">${Array.from({ length:11 },(_,score) => `<label class="rating-option rating-${score}"><input type="radio" name="answer:${e(key)}" value="${score}" data-evaluation-score ${String(value) === String(score) ? "checked" : ""}><span>${score}</span></label>`).join("")}</div><div class="rating-meta"><output data-rating-output aria-live="polite">${value === "" ? "Sem classificação" : `${e(value)} em 10`}</output><button class="rating-clear" type="button" data-rating-clear ${value === "" ? "disabled" : ""}>Limpar</button></div></fieldset>`;
      const answerFields = (key, question, source="standard", customId="") => { const current = answerMap.get(key), value = current?.answerState === "score" ? String(current.score) : ""; return `<div class="evaluation-question" data-source="${source}" ${customId ? `data-custom-id="${e(customId)}"` : ""}><p><strong>${e(question)}</strong>${source === "custom" ? '<span class="chip">Pergunta da empresa</span>' : ""}</p>${ratingScale(key,value)}${area(`comment:${key}`,"Comentário opcional",current?.comment || "","maxlength=900")}</div>`; };
      return `<section class="professional-workspace"><div class="workspace-toolbar"><div><p class="eyebrow">Comportamento profissional observável</p><h2>Percurso Profissional e Avaliações</h2><p>25 perguntas padrão, sem perfis de personalidade, listas negras, ranking universal ou decisão automática.</p></div></div>
        <section class="panel"><div class="panel-header"><div><h3>${editing ? "Editar rascunho" : "Nova avaliação"}</h3><p>Depois de submetida, a avaliação fica fechada. Uma avaliação posterior deve usar um novo período.</p></div></div><form class="form-grid evaluation-form" data-professional-form="evaluation"><input type="hidden" name="reportId" value="${e(editing?.id || "")}">${select("employmentId","Vínculo verificado",[["","Selecionar"],...verified.map(item => [item.id,`${item.workerName} · ${item.position}`])],editing?.employmentId || "","required")}${field("workerRole","Função do trabalhador no período",editing?.workerRole || "","text","required maxlength=180")}<div class="split-fields">${field("periodStart","Início do período avaliado",editing?.periodStart || "","date","required")}${field("periodEnd","Fim do período avaliado",editing?.periodEnd || "","date","required")}</div>${area("assessmentContext","Contexto da avaliação",editing?.assessmentContext || "","maxlength=1600")}${area("strengths","Pontos fortes",editing?.strengths || "","maxlength=1600")}${area("improvements","Aspetos a melhorar",editing?.improvements || "","maxlength=1600")}
          <p class="privacy-callout">Atribua uma classificação inteira de 0 a 10. O comentário é opcional e, quando usado, deve incluir apenas observações relacionadas com o trabalho, sem dados pessoais sensíveis.</p>
          <div class="evaluation-sections">${(data().questionGroups || []).map(group => `<fieldset><legend>${e(group.label)}</legend>${group.questions.map(item => answerFields(item.key,item.question)).join("")}</fieldset>`).join("")}</div>
          ${(data().customQuestions || []).filter(item => item.status === "active").length ? `<fieldset><legend>Perguntas da empresa</legend>${(data().customQuestions || []).filter(item => item.status === "active").map(item => answerFields(`custom:${item.id}`,item.questionText,"custom",item.id)).join("")}</fieldset>` : ""}
          <fieldset><legend>Experiência factual — separada da disponibilidade</legend><label class="check-field"><input type="checkbox" name="nightShift" ${checked(editing?.factualExperience?.nightShift)}> Turno noturno realizado</label><label class="check-field"><input type="checkbox" name="weekend" ${checked(editing?.factualExperience?.weekend)}> Trabalho ao fim de semana realizado</label><label class="check-field"><input type="checkbox" name="overtime" ${checked(editing?.factualExperience?.overtime)}> Horas extra realizadas</label><label class="check-field"><input type="checkbox" name="travel" ${checked(editing?.factualExperience?.travel)}> Deslocações realizadas</label>${area("factualContext","Período ou contexto factual",editing?.factualExperience?.context || "","maxlength=700")}</fieldset>
          <div class="card-actions"><button class="btn ghost" type="submit" name="intent" value="draft" formnovalidate>Guardar rascunho</button><button class="btn primary" type="submit" name="intent" value="submit">Submeter avaliação</button></div></form></section>
        <section class="panel"><h3>Adicionar pergunta da empresa</h3><form class="form-grid" data-professional-form="custom-question">${field("questionText","Texto da pergunta","","text","required maxlength=500")}${area("description","Descrição opcional","","maxlength=800")}${field("category","Categoria","Perguntas da empresa","text","maxlength=120")}<button class="btn ghost">Adicionar pergunta da empresa</button></form><div class="compact-list">${(data().customQuestions || []).map(item => `<div><strong>${e(item.questionText)}</strong><span>${e(item.category)} · ${item.status === "active" ? "Ativa" : "Arquivada"}</span>${item.status === "active" ? `<button class="btn ghost" type="button" data-professional="archive-custom-question" data-id="${e(item.id)}">Arquivar</button>` : ""}</div>`).join("") || '<p class="empty">Sem perguntas adicionais.</p>'}</div></section>
        ${reportList()}
        <section class="panel"><h3>Pedidos de correção dos trabalhadores</h3>${(data().disputes || []).map(item => `<form class="compact-dispute" data-professional-form="resolve-dispute" data-id="${e(item.id)}"><div><strong>${e(item.type)} · ${e(statusLabel(item.status))}</strong><p>${e(item.description)}</p>${item.workerResponse ? `<p>Resposta do trabalhador: ${e(item.workerResponse)}</p>` : ""}</div>${select("status","Estado",[["under_review","Em análise"],["resolved","Resolvido"],["rejected","Recusado"]],item.status)}${area("resolution","Resposta da empresa",item.resolution,"maxlength=2400")}<button class="btn ghost">Guardar resposta</button></form>`).join("") || '<p class="empty">Sem pedidos.</p>'}</section>
      </section>`;
    }

    function accessRequests() {
      const workers = data().eligibleWorkers || [], requests = data().accessRequests || [];
      return `<section class="professional-workspace"><div class="workspace-toolbar"><div><p class="eyebrow">Preparacao para DPIA</p><h2>Registo de finalidade</h2><p>Os pedidos ficam documentados, mas nao desbloqueiam avaliacoes de outras empresas.</p></div></div><div class="notice error">Partilha entre empresas desativada. Este fluxo regista finalidade e base legal para analise independente.</div><section class="panel"><form class="form-grid" data-professional-form="access-request">${select("workerId","Trabalhador",[["","Selecionar"],...workers.map(worker => [worker.id,worker.name])],"","required")}${area("purpose","Finalidade concreta","","required maxlength=500")}${select("lawfulBasis","Base legal declarada",[["","Selecionar"],["legitimate_interest","Interesse legitimo sujeito a avaliacao"],["legal_obligation","Obrigacao legal"],["pre_contract_steps","Diligencias pre-contratuais"]],"","required")}<button class="btn primary">Registar pedido bloqueado</button></form></section><section class="panel"><div class="compact-list">${requests.map(item => `<div><strong>${e(item.purpose)}</strong><span>${e(item.lawfulBasis)} · ${e(statusLabel(item.status))} · ${e(new Date(item.requestedAt).toLocaleDateString("pt-PT"))}</span></div>`).join("") || '<p class="empty">Sem pedidos registados.</p>'}</div></section></section>`;
    }

    function collectRows(formData, prefix, count, fields) {
      return Array.from({ length:count }, (_,index) => Object.fromEntries(fields.map(name => {
        const inputName = prefix === "language" && name === "language" ? `language${index}` : `${prefix}${name[0].toUpperCase()}${name.slice(1)}${index}`;
        return [name,String(formData.get(inputName) || "").trim()];
      }))).filter(item => Object.values(item).some(Boolean));
    }

    async function send(path, method, body) {
      const result = await h.api(`/api/professional/${path}`, { method, body });
      if (result.bootstrap) h.state.data = result.bootstrap;
      h.setNotice("Alteracoes guardadas.");
      return result;
    }

    function applySuggestions(document) {
      const suggestions = document?.extractedData?.suggestions || {};
      if (!window.confirm("Rever e aplicar estas sugestoes aos campos visiveis? Nada sera guardado ate submeter o formulario.")) return;
      const form = documentRoot().querySelector('[data-professional-form="cv"]'); if (!form) return;
      for (const name of ["headline","summary","phone"]) if (suggestions[name] && form.elements[name] && !form.elements[name].value) form.elements[name].value = suggestions[name];
      if (suggestions.skills?.length && !form.elements.skills.value) form.elements.skills.value = suggestions.skills.join("\n");
      if (suggestions.qualifications?.length && !form.elements.qualifications.value) form.elements.qualifications.value = suggestions.qualifications.join("\n");
      (suggestions.languages || []).slice(0,3).forEach((item,index) => { if (!form.elements[`language${index}`].value) form.elements[`language${index}`].value = item.language; });
      appliedDocumentId = document.id;
      form.scrollIntoView({ behavior:"smooth", block:"start" }); h.setNotice("Sugestoes aplicadas localmente. Reveja e guarde para criar uma nova versao.");
    }
    const documentRoot = () => window.document;

    function bind() {
      document.querySelectorAll(".rating-scale").forEach(scale => {
        const radios = [...scale.querySelectorAll("[data-evaluation-score]")], output = scale.querySelector("[data-rating-output]"), clear = scale.querySelector("[data-rating-clear]");
        const sync = () => { const selected = radios.find(input => input.checked); output.textContent = selected ? `${selected.value} em 10` : "Sem classificação"; clear.disabled = !selected; };
        radios.forEach(input => input.addEventListener("change",sync));
        clear.addEventListener("click",() => { radios.forEach(input => { input.checked = false; }); sync(); radios[0]?.focus(); });
      });
      document.querySelectorAll("[data-professional]").forEach(button => button.addEventListener("click", async () => {
        try {
          const action = button.dataset.professional, id = button.dataset.id;
          if (action === "cv-step") {
            const form = button.closest("form"); form.querySelectorAll("[data-cv-step]").forEach(section => { section.hidden = section.dataset.cvStep !== button.dataset.step; }); form.querySelectorAll('[data-professional="cv-step"]').forEach(item => item.classList.toggle("active", item === button)); return;
          }
          if (action === "preview-cv") { const preview = document.querySelector("[data-cv-preview]"); preview.hidden = !preview.hidden; return; }
          if (action === "apply-extraction") { applySuggestions((data().documents || []).find(item => item.id === id)); return; }
          if (action === "delete-document") await send(`documents/${encodeURIComponent(id)}`, "DELETE", {});
          if (action === "confirm-employment" || action === "reject-employment") await send(`employments/${encodeURIComponent(id)}/confirm`, "PATCH", { decision:action === "confirm-employment" ? "confirm" : "reject" });
          if (action === "reject-access") await send(`access-requests/${encodeURIComponent(id)}`, "PATCH", { decision:"reject" });
          if (action === "archive-custom-question") await send(`custom-questions/${encodeURIComponent(id)}`, "PATCH", { action:"archive" });
          if (action === "view-report") { const result = await h.api(`/api/professional/evaluations/${encodeURIComponent(id)}`); openReport = result.report; h.renderApp(); return; }
          h.renderApp();
        } catch (error) { h.setNotice(error.message,"error"); h.renderApp(); }
      }));
      document.querySelector("[data-employment-search]")?.addEventListener("input", event => {
        const query = event.target.value.toLowerCase(); document.querySelectorAll("[data-employment-results] .employment-card").forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(query); });
      });
      document.querySelectorAll("[data-professional-form]").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault(); const submit = event.submitter || form.querySelector("button"); if (submit) submit.disabled = true;
        try {
          const formData = new FormData(form), type = form.dataset.professionalForm;
          if (type === "cv") { await send("cv","POST",{ intent:event.submitter?.value === "publish" ? "publish" : "draft", sourceDocumentId:appliedDocumentId, headline:formData.get("headline"), summary:formData.get("summary"), personalDetails:{ phone:formData.get("phone"), location:formData.get("location"), birthDate:formData.get("birthDate") }, skills:list(formData.get("skills")), qualifications:list(formData.get("qualifications")), certifications:list(formData.get("certifications")), licences:list(formData.get("licences")), languages:collectRows(formData,"language",3,["language","level"]), education:collectRows(formData,"education",3,["course","institution","startDate","endDate","details"]), workHistory:collectRows(formData,"work",4,["title","company","location","startDate","endDate","description"]), preferences:{ preferredLocations:list(formData.get("preferredLocations")), roles:list(formData.get("roles")), workModes:[...form.querySelectorAll('input[name^="workMode:"]:checked')].map(item => item.name.split(":")[1]), employmentTypes:[...form.querySelectorAll('input[name^="employmentType:"]:checked')].map(item => item.name.split(":")[1]) }, availability:{ available:form.elements.available.checked, availableFrom:formData.get("availableFrom"), shifts:[...form.querySelectorAll('input[name^="shift:"]:checked')].map(item => item.name.split(":")[1]) } }); appliedDocumentId = null; }
          if (type === "document") { const file = form.elements.document.files[0]; if (!file) throw new Error("Selecione um documento."); if (file.size > 8 * 1024 * 1024) throw new Error("O documento deve ter ate 8 MB."); const dataUrl = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); await send("documents","POST",{ name:file.name, dataUrl }); }
          if (type === "employment") await send("employments","POST",Object.fromEntries(formData));
          if (type === "evaluation") {
            const answers = [...form.querySelectorAll(".evaluation-question")].map(item => { const input = item.querySelector("[data-evaluation-score]"), key = input.name.slice(7), raw = String(formData.get(`answer:${key}`) || "").trim(), numeric = Number(raw), scored = raw !== "" && Number.isInteger(numeric) && numeric >= 0 && numeric <= 10; return { questionKey:key, customQuestionId:item.dataset.customId || undefined, answerState:scored ? "score" : "unanswered", score:scored ? numeric : null, comment:formData.get(`comment:${key}`) }; });
            await send("evaluations","POST",{ intent:event.submitter?.value === "draft" ? "draft" : "submit", reportId:formData.get("reportId"), employmentId:formData.get("employmentId"), workerRole:formData.get("workerRole"), periodStart:formData.get("periodStart"), periodEnd:formData.get("periodEnd"), assessmentContext:formData.get("assessmentContext"), strengths:formData.get("strengths"), improvements:formData.get("improvements"), answers, customQuestionIds:answers.filter(item => item.customQuestionId).map(item => item.customQuestionId), factualExperience:{ nightShift:form.elements.nightShift.checked, weekend:form.elements.weekend.checked, overtime:form.elements.overtime.checked, travel:form.elements.travel.checked, context:formData.get("factualContext") } }); openReport = null;
          }
          if (type === "custom-question") await send("custom-questions","POST",Object.fromEntries(formData));
          if (type === "dispute") await send("disputes","POST",Object.fromEntries(formData));
          if (type === "resolve-dispute") await send(`disputes/${encodeURIComponent(form.dataset.id)}`,"PATCH",Object.fromEntries(formData));
          if (type === "access-request") await send("access-requests","POST",Object.fromEntries(formData));
          h.renderApp();
        } catch (error) { let box = form.querySelector(".form-error"); if (!box) { box = document.createElement("p"); box.className = "notice error form-error"; form.prepend(box); } box.textContent = error.message; }
        finally { if (submit) submit.disabled = false; }
      }));
    }

    return { cv, workerEmployment, companyEmployment, evaluations, accessRequests, bind, reset:() => { openReport = null; appliedDocumentId = null; } };
  };
})();
