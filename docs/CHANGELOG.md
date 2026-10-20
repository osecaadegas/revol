# Changelog

## 2026-10-20

- No espaço do trabalhador, o botão «Tarefas» fica vermelho enquanto existir
  um contratempo ativo. Quando a empresa o resolve, passa a verde para avisar
  que o trabalho pode continuar; ao abrir Tarefas, o aviso fica confirmado e
  o botão recupera a cor normal. O estado é atualizado automaticamente e a
  confirmação fica guardada apenas no navegador do trabalhador.
- Reduzidos pedidos em série no arranque autenticado e nas conversas diretas:
  o mural público só carrega quando necessário e as respostas existentes da
  API alimentam a lista após leitura/envio. Os ficheiros JavaScript/CSS
  versionados usam compressão Brotli/Gzip e cache de navegador; HTML, API,
  recursos sem versão e service worker continuam atualizáveis. A verificação
  inicial do esquema Supabase é reutilizada apenas dentro do mesmo processo,
  sem cache de dados privados. A regressão em ecrãs pequenos identificou e
  corrigiu a exposição das opções do menu móvel fechado. Os testes cobrem a
  negociação de compressão/cache, o arranque autenticado, a abertura de chat
  e a recuperação de uma verificação de esquema falhada. Sem migração nem
  alteração de permissões.
- A configuração da Vercel replica a cache longa apenas para JavaScript/CSS
  da aplicação pedidos com `?v=`. A produção serve estes ficheiros diretamente,
  sem passar pelo servidor Node; os recursos sem versão, o service worker,
  o HTML e a API mantêm atualização normal.
- Os três atalhos móveis do trabalhador mantêm-se fixos em todas as áreas e
  também no detalhe de uma tarefa; navegar pelo detalhe fecha-o. A barra já
  não depende de um vínculo ativo: sem vínculo, Perfil abre o CV e Tarefas
  apresenta o estado vazio. Não há alteração de permissões nem de dados.
- No telemóvel, a navegação do trabalhador passa para um menu no topo e uma
  barra fixa com Perfil, Tarefas e Conversas; as outras áreas e a saída ficam
  no menu, fechado por defeito. O histórico no detalhe da tarefa também fica
  recolhido por defeito e apresenta acontecimentos em linguagem legível, sem
  IDs internos nem nomes de campos técnicos. Sem alteração de dados ou API.
- O Perfil do trabalhador explica a entrada e saída em linguagem simples. Após
  a empresa resolver um contratempo, o trabalhador recebe um aviso contextual
  com acesso direto à tarefa; a página verifica o estado enquanto o trabalhador
  usa a área do trabalhador e ao regressar ao separador. Não há notificações
  push nem migração nova: o aviso usa a resolução já auditada na tarefa.
- O histórico de acessos no percurso do trabalhador fica recolhido por defeito,
  mas continua disponível para consulta e exercício de direitos. Ao abrir, as
  ações e finalidades aparecem em português em vez de códigos internos.
- O Perfil do trabalhador apresenta agora entrada, justificação e saída em
  três botões numa linha, com cores e estados distintos. A justificação
  privada só abre quando é pedida; a escolha de tarefa, os registos recentes,
  a validação e a informação de privacidade mantêm-se disponíveis.
- A empresa pode resolver um contratempo ativo na tarefa com uma descrição
  obrigatória da solução. Só essa ação autorizada permite retomar o trabalho;
  motivo original, resolução, autor e data ficam no histórico auditável e
  visíveis ao trabalhador. O alerta prioritário desaparece após a resolução.
- A categoria inteira «Tarefas» pisca alternadamente a vermelho e azul
  enquanto a empresa tiver contratempos ativos, incluindo no menu móvel. O
  aviso usa o estado real dos alertas, cessa quando estes são resolvidos e
  mantém um destaque vermelho estático se o utilizador reduzir movimento.
