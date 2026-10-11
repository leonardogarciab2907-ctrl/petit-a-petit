# Plano do App de Francês

10/10/2026 (cópia do plano aprovado pelo usuário; desvios em `arquitetura.md`)

## Objetivo

Um app de celular para, em cerca de 10 minutos por dia, aprender as palavras mais usadas do francês e ganhar familiaridade com a construção e a compreensão de frases básicas. O foco são os pilares da língua: artigos, pronomes, verbos essenciais, negação e perguntas.

O app ensina 8 palavras novas por dia, sempre dentro de frases curtas que usam só palavras já estudadas. Um algoritmo de repetição espaçada (FSRS) traz cada palavra de volta pouco antes de você esquecê-la. As 1.000 palavras previstas levam cerca de 4 meses.

Nome provisório: **Petit à Petit** ("pouco a pouco").

## Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Formato | App web instalável (PWA), pensado primeiro para o celular |
| Memorização | FSRS com meta de retenção de 90% |
| Ritmo | 8 palavras novas por dia, mais todas as revisões do dia |
| Duração | Meta por quantidade; o app mostra a estimativa em minutos e reduz as novas se passar de 15 min |
| Ordem das palavras | Frequência de uso, das mais comuns para as menos comuns |
| Frases | Frases só com palavras já estudadas, cartões de pilar e montar a frase; trocar uma peça e traduzir frase na fase 2 |
| Exercícios | Os seis tipos, organizados numa escada de dificuldade |
| Acentos | Resposta sem acento conta como acerto, mostrando a forma certa |
| Áudio | Voz do próprio celular em francês (fr-FR), grátis e offline |
| Falar | Reconhecimento de voz do celular, com botão "pular" sem penalidade |
| Motivação | Gráfico do histórico de estudo |
| Lembrete | Evento diário no calendário ou nos lembretes do celular, fora do app |
| Dados | Nuvem com login (Supabase), funcionando offline e sincronizando depois |
| Login | Link mágico enviado por e-mail |
| Visual | Minimalista, azul, branco e vermelho, modo escuro automático, interface em português |
| Nível | Botão "já conheço" para pular palavras que o usuário já sabe |
| Construção | Em 3 fases, a primeira já usável no dia a dia |

## A sessão diária

Cada dia tem uma meta fechada: todas as revisões vencidas mais 8 palavras novas. Antes de começar, a tela inicial mostra o tamanho do dia, por exemplo "Hoje: 25 revisões + 8 novas · ≈ 11 min".

1. **Revisões:** as palavras vencidas, das mais atrasadas para as menos atrasadas, cada uma no exercício do seu nível na escada.
2. **Palavras novas:** cada uma aparece com artigo, áudio, tradução, pronúncia aproximada e 1 ou 2 frases. Se ela abre um pilar, o cartão do pilar vem antes.
3. **Mini quiz:** as palavras novas de hoje em exercícios rápidos de reconhecimento.
4. **Fim:** acertos, tempo, palavras novas e o gráfico atualizado.

Regras: estimativa = revisões × 10 s + novas × 40 s + 90 s de quiz (depois de 7 dias, média real do usuário); teto de 15 min reduz as novas (até zero, com aviso); no máximo 80 revisões por sessão (o resto fica para o dia seguinte, começando pelas de maior risco de esquecimento); palavra errada volta no fim da mesma sessão até um acerto; "já conheço" tira da fila e puxa a próxima; se o app fechar, a sessão continua de onde parou; o dia conta como feito quando a meta termina.

## Escada de exercícios

Palavra nova → Nível 1 (Reconhecer) → 2 acertos seguidos → Nível 2 (Lembrar) → 2 acertos seguidos → Nível 3 (Produzir). Um erro desce um nível. O FSRS continua decidindo quando a palavra volta.

| Nível | Objetivo | Exercícios |
| --- | --- | --- |
| 1. Reconhecer | Entender ao ver ou ouvir | Francês → português (revelar); ouvir e escolher |
| 2. Lembrar | Achar a palavra entre opções ou no contexto | Múltipla escolha português → francês; completar a frase com opções |
| 3. Produzir | Escrever ou dizer sem ajuda | Português → francês digitando; montar a frase; falar |

Subir: 2 acertos seguidos (Bom ou Fácil); Difícil mantém o nível. Descer: um erro desce um nível, nunca abaixo do 1. Falar: só no nível 3 e só se o celular reconhecer voz em francês; "pular" não conta.

