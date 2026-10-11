# Conteúdo

As palavras ficam em `content/palavras/*.txt` (lidas em ordem alfabética do nome do arquivo; a posição na
lista é a ordem de ensino). `npm run conteudo` valida tudo e gera `src/content/words.json` e `pillars.json`.

## Formato de uma palavra

```
## être | verbo | ser, estar | étr | ɛtʁ
formas: suis es est sommes êtes sont été
pilar: p-etre
dica: O mesmo verbo serve para ser e estar.
falso: (falso cognato, opcional)
exibir: (como mostrar, para famílias: le, la, les)
art: (artigo do substantivo quando não dá para deduzir)
> Je suis désolé. | Sinto muito. | Je suis désolée.
```

- Cabeçalho: `lemma | classe | traduções separadas por vírgula | pronúncia BR | IPA`.
- Classe: `m`, `f`, `m pl`, `f pl` (substantivos, com gênero) ou `verbo adj adv pron art prep conj det interj num expr`.
- `formas`: separadas por espaço; use `_` para espaço dentro de uma forma (`est-ce_qu'`). Verbos: as 6 do
  presente na ordem je, tu, il, nous, vous, ils, depois o particípio e outras (os exercícios usam essa ordem).
- Homônimos: marque o lemma com `#` (`le#pron`, `ce#det`). O que vem depois do `#` não aparece para o usuário.
- Frase: `> francês | português | variantes aceitas… | @token=lemma` (a anotação `@` resolve ambiguidade,
  por exemplo `@le=le#pron` quando "le" é pronome e não artigo).
- Expressões de várias palavras (d'accord, est-ce que, s'il vous plaît) viram um token só.

## Regras conferidas pelo validador

- Cada frase usa só palavras de cima + a própria (formas conjugadas contam como a base).
- Palavras-ponte (ainda não estudadas, mostradas com tradução): até 2 por frase no 1º dia (posições 1–8),
  1 nos dias 2–5 (até a 40ª), nenhuma depois. A ponte precisa existir na lista, para ter tradução.
- Frases de 3 a 8 tokens, com pontuação final; a frase precisa conter a própria palavra.
- Cada pilar é aberto por exatamente uma palavra; exercícios de pilar com um `___` e resposta fora das opções.
- O teste `tests/content.test.ts` confere o JSON gerado de novo e gera exercícios de todos os níveis para tudo.

## Ordem das palavras

Ordem aproximada de frequência no francês falado (o usuário preferiu não baixar a lista do Lexique).
Dentro das primeiras ~60 houve pequenos ajustes para que as frases fossem possíveis (alguns substantivos
como temps, ami, homme, café entram cedo). Para trocar a ordem: mover blocos no `.txt` e rodar o validador.

## Pronúncia aproximada (`pron_br`)

Convenção do plano: ü (u francês), u (ou), ö (eu / e átono), ã õ ẽ (nasais), uá (oi), x (ch), r (sempre
na garganta), consoante final muda não se escreve. Acento agudo/circunflexo na vogal da última sílaba quando
ajuda (é aberto, ê fechado, ó aberto, ô fechado). O áudio é sempre a referência.

## Revisão de qualidade

O conteúdo foi gerado pelo Claude Code e conferido pelo validador; vale uma segunda passada crítica nas
traduções a cada nova leva. Na fase 2 entra o botão "reportar erro" (tabela `reports` já existe).