- As ordens podem agora ser criadas juntamente com uma tarefa, equipa,
  início, prazo e morada. A operação gera uma tarefa individual por membro;
  coordenadas fixas da obra são opcionais. O trabalhador com vínculo ativo
  confirmado abre num novo Perfil, onde consulta tarefas e avaliações por
  empresa, marca entradas/saídas factuais e envia justificações privadas em
  PDF, PNG ou JPEG. Responsáveis consultam registos e justificações no painel.
  A verificação de assiduidade por GPS permanece desativada até validação
  jurídica e DPIA. A migração `20261020180000_work_attendance_and_justifications.sql`
  é necessária para os novos registos; até lá o resto do site mantém-se
  operacional e as novas ações aparecem indisponíveis.
- Os contratempos ativos passaram a alertas operacionais de prioridade alta no
  painel da empresa: faixa vermelha persistente em todas as áreas, contador na
  navegação de tarefas (também em telemóvel), título do separador com aviso,
  acesso direto à tarefa e lista completa no painel. O alerta acompanha o
  estado real da tarefa e desaparece quando o trabalho retoma; não exige SQL.
  Corrigida também a listagem de várias ordens no painel privado, encontrada
  durante a regressão visual.
- Corrigida a apresentação em telemóveis: o painel ocupa agora a largura toda
  quando a barra lateral desaparece, a navegação de recrutamento fica contida
  num único menu recolhível sem duplicações, e o cabeçalho e os avisos adaptam-se
  a ecrãs estreitos. Indicadores dispostos em duas colunas e contraste de textos
  secundários melhorado. Atualizada a versão dos recursos e da cache offline
  para disponibilizar as correções aos dispositivos já instalados.
- Iniciada a Fase 1 do Cliente Zero nas ordens existentes: criação com equipa
  atribuída e datas previstas, consulta direta pela equipa mesmo sem tarefas,
  estados próprios com motivos obrigatórios para contratempos/rejeições, datas
  reais e auditoria. A migração SQL é aditiva e não altera o recrutamento.
- Os alertas de contratempos da empresa atualizam-se automaticamente enquanto
  o painel está aberto e ao regressar ao separador, sem apagar formulários em
  curso. Uma rota autenticada e limitada à empresa devolve só os seus alertas;
  abrir um alerta atualiza a tarefa antes de a mostrar. Não é necessária uma
  migração SQL adicional para esta notificação: usa o estado e a razão já
  existentes na tabela de tarefas.
- Criado um menu móvel de recrutamento com a secção atual, acesso às áreas de
  trabalhador e empresa e indicadores de tarefas, vínculos e conversas. Em
  ecrãs estreitos, a navegação operacional e a escala de avaliações adaptam-se
  à largura disponível sem scroll horizontal.
- A ação `Bloquear` das tarefas passou a chamar-se `Contratempo`. A razão é
  obrigatória no cliente e no servidor; enquanto a tarefa estiver parada, a
  empresa recebe no painel um alerta com colaborador, obra, tarefa, data e razão.
  Ao retomar o trabalho o alerta ativo desaparece, mantendo-se o evento no
  histórico de auditoria.
- Os comentários opcionais de cada pergunta de avaliação ficam agora
  recolhidos por defeito e abrem apenas através de `Adicionar comentário`.
  O controlo é acessível, permite voltar a ocultar o campo sem perder o texto
  introduzido e abre automaticamente comentários já guardados num rascunho.
- Removida a introdução manual do início/fim da avaliação: o servidor regista
  automaticamente o dia atual em Portugal e rejeita uma segunda avaliação do
  mesmo vínculo na mesma data, mesmo que o pedido tente enviar outras datas.
- Adicionado um seletor de categorias ao formulário de avaliação. Apenas uma
  categoria fica visível de cada vez, mantendo todas as respostas no mesmo
  formulário e reduzindo o scroll; cartões, escalas e campos opcionais também
  foram compactados.
- Simplificado o cartão de cada critério para apresentar a pergunta, a escala
  0–10 imediatamente por baixo e o comentário opcional no fim. O campo de
  comentário começa agora compacto, com redimensionamento vertical disponível.
- Melhorada a escala 0–10 com explicações dos extremos e comentário em largura
  total. As opções começam neutras e só recebem a cor própria ao passar o rato,
  focar com teclado ou selecionar; a opção escolhida conserva a cor.
- Removido `Pedidos de acesso` da navegação normal das empresas enquanto a
  partilha de avaliações entre empresas está desativada. O bloqueio no servidor,
  o registo protegido e os direitos de acesso/contestação do trabalhador são
  preservados sem apresentar um formulário de partilha fora de contexto.
