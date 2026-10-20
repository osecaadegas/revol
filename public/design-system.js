(function () {
  const icons = new Set(['search', 'sliders-horizontal', 'briefcase-business', 'map-pin', 'bookmark', 'file-text', 'user-round', 'building-2', 'message-square', 'shield-check', 'settings-2', 'plus', 'x', 'log-out', 'arrow-left', 'arrow-right', 'layout-dashboard', 'clipboard-list', 'users', 'history', 'folder', 'bell', 'check']);
  let modalTrigger = null;
  const icon = name => icons.has(name) ? `<svg class="ui-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="/vendor/lucide.svg#${name}"></use></svg>` : '';
  function labelFields() {
    document.querySelectorAll('.field').forEach((field, i) => {
      const label = field.querySelector('label:not([for])');
      const control = field.querySelector('input, select, textarea');
      if (label && control && !label.contains(control)) {
        control.id ||= `field-${i}`;
        label.htmlFor = control.id;
      }
    });
  }
  function enhance() {
    // Desktop and mobile render their own navigation. Moving the first matching
    // nav detached it from the mobile <details> and duplicated the menu.
    labelFields();
    const modal = document.querySelector('.auth-modal, .detail-panel[role="dialog"]');
    document.querySelectorAll('.manifesto-shell > *, .main-layout, .mobile-workspace-menu, .skip-link').forEach(el => {
      el.inert = Boolean(modal && !el.contains(modal));
    });
    if (modal) {
      modal.tabIndex = -1;
      modal.focus({ preventScroll: true });
      modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') { modal.querySelector('[data-action="close-auth-modal"], [data-action="close-drawer"]')?.click(); }
        if (event.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      });
    } else if (modalTrigger) {
      document.querySelector(modalTrigger)?.focus({ preventScroll: true });
      modalTrigger = null;
    }
    document.querySelectorAll('[data-filter-open]').forEach(button => button.addEventListener('click', () => {
      const source = button.closest('.search-results').querySelector('.filter-panel');
      const form = source.querySelector('form');
      const dialog = document.createElement('dialog');
      dialog.className = 'filter-drawer';
      dialog.setAttribute('aria-label', 'Filtrar vagas');
      dialog.innerHTML = `<header><h2>Filtrar vagas</h2><button class="icon-button" type="button" aria-label="Fechar filtros">${icon('x')}</button></header>`;
      dialog.append(form);
      document.body.append(dialog);
      dialog.querySelector('button').onclick = () => dialog.close();
      dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
      const desktop = matchMedia('(min-width: 981px)');
      const onResize = () => { if (desktop.matches) dialog.close(); };
      desktop.addEventListener('change', onResize);
      dialog.addEventListener('close', () => { source.append(form); dialog.remove(); desktop.removeEventListener('change', onResize); button.focus(); });
      form.addEventListener('submit', () => dialog.close(), { once: true, capture: true });
      form.querySelector('[data-action="clear-market-filters"]')?.addEventListener('click', () => dialog.close(), { once: true, capture: true });
      dialog.showModal();
    }));
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-auth-preset], [data-public-apply]');
    if (trigger?.dataset.authPreset) modalTrigger = `[data-auth-preset="${trigger.dataset.authPreset}"]`;
    if (trigger?.dataset.publicApply) modalTrigger = `[data-public-apply="${CSS.escape(trigger.dataset.publicApply)}"]`;
  }, true);
  window.TrataDesign = { icon, enhance, labelFields };
})();
