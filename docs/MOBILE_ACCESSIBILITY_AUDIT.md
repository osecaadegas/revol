# Auditoria de acessibilidade e layout móvel — 18-11-2026

## Âmbito e método

Foi inspecionada a aplicação existente em `public/`, sem alterar rotas, permissões ou dados de produção. A verificação visual utilizou Chrome em 320 × 700, 390 × 844 e 768 × 900 px, com contas de teste locais. Foram percorridos a página pública, entrada na conta, mercado, CV, tarefas, conversas, planeamento e presenças/justificações. Também foram revistos os componentes partilhados de navegação, formulários, filtros, detalhes de tarefa e conversas, a estrutura de títulos e os nomes acessíveis dos controlos encontrados.

## Achados corrigidos

| Área | Problema observado | Correção |
| --- | --- | --- |
| Página pública | Título cortado em largura de telemóvel e campos de pesquisa com 34 px de altura | Tipografia fluida e campos com pelo menos 44 px |
| Cabeçalhos público e autenticado | Desapareciam ao deslocar o conteúdo | Cabeçalhos fixos, com espaço reservado no conteúdo |
| Atalhos inferiores | Legendas pequenas e área de toque curta | Alvos de pelo menos 52 px, texto adaptado à largura e zona segura do dispositivo |
| Tarefas | Dois títulos principais e filtros sem nome acessível | Um título principal e rótulos de acessibilidade para pesquisa, estado e responsável |
| Formulários | Alguns campos móveis podiam provocar zoom automático no iOS | Altura mínima de 48 px e texto de 16 px nos campos principais |
| Conversas | Formulários e opções secundárias ocupavam o primeiro ecrã; atualização periódica redesenhava a conversa sem novidades | Opções recolhíveis e atualização visual apenas quando há dados novos |
| Detalhes | Cabeçalho de detalhe podia desaparecer no scroll interno | Cabeçalho de detalhe fixo dentro do painel |

## Verificação e limites

Nos ecrãs locais inspecionados não houve deslocação horizontal do documento a 320, 390 ou 768 px. A barra inferior e o cabeçalho mantiveram-se visíveis enquanto o conteúdo se deslocava. A interface mantém botões nativos, `<details>` e foco visível para utilização por teclado e tecnologias de apoio. Os fluxos de servidor e as permissões continuam cobertos pelos testes existentes.

Esta auditoria não constitui uma certificação WCAG nem substitui ensaios com VoiceOver/TalkBack em dispositivos físicos. As conversas com fotografias e os estados de contratempo requerem ainda verificação funcional em dispositivo real com contas atribuídas e dados de produção. O comportamento da versão publicada depende da conclusão do deployment e da atualização da cache PWA.