- Tornadas imutáveis as avaliações profissionais depois da submissão. A API
  rejeita alterações por `reportId`, substituições e correções da classificação;
  uma avaliação posterior exige um novo registo com período diferente. Pedidos
  do trabalhador continuam rastreáveis sem reescrever respostas do empregador.
- Substituídos os campos numéricos das avaliações por uma escala visual 0–10
  com onze opções coloridas, seleção explícita, estado sem classificação e ação
  para limpar. A escala mantém comentários opcionais, teclado, leitores de ecrã
  e disposição responsiva em telemóvel.
- A área existente de mensagens de candidaturas e entrevistas passou a chamar-se
  `Correspondência`, preservando o seu histórico e comportamento.
- Adicionada a área independente `Conversas`, com conversas diretas persistentes
  entre um trabalhador e um membro específico de uma empresa com vínculo
  verificado. Direção, administração e restantes contactos aparecem separados.
- Cada conversa só pode ser lida e utilizada pelo trabalhador e pelo membro da
  empresa selecionado; outros membros e empresas recebem uma resposta neutra de
  recurso inexistente. Envios e leituras relevantes ficam no histórico de auditoria.
- Adicionadas notificações de não lidas, recibos de leitura, atualização periódica,
  limite de envio, estados vazios/erro e layout responsivo em duas colunas.
- Adicionada a migração `20261020160000_direct_worker_company_chat.sql` e testes
  de isolamento entre Direção/Administração e empresas sem vínculo.
- Simplificado o planeamento de tarefas para pedir apenas a morada do trabalho,
  removendo latitude, longitude e captura GPS deste formulário.
- O detalhe da tarefa apresenta agora ao trabalhador um Google Maps incorporado
  e uma ligação externa, ambos gerados a partir da morada guardada. O GPS das
  fotografias de prova permanece separado e inalterado.
- Corrigido o menu lateral para aplicar o fundo verde-amarelo apenas à secção
  atualmente aberta; `Criar vaga` deixa de aparecer ativo noutras áreas.
- Simplificadas as respostas das avaliações profissionais para uma classificação
  inteira de 0 a 10 e um comentário sempre opcional, sem valor pré-selecionado.
- Mantida a definição de escala guardada nas avaliações antigas, para que o
  histórico 1-5 continue a ser apresentado com o significado original.
- Adicionada a migração `20261020123000_evaluation_rating_scale_0_10.sql` e
  testes para zero, limite superior, comentários vazios e médias padrão.
- Corrigida a landing page pública para apresentar os filtros de vagas numa
  barra horizontal acima dos resultados em desktop, eliminando a sobreposição
  entre os campos e o primeiro cartão de vaga.
- Adicionada uma verificação visual da ordem e separação entre filtros e vagas
  na landing page desktop.
- Adicionado o separador `Tarefas` ao perfil do trabalhador quando recebe uma
  tarefa, com contador de tarefas ativas e acesso ao fluxo existente de
  execução, provas e validação.
- Empresas podem atribuir tarefas a trabalhadores externos apenas quando
  existe um vínculo verificado com a própria empresa; a tarefa conserva o ID
  desse vínculo e continua isolada de empresas não relacionadas.
- O planeamento de tarefas passa a guardar início previsto, notas, morada e
  coordenadas GPS fixas, visíveis no cartão e detalhe da tarefa com ligação ao
  mapa. Não foi adicionado rastreamento contínuo.
- Adicionada a migração `20261020090000_worker_task_planning.sql` e cobertura
  de autorização para atribuição válida, tentativa por empresa sem vínculo e
  visibilidade restrita do trabalhador.
- Removido o overflow horizontal do sidebar autenticado, incluindo o elemento
  decorativo que podia alargar a área rolável; os botões passam a respeitar a
  largura disponível mesmo com títulos maiores.
- As categorias do sidebar usam agora superfícies claras com texto e ícones
  pretos, mantendo o verde-lima para o estado ativo e melhorando o contraste.