| Situação | Nota |
| --- | --- |
| Revelar | O usuário escolhe: Errei, Difícil, Bom ou Fácil |
| Corrigido pelo app, certo | Bom |
| Certo, só faltaram acentos | Bom, com os acentos destacados |
| Palavra certa com artigo errado ou faltando | Difícil, com o artigo certo destacado |
| Errado | Errei |
| Ajuste opcional depois da correção | "foi difícil" ou "foi fácil" trocam a nota |

## Frases e pilares

Cada frase usa só palavras já vistas mais a nova (formas conjugadas contam como a palavra base). Nos primeiros dias, a frase pode ter 1 palavra-ponte ainda não estudada, mostrada com tradução. Na fase 1, frases de 3 a 8 palavras. Um script de validação confere a regra antes de cada publicação.

Pilares da fase 1: artigos definidos e gênero; elisão; pronomes pessoais; être; avoir; negação; contrações (du, au); artigos indefinidos; perguntas (est-ce que); verbos em -er; aller e futuro próximo; faire; possessivos; adjetivos (concordância e posição); preposições básicas; pouvoir/vouloir/devoir + infinitivo. Quando um pilar aparece pela primeira vez, um cartão com 3–4 linhas e 2 exemplos vem antes da palavra; depois o pilar entra na revisão.

Exercícios de frase — fase 1: montar a frase (no nível 3 com 1 palavra extra de distração) e completar a frase. Fase 2: trocar uma peça e traduzir a frase inteira.

## Conteúdo

Lista de 1.000 palavras em ordem de frequência, 300 na fase 1. Arquivos JSON dentro do app, versionados; o banco guarda só o progresso. Contar por palavra base; famílias de palavras-ferramenta juntas (le/la/les, un/une/des, mon/ma/mes, ce/cette/ces); sem nomes próprios, interjeições e palavrões; substantivos sempre com artigo e gênero. Pronúncia aproximada para brasileiros (ü, u, ö, ã, õ, ẽ, uá, x, r, consoante final muda não se escreve). Validador + segunda passada crítica; na fase 2, botão "reportar erro".

## Arquitetura

React + Vite + TypeScript + Tailwind; vite-plugin-pwa; ts-fsrs (retenção 0,9); IndexedDB via Dexie; Supabase (Postgres, Auth com link por e-mail, RLS); Vercel ligada ao GitHub; Web Speech API (fala e reconhecimento em fr-FR); Recharts. Tabelas: settings, card_state, review_log (só inserções), daily_stats, reports (fase 2), com RLS. Sincronização: grava no aparelho primeiro, fila de envio, review_log por UUID, card_state pelo updated_at mais recente. Correção: minúsculas, sem espaços extras e pontuação, acentos tolerados, apóstrofos iguais, artigo errado = Difícil, variantes `accepted`. Áudio: primeira voz fr-FR, velocidade 0,9, aviso único se não houver voz francesa.

## Telas

Entrar; Início (tamanho do dia, Começar, gráfico de 30/90 dias); Sessão (barra de progresso, cartão grande, botões embaixo, alto-falante em toda palavra e frase); Fim da sessão; Ajustes (novas por dia, retenção, teto de minutos, velocidade do áudio, sair). Visual: claro/escuro conforme o celular, azul principal, vermelho só para erros, botões ≥ 44 px, interface em português.

## Fases

**Fase 1:** PWA com login e sync; FSRS 90%; sessão diária completa; escada níveis 1–3 sem falar; frases, pilares, montar a frase; áudio, correção tolerante, "já conheço"; gráfico; 300 palavras validadas; deploy na Vercel.

**Fase 1 pronta quando:** instalo no celular, abro sem internet e faço a sessão; o progresso aparece no computador; palavra errada volta no fim; "cafe" é aceito e mostra "café"; o validador não acha frase com palavra não estudada; a tela inicial mostra a estimativa.

**Fase 2:** falar no nível 3 com "pular"; trocar uma peça e traduzir a frase; "reportar erro"; até 600 palavras.

**Fase 3:** otimizar parâmetros do FSRS com o histórico; até 1.000 palavras; lista de palavras com busca e status; exportar o progresso.

## O que o usuário precisa fazer

Criar contas no GitHub, no Supabase e na Vercel; copiar as chaves do Supabase indicadas; depois do deploy, abrir o link no celular e "Adicionar à tela inicial".

## Pendências

- Nível atual do usuário: "já conheço" resolve; se souber bastante, um teste de nível na fase 2.
