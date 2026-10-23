(function () {
  "use strict";

  let deferredPrompt = null;
  const mobileQuery = window.matchMedia("(max-width: 980px), (pointer: coarse)");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isAppleMobile() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function canOfferInstall() {
    return !isStandalone() && Boolean(deferredPrompt || mobileQuery.matches);
  }

  function syncButtons() {
    document.querySelectorAll("[data-pwa-install]").forEach((button) => {
      button.hidden = !canOfferInstall();
      button.setAttribute("aria-label", "Instalar a app TrataPro neste dispositivo");
    });
  }

  function ensureDialog() {
    let dialog = document.querySelector("[data-pwa-install-dialog]");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.className = "pwa-install-dialog";
    dialog.setAttribute("data-pwa-install-dialog", "");
    dialog.innerHTML = `
      <div class="pwa-install-dialog-head">
        <div>
          <p class="eyebrow">App TrataPro</p>
          <h2>Adicionar ao telefone</h2>
        </div>
        <button class="icon-button" type="button" data-pwa-install-close aria-label="Fechar">×</button>
      </div>
      <div data-pwa-install-instructions></div>
      <button class="btn primary full" type="button" data-pwa-install-close>Percebi</button>
    `;
    document.body.appendChild(dialog);
    return dialog;
  }

  function showInstructions() {
    const dialog = ensureDialog();
    const content = dialog.querySelector("[data-pwa-install-instructions]");
    content.innerHTML = isAppleMobile()
      ? `<ol class="pwa-install-steps"><li>No Safari, toque em <strong>Partilhar</strong> <span aria-hidden="true">□↑</span>.</li><li>Escolha <strong>Adicionar ao ecrã principal</strong>.</li><li>Confirme em <strong>Adicionar</strong>.</li></ol><p>A TrataPro ficará no ecrã principal e abrirá como uma app.</p>`
      : `<ol class="pwa-install-steps"><li>Abra o menu do navegador <strong>⋮</strong>.</li><li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar ao ecrã principal</strong>.</li><li>Confirme a instalação.</li></ol><p>A TrataPro ficará no ecrã principal e usará a mesma conta do website.</p>`;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function showStatus(message) {
    let status = document.querySelector("[data-pwa-install-status]");
    if (!status) {
      status = document.createElement("div");
      status.className = "pwa-install-status";
      status.setAttribute("data-pwa-install-status", "");
      status.setAttribute("role", "status");
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.hidden = false;
    window.setTimeout(() => { status.hidden = true; }, 4500);
  }

  async function requestInstall() {
    if (isStandalone()) return;
    if (!deferredPrompt) {
      showInstructions();
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === "accepted") showStatus("A instalar a app TrataPro…");
    syncButtons();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    syncButtons();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    syncButtons();
    showStatus("App TrataPro instalada com sucesso.");
  });

  mobileQuery.addEventListener?.("change", syncButtons);
  document.addEventListener("click", (event) => {
    const installButton = event.target.closest("[data-pwa-install]");
    if (installButton) {
      event.preventDefault();
      requestInstall().catch(() => showInstructions());
      return;
    }
    if (event.target.closest("[data-pwa-install-close]")) {
      const dialog = event.target.closest("dialog");
      if (dialog?.close) dialog.close();
      else dialog?.removeAttribute("open");
    }
  });

  window.TrataPwaInstall = Object.freeze({ sync: syncButtons });
  document.addEventListener("DOMContentLoaded", syncButtons);
})();