- Corrigida a especificidade do layout dos filtros de vagas autenticados: em
  desktop a barra ocupa agora toda a largura acima dos resultados, sem
  sobreposição com os cartões; tablet e mobile mantêm os comportamentos
  responsivos existentes.
- Adicionada uma verificação visual automática da ordem vertical entre filtros
  e resultados no fluxo autenticado do trabalhador.
- Adicionado um aviso persistente no painel do trabalhador quando existe um
  vínculo de emprego por confirmar, com acesso direto ao pedido.
- O separador `Percurso profissional` passa a mostrar um contador de pedidos e
  os vínculos pendentes também aparecem na lista geral de notificações até o
  trabalhador confirmar ou recusar.
- Corrigida a criação de vínculos profissionais em curso: uma data de fim
  opcional vazia passa a ser persistida como `NULL`, evitando o erro de tipo
  `date` no Supabase.
- Adicionada cobertura de regressão para garantir que vínculos sem data de fim
  continuam ativos e são compatíveis com a persistência de produção.

## 2026-10-20 - Platform administrator email allowlist

- Added a server-only, case-insensitive `PLATFORM_ADMIN_EMAILS` allowlist while
  preserving the existing administrator ID allowlist.
- Documented the production configuration and added authorization regression
  coverage for email-based platform administrators.

## 2026-10-17 - Industrial Workshop Visual System

- Reworked the existing TrataPro public marketplace, authentication surfaces,
  company/worker dashboards, Digital CV and professional-history interfaces
  with a warm paper, black ink and high-visibility lime visual language.
- Added the compact industrial wordmark, construction-tape dividers, hard
  offset shadows, monospaced labels, squared controls and paper-grain texture.
- Preserved all existing routes, forms, data flows, permissions and private
  evaluation boundaries; this release contains no schema or API change.
- Added responsive adaptations for the public navigation, search, cards,
  dashboard rail, mobile navigation, modals and dense professional forms.
- Integrated native selects, advanced-filter disclosures and mobile dropdown
  menus into the same workshop visual system with accessible focus and open
  states.
- Replaced browser-native vacancy datalists with branded keyboard-accessible
  autocomplete panels so location and role suggestions retain the site design.
- Moved desktop vacancy filters into a horizontal bar above the results, while
  retaining the compact filter drawer on tablet and mobile layouts.

## 2026-10-17 - Percurso Profissional e Avaliações

- Expanded confidential employer assessments to the 25 requested standard
  questions, grouped into seven professional categories with scores 1-5,
  `Não observado` and `Não aplicável`.
- Added factual explanations for low scores, standard-only category averages,
  scored-answer counts and `Sem dados suficientes` handling.
- Added company questions, immutable question/scoring snapshots, private drafts,
  assessment periods, duplicate prevention and audited correction versions.
- Added a responsive chronological company/worker timeline, expanded answers,
  factual shift/weekend/overtime/travel records, strengths and improvement areas.
- Preserved verified-employment eligibility, originating-company ownership,
  worker disputes/data access, audit logging, retention and disabled-by-default
  cross-company sharing.
- Added migration `20261017073331_professional_evaluation_history.sql`, updated
  the reset schema and expanded `test:professional` authorization/regression coverage.

## 2026-10-13 - Unique Registration NIF

- Added a required Portuguese NIF field to trabalhador and company registration,
  including the Google trabalhador registration path.
- Added checksum validation and server-side duplicate protection across worker
  and company accounts.
- Kept Google-registration NIF data out of OAuth state by using a short-lived,
  signed, HttpOnly same-site cookie for the callback.
- Added nullable canonical NIF columns for existing records, partial unique
  indexes and a cross-table transaction-safe Supabase uniqueness trigger.
- Kept NIF values out of public worker profiles, vacancy search and public CVs.
- Clear the worker NIF when an account is deleted so the same person can create
  a replacement account without leaving two active identities.
- Added registration regression coverage for invalid and duplicate identifiers.

## 2026-10-13 - Digital CV And Verified Employment

- Added a versioned multi-step Digital CV with preview, private PDF/DOCX
  documents, confirmation-only extraction suggestions and PDF export.
- Added stable worker CV IDs, verified employment relationships, bilateral
  confirmation and chronological verified-history display.
