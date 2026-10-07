function createPublicMarketplace(h) {
  const e = h.htmlEscape;
  const slug = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const companyPath = company => `/empresas/${encodeURIComponent(company.id)}-${slug(company.name)}`;
  function cards(jobs) {
    return jobs.map(job => `<article class="job-card"><h3><a href="${e(h.publicJobPath(job))}">${e(job.title)}</a></h3><p class="job-company">${e(job.companyName)} ${job.verified ? '<span class="verified-badge" title="Empresa verificada pela TrataPro">Verificada</span>' : ""}</p>${job.salary ? `<p class="job-salary">${e(job.salary)}</p>` : ""}<div class="meta-row"><span>${e(job.location)}</span><span>${e(job.contractType || "")}</span><span>${e(job.schedule || "")}</span></div><p>${e(job.description.slice(0, 200))}</p><a class="btn primary" href="${e(h.publicJobPath(job))}">Ver vaga</a></article>`).join("") || '<p class="empty">Ainda nao existem vagas publicadas. Volta em breve para novas oportunidades.</p>';
  }
  function home(db, req) {
    const url = new URL(req.url, "http://localhost");
    const all = h.publicOpenJobs(db), query = url.searchParams.get("q") || "", location = url.searchParams.get("location") || "";
    const jobs = all.filter(j => slug(`${j.title} ${j.companyName} ${j.description}`).includes(slug(query)) && slug(j.location).includes(slug(location)));
    return `${h.renderPublicTopbarStatic()}<main class="market-home"><section class="market-hero"><div class="market-hero-copy"><p class="eyebrow">TrataPro · Emprego em Portugal</p><h1>Emprego em Portugal.</h1><p>Encontra trabalho sem complicacoes. O teu proximo passo comeca aqui.</p></div><form class="market-search-panel" action="/" method="get"><label class="field">Cargo ou palavra-chave<input name="q" value="${e(query)}"></label><label class="field">Localizacao<input name="location" value="${e(location)}"></label><button class="btn primary">Procurar vagas</button></form><div class="market-hero-actions"><a class="btn ghost" href="#vagas">Ver oportunidades</a><a class="btn ghost" href="/?auth=company#acesso">Quero contratar</a></div></section><section class="market-section" id="vagas"><h2>${jobs.length} vagas disponiveis</h2><div class="market-job-list">${cards(jobs.slice(0, 24))}</div></section><section class="market-split-section"><article><h2>Como funciona para trabalhadores</h2><ol><li>Encontra uma vaga</li><li>Candidata-te rapidamente</li><li>Acompanha a candidatura</li></ol></article><article><h2>Encontra quem quer trabalhar.</h2><ol><li>Publica uma vaga</li><li>Recebe candidatos</li><li>Contrata</li></ol><a class="btn primary" href="/?auth=company#acesso">Quero contratar</a></article></section></main>`;
  }
  function company(db, company) {
    const jobs = h.publicOpenJobs(db).filter(j => j.companyId === company.id);
    return `${h.renderPublicTopbarStatic()}<main class="market-home"><section class="market-section"><p class="eyebrow">Empresa</p>${company.recruitment?.logo ? `<img class="company-profile-logo" src="/api/recruitment/company-logo/${encodeURIComponent(company.id)}" alt="Logotipo de ${e(company.name)}" width="96" height="96">` : ""}<h1>${e(company.name)}</h1>${company.recruitment?.verification === "verified" ? '<span class="chip approved">Empresa verificada</span>' : ""}<p>${e(company.location)} · ${e(company.sector)}</p><h2>Sobre a empresa</h2><p>${e(company.description)}</p>${h.safeHttpUrl(company.website) ? `<a href="${e(h.safeHttpUrl(company.website))}" rel="noopener noreferrer">Website da empresa</a>` : ""}${company.recruitment?.benefits ? `<h2>Beneficios</h2><p>${e(company.recruitment.benefits)}</p>` : ""}<h2>Vagas abertas</h2><div class="market-job-list">${cards(jobs)}</div></section></main>`;
  }
  function landings(db) {
    const jobs = h.publicOpenJobs(db), groups = new Map();
    for (const job of jobs) for (const value of [job.location, job.position]) {
      const key = slug(value);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { path: `/empregos/${key}`, title: value, jobs: [] });
      if (!groups.get(key).jobs.some(j => j.id === job.id)) groups.get(key).jobs.push(job);
    }
    return [...groups.values()];
  }
  return { home, cards, company, companyPath, landings };
}
module.exports = { createPublicMarketplace };
