(function () {
  window.createDirectChatUI = function (h) {
    const e = h.escapeHtml;
    const icon = window.TrataDesign.icon;
    let activeId = null;
    let activeConversation = null;
    let messages = [];
    let pollTimer = null;
    let loading = false;

    const state = () => h.state.data?.directChat || { conversations:[],contacts:[],unreadCount:0 };
    const dateTime = value => value ? new Date(value).toLocaleString("pt-PT",{ dateStyle:"short",timeStyle:"short" }) : "";

    async function load(conversationId = activeId,{ render = false } = {}) {
      if (loading) return;
      loading = true;
      try {
        const result = await h.api("/api/direct-chat");
        h.state.data.directChat = result.chat;
        if (conversationId && result.chat.conversations.some(item => item.id === conversationId)) {
          activeId = conversationId;
          await h.api(`/api/direct-chat/conversations/${encodeURIComponent(activeId)}/read`,{ method:"PATCH",body:{} });
          const detail = await h.api(`/api/direct-chat/conversations/${encodeURIComponent(activeId)}`);
          activeConversation = detail.conversation;
          messages = detail.messages;
          const refreshed = await h.api("/api/direct-chat");
          h.state.data.directChat = refreshed.chat;
        } else if (activeId) {
          activeId = null; activeConversation = null; messages = [];
        }
        if (render) h.renderApp();
      } finally { loading = false; }
    }

    function conversationList() {
      return state().conversations.map(item => `<button type="button" class="chat-list-item ${item.id === activeId ? "active" : ""}" data-direct-chat="open" data-id="${e(item.id)}" aria-current="${item.id === activeId ? "page" : "false"}">
        <span class="chat-avatar" aria-hidden="true">${e(item.contact.name.slice(0,1).toUpperCase())}</span><span class="chat-list-copy"><strong>${e(item.contact.name)}</strong><small>${e(item.contact.roleLabel)} · ${e(item.contact.companyName)}</small><span>${e(item.lastMessage?.body || "Conversa iniciada")}</span></span>${item.unreadCount ? `<span class="chat-unread" aria-label="${item.unreadCount} mensagens não lidas">${item.unreadCount}</span>` : ""}
      </button>`).join("") || '<p class="empty">Ainda não existem conversas diretas.</p>';
    }

    function newConversation() {
      const contacts = state().contacts;
      return `<form class="chat-new-form" data-direct-chat-form="new"><label class="field">Novo contacto<select name="contactUserId" required><option value="">Selecionar pessoa</option>${contacts.map(contact => `<option value="${e(contact.id)}">${e(contact.name)} — ${e(contact.roleLabel)} · ${e(contact.companyName)}</option>`).join("")}</select></label><button class="btn ghost" ${contacts.length ? "" : "disabled"}>Iniciar conversa</button>${contacts.length ? "" : '<p class="field-help">Os contactos aparecem depois de existir um vínculo de trabalho verificado.</p>'}</form>`;
    }

    function conversationWindow() {
      if (!activeConversation) return `<div class="chat-placeholder">${icon("message-circle")}<h3>Escolha uma conversa</h3><p>Fale diretamente com a pessoa certa da empresa, sem misturar esta área com candidaturas e entrevistas.</p></div>`;
      const currentUserId = h.state.data.user.id;
      return `<section class="chat-window" aria-label="Conversa com ${e(activeConversation.contact.name)}"><header class="chat-window-head"><span class="chat-avatar" aria-hidden="true">${e(activeConversation.contact.name.slice(0,1).toUpperCase())}</span><div><h3>${e(activeConversation.contact.name)}</h3><p>${e(activeConversation.contact.roleLabel)} · ${e(activeConversation.contact.companyName)}</p></div><button type="button" class="btn ghost chat-refresh" data-direct-chat="refresh" aria-label="Atualizar conversa">${icon("refresh-cw")} Atualizar</button></header>
        <div class="chat-message-list" role="log" aria-live="polite">${messages.map(message => `<article class="chat-bubble ${message.senderId === currentUserId ? "sent" : "received"}"><p>${e(message.body)}</p><small>${e(dateTime(message.createdAt))}${message.senderId === currentUserId ? message.readAt ? " · Lida" : " · Enviada" : ""}</small></article>`).join("") || '<p class="empty">Envie a primeira mensagem desta conversa.</p>'}</div>
        <form class="chat-composer" data-direct-chat-form="message"><input type="hidden" name="conversationId" value="${e(activeConversation.id)}"><label class="field"><span class="sr-only">Mensagem</span><textarea name="body" maxlength="3000" required placeholder="Escrever mensagem"></textarea></label><button class="btn primary" aria-label="Enviar mensagem">${icon("send")} Enviar</button></form></section>`;
    }

    function render() {
      return `<section class="direct-chat-workspace" data-direct-chat-root><header class="direct-chat-heading"><div><p class="eyebrow">Comunicação direta</p><h2>Conversas</h2><p>Conversas privadas entre o trabalhador e um membro específico da empresa.</p></div></header><div class="direct-chat-layout"><aside class="chat-sidebar" aria-label="Lista de conversas">${newConversation()}<div class="chat-list">${conversationList()}</div></aside>${conversationWindow()}</div></section>`;
    }

    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!document.querySelector("[data-direct-chat-root]")) return;
      pollTimer = setTimeout(async () => {
        if (document.hidden || !document.querySelector("[data-direct-chat-root]")) return schedulePoll();
        try { await load(activeId,{ render:true }); } catch (_) { schedulePoll(); }
      },8000);
    }

    function bind() {
      document.querySelectorAll("[data-direct-chat]").forEach(button => button.addEventListener("click",async () => {
        button.disabled = true;
        try {
          if (button.dataset.directChat === "open") { activeId = button.dataset.id; await load(activeId,{ render:true }); return; }
          if (button.dataset.directChat === "refresh") { await load(activeId,{ render:true }); return; }
        } catch (error) { h.setNotice(error.message,"error"); h.renderApp(); }
        finally { button.disabled = false; }
      }));
      document.querySelectorAll("[data-direct-chat-form]").forEach(form => form.addEventListener("submit",async event => {
        event.preventDefault(); const submit = form.querySelector("button"); if (submit) submit.disabled = true;
        try {
          const data = Object.fromEntries(new FormData(form));
          if (form.dataset.directChatForm === "new") {
            const result = await h.api("/api/direct-chat/conversations",{ method:"POST",body:data }); activeId = result.conversation.id;
          } else await h.api("/api/direct-chat/messages",{ method:"POST",body:data });
          await load(activeId,{ render:true });
        } catch (error) {
          let notice = form.querySelector(".form-error"); if (!notice) { notice = document.createElement("p"); notice.className = "notice error form-error"; notice.setAttribute("role","alert"); form.prepend(notice); }
          notice.textContent = error.message;
        } finally { if (submit) submit.disabled = false; }
      }));
      const list = document.querySelector(".chat-message-list"); if (list) list.scrollTop = list.scrollHeight;
      schedulePoll();
    }

    return { load,render,bind,unreadCount:() => state().unreadCount || 0,reset:() => { clearTimeout(pollTimer);activeId=null;activeConversation=null;messages=[];loading=false; } };
  };
})();