- Added verified-employer structured evaluation reports with attributable
  authors, factual shift experience, worker responses and no aggregate score.
- Added disputes/corrections, data-rights workflows, access requests/history,
  report-view auditing, review expiry and retention redaction.
- Kept cross-company evaluation visibility disabled pending an independently
  reviewed GDPR DPIA and authorization validation.
- Added migration `20261013070041_digital_cv_employment_history.sql`, updated
  the clean-reset schema and added `npm run test:professional` authorization
  coverage.

## 2026-10-07 - Consistent Dark Frontend

- Applied a shared dark/blue design system to public discovery, worker/company
  recruitment, authentication, moderation, operations and private client views.
- Added local Inter/Lucide assets, compact salary-first vacancy cards, desktop
  filter columns, a keyboard-accessible mobile filter drawer, single responsive
  recruitment navigation and a sticky mobile vacancy application action.
- Preserved existing API behavior and forms. No migration or environment change.
- Added extended responsive/contrast/browser verification and documented the
  implementation and review limitations in `docs/FRONTEND_DESIGN.md`.

## 2026-10-07

- Added recruitment workspaces, structured preferences, private CV documents,
  saved jobs/searches, screening, application history, candidate search/matching,
  messaging/interviews, company verification, reporting and moderation.
- Replaced broad published-profile exposure with explicit visibility controls
  and limited verified-employer discovery. Added account export/deletion.
- Server-rendered the homepage, company pages and useful search landing pages;
  added readable vacancy URLs, actual salary/deadline schema and expired pages.
- Added transactional Supabase writes with stale-edit protection, paginated
  reads, safe error responses, upload checks and same-origin mutation checks.
- Fixed service-worker activation navigation and simplified mobile recruitment.
- Added recruitment API/browser tests. See `docs/RECRUITMENT_UPGRADE.md` for
  deployment configuration, verification scope and remaining work.

## 2026-08-25

- Marked `/cliente` as a reserved noindex access gate and removed it from the generated sitemap.
- Added a branded `social-card.svg` preview image with Open Graph and Twitter large-image metadata on the public shell and vacancy detail pages.
- Changed unknown static-like paths such as `/data/*` to return noindex 404 pages instead of the homepage.
- Added baseline security/privacy headers across app, API, static and private media responses, including Vercel static-asset header configuration.
- Bumped the public shell cache and smoke coverage for SEO hardening behavior.

## 2026-08-17

- Added protected scheduled maintenance endpoint `/api/cron/operational-maintenance`.
- Added Vercel Cron scheduling for daily evidence cleanup, validation auto-approval and validation reminder generation.
- Added manager dashboard validation reminder cards for tasks waiting on the 12-hour employer approval window.
- Added `CRON_SECRET` setup documentation and smoke coverage for cron authorization and reminder alerts.
- Simplified the public landing page into a cleaner search-first vacancy page with featured jobs, market summary, company/trabalhador calls to action and a refreshed shell cache.
- Added large dropdown suggestion menus for public cargo/function and location vacancy filters while preserving free-text search.
- Added trabalhador CV profiles with private profile photos, birth dates, skills, previous experience, references, application gating, company-visible profile cards and Supabase profile indexing.
- Simplified public login/register by moving trabalhador, company and login forms into a topbar-triggered modal and removing the large inline auth panel.
- Made the public topbar account entry explicit as `Login / Registar` and restyled it so visitors can immediately find the login/register modal.
- Renamed public-facing `worker` labels to `Trabalhador` while keeping the internal role, API paths and Supabase schema stable.
- Added SEO core routes with dynamic canonical metadata, `robots.txt`, `sitemap.xml`, server-rendered public vacancy detail pages and JobPosting structured data.
- Reorganized the authenticated trabalhador marketplace into a cleaner workspace with summary stats, full-width filters, a clearer vacancy area and structured CV sections.
- Added the `TrataPro` public brand with slogan `Trabalho certo. Prova feita.`, a new `TP` logo mark, refreshed metadata, PWA manifest and branded evidence watermark text.
- Added a visible `TrataPro` horizontal logo asset to the public header and server-rendered vacancy pages, and replaced text-only shell badges with the SVG icon.

## 2026-08-12

