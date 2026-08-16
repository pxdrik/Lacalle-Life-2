# LaCalle Brand System V1.1 — aplicação no Lacalle Life

O documento normativo é o **LaCalle Brand System V1.1**, em PDF. Este arquivo não
o substitui e não o resume: ele registra **como o Lacalle Life o aplica**, onde a
aplicação diverge, e o resultado do QA da pág. 53.

Quando este arquivo e o brandbook discordarem, o brandbook vence — é o que a
pág. 2 determina. Quando o brandbook discordar de si mesmo, a resolução está
registrada aqui, e a pág. 53 diz o que fazer com isso: _"divergências não viram
exceção informal: ou o Brand System é atualizado e versionado, ou a peça é
corrigida"_. Tudo abaixo é proposta de emenda para uma V1.2.

O contrato técnico vive em `src/design-system/tokens.css`, e cada valor está
aferido em `tokens.test.ts` — 139 asserções entre contraste e valores literais
do documento.

---

## Onde a marca vive

| Arquivo | Papel |
| --- | --- |
| `design-system/brand/mark.ts` | A única fonte da forma: os dois paths e a construção do ícone. |
| `design-system/brand/signature.tsx` | `Mark` e `Signature`, com a construção da pág. 10 em `calc()`. |
| `app/icon.svg` | Favicon — gradiente 150°, símbolo a 46%, raio a 22,5%. |
| `app/apple-icon.tsx` | Ícone do iOS, gerado. Sangria total, sem raio. |
| `public/icon-maskable.svg` | Android, sangria total, símbolo na zona segura. |
| `design-system/brand/mark.test.ts` | Prova que os SVGs de disco não divergiram do módulo. |

**O vetor oficial da pág. 51 não existe.** O símbolo foi traçado da silhueta do
canal alfa da arte do PDF, cujo maior render mede 139 × 137 px. Detalhes e a
razão em `docs/logo-brief.md`. Quando o vetor oficial aparecer, ele substitui
duas constantes e nada mais muda.

---

## As seis divergências

### 1. A tinta sobre o acento é Ink, não branco — pág. 25

Branco sobre o emerald-600 mede **3,77:1** e sobre o 500 mede **2,54**. Os dois
reprovam os 4,5:1 que a pág. 48 exige de texto abaixo de 18 px. Ink sobre os
mesmos dois mede 5,01 e 7,44.

O brandbook se contradiz aqui, e entre as duas regras a de acessibilidade é a que
não admite exceção. **Emenda proposta:** a pág. 25 deveria dizer que o rótulo do
botão primário é Ink quando o acento não sustenta branco, e listar branco como o
caso do `danger` — onde ele mede 4,83 e passa.

### 2. Estados e cores de dado ganham um par de texto — pág. 27

