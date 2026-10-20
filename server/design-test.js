const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function reviewDesign(browser, base, accounts, jobPath, companyPath) {
  const directory = path.join(__dirname, '..', 'tmp', 'design-qa');
  fs.mkdirSync(directory, { recursive: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && /\.(woff2|svg|js|css)(\?|$)/.test(response.url())) errors.push(`Asset ${response.status()}: ${response.url()}`); });
  let screenshots = 0;
  const contrastIssues = [];
  async function capture(name, width) {
    await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(233, 226, 212)', `${name}: workshop background`);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
      const box = el.getBoundingClientRect();
      return box.width && box.left >= 0 && box.right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed';
    }).slice(0, 8).map(el => `${el.tagName}.${el.className}`));
    assert.deepEqual(overflow, [], `${name} ${width}: overflow`);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('label')].filter(label => label.querySelector('input,select,textarea') && label.control !== label.querySelector('input,select,textarea')).map(label => label.textContent.trim())), [], `${name}: labels must target their own controls`);
    if (width === 1440) contrastIssues.push(...await page.evaluate(screen => {
      const parse = color => color.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
      const mix = (a, b) => a.slice(0, 3).map((v, i) => v * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)));
      const luminance = rgb => rgb.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
      const issues = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.getClientRects().length || el.closest('[inert],svg') || el.disabled || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden') continue;
        let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
        const parents = [];
        for (let p = el; p; p = p.parentElement) parents.unshift(p);
        for (const p of parents) bg = mix(parse(getComputedStyle(p).backgroundColor), bg);
        const fg = mix(parse(style.color), bg), a = luminance(fg), b = luminance(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) issues.push({screen, element:el.tagName + '.' + el.className, text:el.textContent.trim().slice(0, 45), ratio:Math.round(ratio * 100) / 100});
      }
      return issues;
    }, name));
    await page.screenshot({ path: path.join(directory, `${name}-${width}.png`), fullPage: true });
    screenshots++;
  }
  async function signIn(token) {
    await page.goto(base);
    await page.evaluate(value => value ? localStorage.setItem('meo_session_token', value) : localStorage.removeItem('meo_session_token'), token);
    await page.reload();
    if (token) {
      try { await page.locator('.main-layout').waitFor({ timeout: 10000 }); }
      catch (error) {
        console.error('Design sign-in failed:', { width: page.viewportSize()?.width, title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 500) });
        throw error;
      }
    }
    else await page.locator('[data-market-filter-form="landing"]').waitFor();
  }
  for (const width of [1440, 768, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await signIn(null);
    if (width >= 981) {
      const filterBox = await page.locator('.market-home .filter-panel').boundingBox();
      const jobsBox = await page.locator('.market-home .market-job-list').boundingBox();
      assert.ok(filterBox && jobsBox && filterBox.y + filterBox.height <= jobsBox.y + 1, 'Landing filters must sit above vacancy results without overlap');
    }
    await capture('home', width);
    if (width < 981) {
      await page.locator('[data-filter-open]').click();
      await page.locator('.filter-drawer[open]').waitFor();
      await capture('filters', width);
      await page.keyboard.press('Escape');
      await page.locator('.filter-drawer').waitFor({ state: 'detached' });
      await page.locator('[data-filter-open]').click();
      await page.locator('.filter-drawer input[data-market-filter="query"]').fill('armazem');
      await page.locator('.filter-drawer button[type="submit"]').click();
      await page.locator('.filter-drawer').waitFor({ state: 'detached' });
      assert.ok(await page.locator('.job-card').count());
    }
    for (const mode of ['login', 'worker', 'company']) {
      if (width < 981) await page.locator('[data-action="toggle-public-menu"]').click();
      await page.locator('[data-auth-preset="login"]').first().click();
      await page.locator(`[data-auth-mode="${mode}"]`).click();
      await page.locator('.auth-modal').waitFor();
      await capture(`auth-${mode}`, width);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('.auth-modal'))), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.auth-modal').count(), 0);
    }
    for (const [name, route] of [['job', jobPath], ['company-public', companyPath], ['location', '/empregos/alpiarca'], ['client-access', '/cliente'], ['missing-job', '/vagas/nonexistent']]) {
      await page.goto(base + route);
      await page.locator('h1, h2').first().waitFor();
      await capture(name, width);
    }
    for (const [role, tabs] of [['worker', ['jobs', 'profile', 'applications', 'saved', 'messages', 'settings']], ['company', ['jobs', 'company', 'create', 'applications', 'candidates', 'messages']], ['admin', ['admin']]]) {
      await signIn(accounts[role]);
      for (const id of tabs) {
        if (width < 981) await page.locator('.mobile-recruitment-menu > summary').click();
        await page.locator(`${width < 981 ? '.mobile-recruitment-menu' : '.sidebar'} [data-recruitment="tab"][data-id="${id}"]`).click();
        await page.locator(`[data-recruitment="tab"][data-id="${id}"][aria-current="page"]`).first().waitFor({ state: 'attached' });
        if (id === 'admin') { await page.locator('[data-recruitment="load-admin"]').click(); await page.locator('[data-recruitment-form="admin"]').first().waitFor(); }
        if (id === 'candidates') {
          await page.locator('[data-recruitment-form="candidate-filter"] button').click();
          if (await page.locator('.job-card details').count()) await page.locator('.job-card details').first().evaluate(el => el.open = true);
        }
        if (id === 'jobs' && role === 'worker') await page.locator('.notifications').evaluate(el => el.open = true);
        await capture(`${role}-${id}`, width);
      }
    }
    await signIn(accounts.company);
    for (const view of ['dashboard', 'orders', 'tasks', 'team', 'history']) {
      if (width < 981) await page.locator('.mobile-workspace-menu').evaluate(el => el.open = true);
      await page.locator(`.nav [data-view="${view}"], .mobile-nav [data-view="${view}"]`).filter({ visible: true }).first().click();
      await page.locator('.view-heading').waitFor();
      await capture(`operations-${view}`, width);
      if (view === 'tasks') {
        await page.locator('[data-open-task]').first().click();
        await page.locator('.detail-panel').waitFor();
        await capture('operations-task-detail', width);
        await page.keyboard.press('Escape');
        await page.locator('.detail-panel').waitFor({state:'detached'});
      }
    }
    await signIn(accounts.client);
    for (const view of ['project', 'mvp']) {
      if (width < 981) await page.locator('.mobile-workspace-menu').evaluate(el => el.open = true);
      await page.locator(`.nav [data-view="${view}"], .mobile-nav [data-view="${view}"]`).filter({ visible: true }).first().click();
      await page.locator('.private-project-shell, .mvp-stage').first().waitFor();
      await capture(`private-${view}`, width);
    }
  }
  assert.deepEqual(errors, [], 'Design review browser/asset errors');
  fs.writeFileSync(path.join(directory, 'contrast.json'), JSON.stringify(contrastIssues, null, 2));
  assert.deepEqual(contrastIssues, [], 'Text contrast below AA on reviewed desktop screens');
  await context.close();
  console.log(`design: ${screenshots} screenshots; desktop/tablet/360/390/430px; filters, modal keyboard, public, worker, company, admin and operations passed`);
}

module.exports = { reviewDesign };
