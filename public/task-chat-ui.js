(function () {
  window.createTaskChatUI = function (h) {
    const e = h.escapeHtml;
    const icon = window.TrataDesign.icon;
    const categories = { materials: "Materiais", tools: "Ferramentas", weather: "Meteorologia", access: "Acesso ao local", safety: "Segurança", other: "Outro" };
    let activeId = null, messages = [], error = "", busy = false, pollTimer = null, requestSequence = 0;
    const tasks = () => h.state.data?.tasks || [];
    const current = () => tasks().find(task => task.id === activeId);
    const dateTime = value => value ? new Date(value).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "";

    async function load(taskId = activeId, shouldRender = true) {
      if (!h.state.data?.taskChatAvailable) { error = "A conversa da tarefa ainda não está disponível."; if (shouldRender) h.renderApp(); return; }
      if (!taskId) taskId = tasks()[0]?.id;
      if (!taskId) { activeId = null; messages = []; if (shouldRender) h.renderApp(); return; }
      const sequence = ++requestSequence;
      try {
        const result = await h.api(`/api/tasks/${encodeURIComponent(taskId)}/chat`);
        if (sequence !== requestSequence) return;
        const previousSignature = JSON.stringify(messages.map(item => [item.id, item.attachment?.expired]));
        const previousStatus = current()?.status;
        activeId = taskId; messages = result.messages; error = "";
        const index = h.state.data.tasks.findIndex(task => task.id === taskId);
        if (index >= 0) h.state.data.tasks[index] = result.task;
        if (shouldRender) h.renderApp();
        else if (previousStatus !== result.task.status) h.renderApp();
        else if (previousSignature !== JSON.stringify(messages.map(item => [item.id, item.attachment?.expired]))) {
          const list = document.querySelector(".task-chat-workspace .chat-message-list");
          if (list) {
            const container = document.createElement("div"); container.innerHTML = render();
            const fresh = container.querySelector(".chat-message-list");
            if (fresh) { list.innerHTML = fresh.innerHTML; list.scrollTop = list.scrollHeight; bindFiles(); }
          }
        }
      } catch (cause) { if (sequence === requestSequence) { error = cause.message; if (shouldRender) h.renderApp(); } }
    }

    function bindFiles() {
      document.querySelectorAll("[data-task-chat-file]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const blob = await h.api(`/api/evidence/${encodeURIComponent(button.dataset.taskChatFile)}/file`);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = "fotografia-tarefa"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (cause) { error = cause.message; h.renderApp(); }
        finally { button.disabled = false; }
      }));
    }

    function render() {
      const task = current();
      return `<section class="direct-chat-workspace task-chat-workspace" data-task-chat-root><header class="direct-chat-heading"><div><p class="eyebrow">Trabalho em equipa</p><h2>Conversa da tarefa</h2><p>Mensagens e problemas ficam ligados à tarefa, com autor e data.</p></div></header>
        <div class="direct-chat-layout"><aside class="chat-sidebar" aria-label="Tarefas com conversa"><div class="chat-list">${tasks().map(item => `<button type="button" class="chat-list-item ${item.id === activeId ? "active" : ""}" data-task-chat="open" data-id="${e(item.id)}" aria-current="${item.id === activeId ? "page" : "false"}"><span class="chat-avatar" aria-hidden="true">${e(item.title.slice(0, 1).toUpperCase())}</span><span class="chat-list-copy"><strong>${e(item.title)}</strong><small>${e(item.assigneeName || "Equipa")}</small><span>${item.status === "blocked" ? "Contratempo ativo" : "Conversa de trabalho"}</span></span></button>`).join("") || '<p class="empty">Ainda não tens tarefas atribuídas.</p>'}</div></aside>
        ${task ? `<section class="chat-window" aria-label="Conversa da tarefa ${e(task.title)}"><header class="chat-window-head"><div><h3>${e(task.title)}</h3><p>${task.status === "blocked" ? "Contratempo ativo" : "Tarefa em curso"}</p></div><button type="button" class="btn ghost chat-refresh" data-task-chat="refresh" aria-label="Atualizar conversa">${icon("refresh-cw")} Atualizar</button></header>
          <div class="chat-message-list" role="log" aria-live="polite">${messages.map(message => `<article class="chat-bubble ${message.senderId === h.state.data.user.id ? "sent" : "received"} ${message.kind === "problem" ? "task-chat-problem" : message.kind === "resolution" ? "task-chat-resolution" : ""}"><strong>${e(message.senderName)}</strong>${message.kind === "problem" ? `<span class="task-chat-tag">${message.blocksWork ? "Contratempo · " : "Problema · "}${e(categories[message.category] || "Outro")}</span>` : message.kind === "resolution" ? '<span class="task-chat-tag">Resolvido · Trabalho pode prosseguir</span>' : ""}<p>${e(message.body)}</p>${message.attachment ? message.attachment.expired ? '<small>Fotografia já não disponível</small>' : `<button type="button" class="task-chat-file" data-task-chat-file="${e(message.attachment.id)}">Ver fotografia</button>` : ""}<small>${e(dateTime(message.createdAt))}</small></article>`).join("") || '<p class="empty">Ainda não há mensagens. Descreve o trabalho ou comunica um problema.</p>'}</div>
          ${task.status === "blocked" && ["manager", "company"].includes(h.state.data.user.role) ? `<form class="task-chat-resolution-form" data-task-chat-form="resolve"><strong>Resolver contratempo</strong><label class="field">O que foi resolvido?<textarea name="resolution" minlength="10" maxlength="1000" required placeholder="Ex.: materiais entregues à equipa"></textarea></label><button class="btn primary" ${busy ? "disabled" : ""}>Confirmar resolução</button></form>` : ""}
          <form class="task-chat-composer" data-task-chat-form="send"><details class="task-chat-tools"><summary>Comunicar problema ou juntar fotografia</summary><div class="task-chat-controls"><label class="field">Tipo<select name="kind" data-task-chat-kind><option value="message">Mensagem</option><option value="problem">Comunicar problema</option></select></label><label class="field task-chat-problem-control" hidden>Motivo<select name="category"><option value="">Selecionar motivo</option>${Object.entries(categories).map(([id, label]) => `<option value="${id}">${e(label)}</option>`).join("")}</select></label><label class="check-field task-chat-problem-control" hidden><input type="checkbox" name="blocksWork" ${task.status === "blocked" ? "disabled" : ""}> Impede continuar</label><label class="field task-chat-photo">Fotografia<input type="file" name="photo" accept="image/*" capture="environment"></label></div></details><div class="task-chat-send"><label class="field"><span class="sr-only">Mensagem</span><textarea name="body" maxlength="3000" placeholder="Escrever mensagem ou explicar problema"></textarea></label><button class="btn primary" ${busy ? "disabled" : ""}>${icon("send")} Enviar</button></div></form></section>` : '<div class="chat-placeholder"><h3>Escolha uma tarefa</h3></div>'}</div>${error ? `<p class="notice error" role="alert">${e(error)}</p>` : ""}</section>`;
    }

    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!document.querySelector("[data-task-chat-root]")) return;
      pollTimer = setTimeout(async () => {
        if (!document.hidden && !busy && document.querySelector("[data-task-chat-root]")) await load(activeId, false);
        schedulePoll();
      }, 8000);
    }

    function bind() {
      bindFiles();
      document.querySelectorAll("[data-task-chat-kind]").forEach(select => select.addEventListener("change", () => {
        select.closest("form").querySelectorAll(".task-chat-problem-control").forEach(field => { field.hidden = select.value !== "problem"; });
      }));
      document.querySelectorAll("[data-task-chat]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        await load(button.dataset.id || activeId);
      }));
      document.querySelectorAll("[data-task-chat-form]").forEach(form => form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!activeId || busy) return;
        busy = true;
        const submit = form.querySelector('button[type="submit"], button:not([type])');
        if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = "A enviar…"; }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const data = new FormData(form);
          let result;
          if (form.dataset.taskChatForm === "resolve") {
            result = await h.api(`/api/tasks/${encodeURIComponent(activeId)}/resolve-setback`, { method: "POST", body: { resolution: data.get("resolution") }, signal: controller.signal });
          } else {
            const file = data.get("photo");
            const photo = file?.size ? await window.TrataEvidencePhoto.prepare(file) : null;
            result = await h.api(`/api/tasks/${encodeURIComponent(activeId)}/chat`, { method: "POST", body: { kind: data.get("kind"), category: data.get("category"), blocksWork: data.has("blocksWork"), body: data.get("body"), photo }, signal: controller.signal });
          }
          h.state.data = result.bootstrap;
          await load(activeId);
        } catch (cause) {
          error = cause.name === "AbortError" ? "O envio demorou demasiado. Atualize a conversa e confirme se a mensagem chegou antes de repetir." : cause.message;
          let notice = form.querySelector(".form-error");
          if (!notice) { notice = document.createElement("p"); notice.className = "notice error form-error"; notice.setAttribute("role", "alert"); form.prepend(notice); }
          notice.textContent = error;
        }
        finally { clearTimeout(timeout); busy = false; if (submit) { submit.disabled = false; submit.textContent = submit.dataset.oldText; } }
      }));
      const list = document.querySelector(".task-chat-workspace .chat-message-list");
      if (list) list.scrollTop = list.scrollHeight;
      schedulePoll();
    }

    return { render, bind, load, open: id => load(id), reset: () => { clearTimeout(pollTimer); requestSequence += 1; activeId = null; messages = []; error = ""; } };
  };
})();