`--warning` (#D97706) mede 3,04:1 na página, `--danger` (#DC2626) mede 4,41 sobre
a própria superfície de erro, e as duas cores de dado medem 3,60. Como **ícone,
borda e preenchimento** todas cumprem os 3:1 de um elemento gráfico e ficam como
o documento as define. Como **texto** entram `--warning-text`, `--danger-text`,
`--data-positive-text` e `--data-negative-text`.

Não é regra nova: é a instrução da pág. 48 para o acento — _"para texto no
acento, use a variação 600 ou 800 da escala"_ — aplicada às famílias que o
brandbook não escalou. **Emenda proposta:** dar a warning, error e às cores de
dado as mesmas cinco variações que Life e Finance têm.

### 3. `--data-positive` é o 600, não o 500 — pág. 27

#10B981 mede 2,42:1 sobre a página, abaixo dos 3:1 de um gráfico. A pág. 48 já
registra esse teto para o acento; a pág. 27 não o herda.

### 4. O tema escuro precisa de três valores que o brandbook não dá — pág. 33

A pág. 33 nomeia seis; o app tem mais papéis. Interpolados, e marcados um a um em
`tokens.css`: uma superfície de hover entre `elevated` e a borda, um terceiro
nível de texto, e uma borda de ênfase para o hover de card da pág. 24.

### 5. O item ativo da tab bar não usa ícone preenchido — pág. 32

A pág. 32 pede ícone preenchido no item ativo, e a pág. 28 abre para isso a única
exceção do sistema à regra de ícones lineares. **Não é implementável com a
biblioteca que a pág. 28 exige:** o Lucide é linear e não tem família preenchida,
e `fill` só funciona nos glifos fechados — `TrendingUp` é polilinha aberta e
`UtensilsCrossed` são dois traços cruzados. Buscar os preenchidos em outra
biblioteca é o que a mesma pág. 28 proíbe.

No lugar, o item ativo usa o tratamento que a **pág. 31** dá ao item ativo da
sidebar: acento sobre a superfície do acento. Entrega o que a regra existe para
entregar — distinção por forma além de cor, pág. 48.

### 6. O tamanho de fonte do campo é 16 px no celular — pág. 26

A pág. 26 pede 14. O iOS Safari dá zoom no viewport ao focar um campo com fonte
menor que 16 e joga o layout fora no meio da digitação. A mesa recebe 14.

---

## Conflitos internos do brandbook, e como foram lidos

Nenhum destes é divergência da aplicação: são duas páginas do documento pedindo
coisas diferentes.

| Conflito | Leitura adotada |
| --- | --- |
| Padding de botão 24/18/12 (pág. 25) contra escala base 4 sem 18 (pág. 22) | Vale a pág. 25: ela é a específica e escreve o número por extenso. A pág. 22 governa layout, não o interior de um controle. |
| Item de sidebar com 40 px (pág. 31) contra alvo de toque de 44 (pág. 48) | Vale a pág. 31. A sidebar é superfície de ponteiro a partir de 1024 px, e o mínimo AA da WCAG 2.5.8 é 24 × 24, que 40 cumpre com folga. |
| Label em 11 px (pág. 17) contra piso de texto de 12 px (pág. 48) | O piso vale para conteúdo; um rótulo é um label e usa o estilo de label. Os 10 px que restam no app são um só, o título de grupo da sidebar, que a pág. 31 especifica em 10 px Bold. |
| Gap de 6 px em stat card e input (pág. 24 e 26) contra a escala sem 6 (pág. 22) | Vale a página do componente, pela mesma razão do padding de botão. |

---

## QA — checklist da pág. 53

Rodado em 15/08/2026, medido no navegador nos dois temas e nas três faixas de
largura. **Não é auto-declaração:** o que está marcado foi verificado, e o que
não passou está escrito como não passou.

### Marca

- [x] A logo está correta e na versão certa — Proposta 01, assinatura completa
- [x] As proporções foram preservadas — derivadas de `--signature-h` em `calc()`
- [x] A área de proteção é respeitada — 0,5x = 11 px, e o menor respiro medido é 16
- [x] O tamanho mínimo é atendido — 18 px no celular, 22 no desktop
- [x] Favicon e app icon usam a Proposta 01
- [x] A arquitetura do nome está correta — `LaCalle Life`

### Fundamentos

- [x] A tipografia é Inter, na escala oficial — H1 medido em 32/700/115%/−2,5%
- [x] O acento está correto e é único
- [x] A proporção 70/20/10 foi respeitada — acento medido em **0,71%** da área do Hoje
- [ ] **O grid está aplicado corretamente — não.** Ver _Lacunas_ abaixo.
- [ ] **Todo espaçamento vem da escala base 4 — não inteiramente.** Ver _Lacunas_.
- [x] Os raios seguem 8/12/16/20/24 — e os proibidos 14 e 18 saíram

### Produto

- [x] Os cards seguem a anatomia oficial — raio 16, borda 1 px `#E5E7EB`, sem sombra
- [x] Existe um único botão primário por tela — medido: zero ou um
- [x] Inputs têm 44 px e label acima
- [x] Todo estado combina cor + ícone + texto
- [x] Os ícones são de uma única biblioteca linear — com o traço por tamanho da pág. 28
- [x] Os gráficos usam uma cor + cinzas
- [x] A logo está no lugar previsto — e em um lugar por contexto

### Movimento

- [x] Durações vêm dos quatro tiers
- [x] Só as duas curvas oficiais foram usadas
- [—] O Reveal está restrito a momentos de identidade — **não aplicável**: o app
      não tem splash, onboarding, login nem troca de módulo. É local-first e sem
      contas. Não há momento de identidade para o Reveal ocupar.
- [x] Todo progresso é contínuo
- [x] Nenhuma animação atrasa o usuário
- [x] `prefers-reduced-motion` está implementado — 120 ms, mantendo o feedback

### Qualidade e acesso

- [x] Contrastes atendem AA em light e dark — 139 asserções, e o build quebra
- [x] A experiência mobile foi validada primeiro — 390, 900 e 1400 px
- [x] O dark mode usa a escala própria, não inversão
- [ ] **Alvos de toque têm 44 × 44 — não inteiramente.** Ver _Lacunas_.
- [x] O foco é visível em todo elemento interativo
- [x] Passou nos 3 testes de identidade — abaixo
- [x] A submarca parece LaCalle
- [x] A submarca tem personalidade própria

---

## Os três testes de identidade — pág. 52

**Teste 01 · logo removida.** Passa. Cobrindo a assinatura, sobram o grid de
cards de raio 16 com borda de 1 px, a coluna de 264 px com o item ativo em acento
50 e barra de 3 px, o anel contínuo, e a escala de espaçamento. A tela continua
sendo reconhecidamente do sistema.

**Teste 02 · cor removida.** Passa. Em escala de cinza a hierarquia sobrevive:
o número de calorias é o maior elemento da tela por tamanho, o item de navegação
ativo continua marcado pela barra lateral e pelo peso, e os três macros se
distinguem por rótulo direto. Nenhum estado do app é comunicado só por cor — é o
que as pág. 27 e 48 exigem e o que o ícone em cada aviso garante.

**Teste 03 · motion removido.** Passa, e é o teste com prova executável: o app
suporta `prefers-reduced-motion` e o modo reduzido é uma versão legítima da
interface, não uma degradada. Nenhuma informação depende de movimento — o anel
desenha o valor final, os cartões aparecem inteiros, e o único movimento que
sobrevive é o feedback de hover, foco e confirmação, que a pág. 40 manda manter.

---

## Lacunas conhecidas

Escritas porque uma auditoria futura vai encontrá-las, e é melhor que encontre a
razão junto.

### O grid de 12 colunas não está aplicado literalmente

O brandbook define 12 colunas no desktop, 8 no tablet e 4 no celular, com margem
e gutter por breakpoint. O app aplica **as margens, o gutter e a largura máxima**
— 1280 px, margens 16/24/48, gap de 24 entre cards — mas os componentes se
distribuem por flex e grid automático, não por contagem de colunas.

Na prática as telas caem em 1, 2 ou 3–4 cards por linha, que é o que a tabela da
pág. 32 pede. O que falta é a garantia: nada impede alguém de escrever uma linha
de 5 cards, que a pág. 21 proíbe por nome.

### Nem todo espaçamento vem da escala base 4

Sobram usos de 6 px (`gap-1.5`) e 2 px (`mt-0.5`) espalhados. O 6 é defensável —
a própria pág. 24 usa gap 6 no stat card e a pág. 26 no label. O 2 não é.

Não foi varrido nesta entrega porque é uma mudança de centenas de linhas com
risco de regressão visual proporcional, e sem nenhum ganho de conformidade
enquanto o 6 continuar sancionado pelo próprio documento. Candidato a uma passada
própria, com conferência no navegador tela a tela.

### Alvos de toque abaixo de 44 px

Dois casos aceitos, e um terceiro que era defeito e já fechou:

1. **Itens de sidebar em 40 px** — conflito interno do brandbook, resolvido na
   tabela acima.
2. **Links de texto em linha** — inflá-los quebraria a caixa de linha, e o
   padrão que eles atendem é espaçamento entre alvos, não tamanho. Decisão já
   documentada em `globals.css`.
3. ~~`ConfirmButton` com área efetiva de 15 × 15 px~~ — era o **BUG-006** da
   auditoria externa: o `overflow-hidden` que contém a barra de desarme
   recortava o `::after` do utilitário `touch-44`. **Fechado em 15/08**, na
   Frente 5 do plano em `docs/roadmap.md` — não nesta entrega de marca, mas já
   corrigido. Medido depois: 41–43 px nos dois eixos.

### O que o brandbook prevê e o app não tem

Não são lacunas de conformidade — são páginas que descrevem superfícies que este
produto não possui. Registradas para que uma auditoria futura não as leia como
pendência.

- **LaCalle Reveal, splash e onboarding** (pág. 35): o app é local-first, sem
  contas e sem login. Não há abertura de sessão a revelar.
- **Fotografia de marca** (pág. 45): as únicas fotos do app são as dos
  exercícios, que vêm de base livre sob CC BY-SA e seguem a direção da origem,
  não uma direção de marca.
- **Stat card, list card e steppers** (pág. 24 e 37): o app não tem essas
  composições. Quando tiver, a anatomia está na página.