- Added GPS-required final task evidence with at least three authenticated photos before validation.
- Added evidence metadata for capture/upload time, GPS, SHA-256 hash, authenticity checks and seven-day retention expiry.
- Added 12-hour employer validation deadlines with automatic approval after expiry.
- Added authenticated watermarked evidence downloads with visible and embedded structured metadata, plus audit entries for downloads and retention deletion.
- Added Supabase migration `20260812000000_evidence_validation_retention.sql` and updated reset/current schema SQL.

## 2026-08-11

- Increased public homepage background visibility on large screens with stronger animated network lanes, higher contrast grid motion, translucent landing cards and a fresh app-shell cache version.
- Added Google OAuth login for existing accounts plus trabalhador-only Google self-registration, with server-side callback handling and setup documentation.
- Added a more alive public interface with wider desktop search/filter controls, animated surface grid, header signal motion, card entrance states and service-worker cache bump.
- Modernized the public job-network UI with a cleaner 2026-style surface, stronger hierarchy, refined search/feed cards, improved auth tabs and clearer candidate/company entry points.
- Fixed stale public pages after deploy by replacing the service worker cache-first shell with network-first fetching, bumping the shell cache and disabling server cache for app shell files.
- Added a more LinkedIn-like landing surface with a compact top search, candidate profile entry card, central job search card and company hiring card.
- Reworked the public homepage into a LinkedIn-style vacancy feed with first-screen search, quick filters, result counts, job cards and trabalhador/company account actions.
- Kept project/client/developer information out of the public homepage and left `/cliente` as the reserved project access route.
- Repositioned the public application as MANIFESTO, a professional engineering project portal.
- Added public routes for `/cliente` and `/changelog`.
- Added structured UI data for phases, roadmap, modules, requirements, acceptance criteria, deliverables, documentation groups, change requests, feedback and versions.
- Added responsive technical design system, mobile public navigation, responsive requirement table cards and MANIFESTO metadata/PWA branding.
- Added `npm run build` as a deploy-time validation script for the Node serverless app.
- Added `docs/AUDIT.md` with product, UX, architecture and remaining-dependency findings.
- Restricted public project information to a client access gate and moved status, roadmap, modules, requirements, documentation and changelog into the authenticated `Projeto` workspace tab.
- Moved private project dashboard content out of the public JavaScript bundle and behind authenticated `/api/project/private`.
- Added the private `MVP` workspace tab for the active `Desenvolvimento do MVP` phase with authenticated server-rendered readiness checks for marketplace, accounts, tasks, evidence and audit.
- Added first-class `client` and `developer` roles and restricted private `Projeto` / `MVP` access to those roles.

## 2026-08-10

- Created the Phase 1 webapp in the repository root from the PDF requirements.
- Added no-dependency Node API with authentication, sessions, role checks, local persistence, private upload storage, and audit logging.
- Added mobile-first static frontend with setup, login, dashboard, work orders, tasks, evidence upload, validation, team management, invite links, and history.
- Added PWA manifest and shell service worker.
- Added setup guide, progressive build plan, requirements trace, API documentation, and future-agent notes.
- Added same-origin HttpOnly session cookie support so private evidence images and JSON export work in the browser while API bearer tokens remain supported.
- Added Supabase Postgres/Storage backend support with migration, private bucket, RLS-enabled tables, environment configuration, and selectable `APP_STORAGE_DRIVER`.
- Added active storage driver reporting to `/api/health`.
- Corrected product concept to a public vacancy marketplace: visible job offers, trabalhador registration/application flow, company registration/vacancy creation flow, application review, new Supabase marketplace migration, and updated smoke coverage.
- Improved the homepage into a public-first job board with keyword, cargo/function, location, and radius filters, plus a dedicated vacancy `position` field and Supabase migration for company postings.
- Added an admin Supabase reset script and documentation to remove old unprefixed prototype tables and recreate the current `meo_*` schema.
- Declared the Node server entrypoint in `package.json` and documented Vercel deployment settings.
- Added a root Vercel serverless adapter so Vercel invokes the request handler directly instead of importing the local server module shape.
- Made the public jobs endpoint degrade to an empty board with a setup warning when Supabase schema/configuration is incomplete.
