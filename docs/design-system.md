# LaCalle Life — especificação visual

Deriva de `docs/auditoria-marca.md`. **Nenhuma linha de código foi alterada para
escrever isto.** O objetivo é que a próxima etapa seja implementação sem decisão
estética: onde houver escolha, ela está tomada aqui, com o motivo.

Regra que governa todas as outras: **toda regra abaixo responde "como isso
aproxima o produto da logo e melhora a experiência?"** — se não respondia, não
entrou.

---

## 1. Shape language e sistema de raios — P0

### O diagnóstico, em números

Contado no código: `rounded-md` 38 usos, `rounded-lg` 34, `rounded-xl` 33,
`rounded-full` 10, `rounded-sm` 2, `rounded-2xl` 1. **Seis valores.** Medido no
navegador a 388px, cinco aparecem simultaneamente na mesma tela.

O problema não é a quantidade de valores — é que **nenhum deles tem regra**. Um
desenvolvedor decidindo entre `md` e `lg` hoje só pode adivinhar.

### A regra: raio expressa **papel**, não tamanho

Quatro papéis, quatro tokens, zero ambiguidade. Um elemento não pergunta "sou
grande ou pequeno?", pergunta **"o que eu sou?"**.

| Token | Papel | Mobile | Desktop | O que é |
| --- | --- | --- | --- | --- |
| `rounded-sm` | **inline** | 8px | 8px | Coisa dentro de outra coisa: miniatura, amostra de cor, tag quadrada |
| `rounded-md` | **controle** | **18px** | **14px** | Tudo que se opera: botão, campo, select, textarea |
| `rounded-lg` | **contêiner** | 24px | 16px | Tudo que contém: cartão, sheet, modal, contêiner de lista |
| `rounded-full` | **marcador** | — | — | Circular por natureza: ponto, avatar, chip de filtro, **ponta de barra de progresso** |

**`rounded-xl` e `rounded-2xl` saem do vocabulário.** Hoje `xl` é o cartão e `2xl`
é o sheet; ambos passam a ser `lg`.

### O que muda de verdade

Uma coisa só: **o botão adota o raio do campo** (18/14 em vez de 12/10).

Isso foi escolhido nesta direção, e não baixando o campo para 12, por dois
motivos. O primeiro é proporção: num controle de 46px de altura, 12px de raio dá
0,26 de raio/altura e 18px dá 0,39 — a marca é uma curva generosa, e 0,39 lê
generoso sem virar pílula. O segundo é risco: campos são muito mais numerosos que
botões no app, então mexer no botão altera menos superfície.

O cartão em 24px e o campo em 18px mantêm hierarquia visível (razão 1,33). **Isto
não é uniformização** — é uma escada de três degraus com regra.

### O que se mantém

- **8px para inline.** Já está certo, dois usos, ambos corretos.
- **24/16 no cartão.** Valor atual, ninguém reclamou, e é o degrau de cima.
- **Pílula no chip de filtro.** Pílula diz "alternável/tag" de um jeito que
  retângulo arredondado não diz. É papel, não capricho.
- **A escada de densidade.** Todos os valores continuam vindo dos tokens de
  densidade, mobile maior que desktop.

### Quando NÃO usar

- Nunca um valor fora dos quatro tokens. Nada de `rounded-[10px]`.
- Nunca `rounded-full` em algo que contém texto corrido — pílula com frase dentro
  vira balão.
- Nunca raio diferente entre dois controles que se tocam na mesma linha.

---

## 2. Curva não é decoração

### A regra, para o Design System

> **Todo arco no LaCalle Life mede alguma coisa.**
>
> Curva é a linguagem de *progresso, movimento e continuidade* — os três
> conceitos da marca. Um arco que não representa um valor mensurável é
> decoração, e decoração não é identidade: é ruído que por acaso lembra a logo.

### Onde a curva pode aparecer

| Lugar | O que ela mede |
| --- | --- |
| Anel de calorias | fração do dia consumida |
| Barra de macro | fração da meta |
| Linha de tendência de peso | trajetória no tempo |
| Ponta de qualquer indicador | continuidade do traço |
| Marca de série concluída | conclusão, e o gesto de concluir |
| Marca de treino concluído | conclusão |
| Anel/arco de meta batida | atingimento |

### Onde a curva **não** pode aparecer

- Fundo de página, de seção ou de cartão.
- Separador, divisor, moldura.
- Silhueta de folha como bullet, ícone ou marca d'água.
- "Swoosh" em canto de cartão ou header.
- Contêiner com borda orgânica ou ondulada.
- Qualquer forma cuja justificativa seja "lembra a logo".

### O teste, antes de desenhar qualquer arco

1. Que número este arco representa?
2. Se o número mudar, o arco muda?

**Se qualquer resposta for não, não desenhe.**

---

## 3. Progresso com o que já existe

Nenhuma funcionalidade nova, nenhum dado inventado. Só o que o app já guarda e
já mostra, representado de outro jeito.

| Onde | O que já existe | Como a linguagem da marca melhora |
| --- | --- | --- |
| **Anel de calorias** | percentual consumido, meta, estouro | Já é curva. Falta: **ponta arredondada** (`strokeLinecap` já é `round` — ok) e o **gradiente da marca ao longo do arco**, de emerald-500 a 600. É o único lugar do app onde o gradiente deve existir. |
| **Barras de macro** | valor, meta, percentual, estouro | O trilho já é `rounded-full`; **o preenchimento também é** — mas com 0% e larguras pequenas a ponta some. Regra: preenchimento nunca menor que a própria altura, para a curva da ponta sempre existir. É o mesmo raciocínio do ponto colorido que já resolveu o dia zerado. |
| **Progresso da sessão** | `9/9` séries, em texto | O dado já está calculado (`sessionProgress`). Vira **uma barra fina de largura total no topo da sessão**, com ponta arredondada. Zero dado novo; é o mesmo número desenhado. |
| **Recorde por exercício** | série mais pesada, 1RM estimado | Hoje é linha de texto. Vira **barra comparativa entre exercícios** — cada recorde relativo ao maior da lista. O dado já existe em `personalRecords`. |
| **Volume por período** | kg por semana/mês | Barras retas de canto vivo. Ganham **topo arredondado** — a mesma ponta do anel, e a mais barata de todas as mudanças. |
| **Tendência de peso** | pontos + média móvel | Já é o segundo melhor elemento. Falta só **ponta arredondada na linha** e o ponto do presente destacado. |
| **"Última vez"** | performance anterior do exercício | O app **já busca e já mostra** este dado durante a execução. É a única comparação com o passado que existe, e ela aparece como texto discreto. Deveria ser o padrão visual de "trajetória": seta de direção + delta, o mesmo tratamento que o peso já tem. |
| **Delta de peso** | `−2,9 kg nos últimos 30 dias` | Já tem seta e magnitude. É o modelo a replicar nos itens acima, não algo a mudar. |
| **Série concluída** | booleano + gesto de 220ms | Já correto. Não mexer. |

**O padrão que sai daqui:** todo indicador que já conhece um valor anterior deve
mostrar **direção + magnitude**, no formato que o delta de peso já usa. Isso
transforma "estado" em "trajetória" sem uma linha de dado novo.

---

## 4. Tipografia — análise antes de trocar

### Comparação objetiva

| Dimensão | Geist Sans (atual) | Wordmark da marca |
| --- | --- | --- |
| Classe | neo-grotesca | geométrica arredondada |
| Eixo | vertical, fechado | vertical, aberto |
| Terminais | retos, cortados na horizontal | retos, mas em hastes muito circulares |
| Curvas | ovais controladas | quase círculos perfeitos (o `C`, o `a`, o `e`) |
| Largura | normal, econômica | larga |
| Contraste de traço | baixo e uniforme | baixo e uniforme |
| Números | tabulares excelentes, `1` com serifa de pé | não há números no wordmark |
| Sensação tecnológica | **alta** | baixa |
| Sensação esportiva | baixa | média |
| Sensação premium | alta (por sobriedade) | alta (por geometria) |

**O diagnóstico preciso:** as duas são de baixo contraste e terminais retos —
não se brigam. O que difere é **a circularidade e a largura**. Geist economiza
espaço horizontal; o wordmark gasta. Lado a lado, o wordmark parece mais aberto e
mais humano.

### Isso se resolve sem trocar a fonte?

**Parcialmente, e é onde se deve começar.** Três alavancas, nesta ordem:

1. **Tracking positivo em títulos grandes.** Hoje títulos usam tracking
   *negativo* (`tracking-tight`, `-0.03em`), que é a convenção de neo-grotesca e
   é exatamente o oposto da abertura do wordmark. Abrir o tracking dos títulos
   de tela aproxima muito, e custa uma linha.
2. **Peso.** Reduzir de `semibold` para `medium` em títulos grandes: a geométrica
   do wordmark é leve para o tamanho dela, e `semibold` em Geist lê mais denso.
3. **Tamanho do número-herói.** O `772` do anel já é o maior número do app;
   levá-lo mais longe é o que dá presença sem trocar família.

**Só depois disso** se avalia trocar, porque as três acima são reversíveis em
minutos e podem resolver 70% da distância.

### Os três cenários

#### A — Manter Geist

Mudanças: tracking de negativo para ~0 ou levemente positivo em `text-2xl` e
acima; peso `medium` em títulos de tela; número-herói maior.
**Custo:** baixíssimo. **Risco:** nenhum. **Ganho:** médio.
**Esta é a recomendação para a primeira sprint.**

#### B — Geist + display secundária

Geist continua sendo **todo** o corpo, rótulo, botão e tabela. A secundária
entra **só** em: número-herói (anel, peso, plano do perfil, volume da sessão) e
título de tela. São seis lugares.
**Custo:** um arquivo de fonte a mais no bundle. **Risco:** baixo — se a fonte
falhar, o fallback é Geist e nada quebra. **Ganho:** alto.
**Esta é a recomendação depois que A for medida.**

#### C — Trocar tudo

Não recomendo, e não por gosto: Geist resolve dois problemas medidos deste app —
`tabular-nums` de qualidade e legibilidade em corpo pequeno em tela densa. Trocar
arrisca ambos por um ganho que o cenário B entrega sem risco.

### Critérios objetivos para a fonte do cenário B

Se e quando for escolher, ela precisa ter, **em ordem eliminatória**:

1. `tabular-nums` de verdade (não apenas `font-feature-settings` fake).
2. Números com altura de caixa alta consistente — o app alinha colunas.
3. Peso variável ou no mínimo 500/600/700.
4. Terminais retos, contraste de traço baixo.
5. Ovais próximas do círculo — é a característica que aproxima do wordmark.
6. Suporte completo a português: `ç`, `ã`, `õ`, `á`, `ê`.
7. Licença que permita self-host.

**Não escolher por "parece bonita".** Uma candidata que falhe 1 ou 2 está
eliminada, por mais que combine com a marca.

---

## 5. Números — "data display" do LaCalle Life

O app é uma coluna de números. Eles precisam de regra própria.

### Três níveis, e só três

| Nível | Uso | Tamanho | Peso | Cor |
| --- | --- | --- | --- | --- |
| **Herói** | Um por tela. O número que a tela existe para mostrar. | 36–40px (mobile), 30–34px (desktop) | 600 | `ink`, ou `warning` quando estoura |
| **Figura** | Números que se comparam entre si: macro, total de refeição, volume, 1RM | 18–20px | 500 | `ink`, ou o token de macro quando codificado |
| **Dado** | Números dentro de linha e tabela | 14–15px | 400 | `ink` para o principal, `ink-muted` para o secundário |

### Regras invioláveis

1. **`tabular-nums` sempre.** Já é global no `html`. Não remover em lugar nenhum.
2. **A unidade nunca compete com o número.** `kg`, `g`, `kcal` sempre um nível
   abaixo em tamanho e em `ink-subtle`. Já é assim; formalizar.
3. **Alinhamento à direita quando a coluna se compara** (Alimentos, macros de
   refeição). À esquerda quando o número é uma afirmação isolada (peso no
   Progresso).
4. **Herói é um por tela.** Duas coisas do tamanho do herói é nenhuma.
5. **Nunca destacar um número que o usuário não pode influenciar.** TMB e TDEE
   são derivados — ficam em nível "dado", nunca herói.
6. **Travessão, nunca `NaN` nem `0`, para dado ausente.** Já garantido por
   `formatDecimal` e por teste que varre o código.
7. **Vírgula decimal e ponto de milhar**, sempre via `formatDecimal`.

---

## 6. Componentes

| Componente | Problema atual | Regra nova | Prio |
| --- | --- | --- | --- |
| **Button** | Raio 12/10 conflita com o campo ao lado; botão-ícone de 32px fora da escala | Raio = **controle** (18/14). Escala ganha um tamanho `icon`, quadrado, mínimo 44px no mobile. Um primário por tela. Tinta escura sobre o esmeralda, sempre | **P0** |
| **Card** | Retângulo é o oposto da marca; `rounded-xl` sai do vocabulário | Raio = **contêiner** (24/16). Três tons mantidos, diferindo por superfície e luz, **nunca por geometria** | P0 |
| **Input** | Sem personalidade; raio diverge do botão | Raio = **controle**, o mesmo do botão. Altura da densidade. Sem outras mudanças | P0 |
| **Sheet** | `rounded-t-2xl` fixo, fora do token | Raio = **contêiner**, só nos cantos de cima | P3 |
| **Chip** | Lido como "quinto vocabulário" | **Confirmado como pílula**, por papel. Único controle pílula do app. Altura mínima de toque 44px no mobile | P1 |
| **Progress** | Preenchimento pode ficar menor que a ponta e perder a curva | Trilho e preenchimento `rounded-full`. **Preenchimento nunca menor que a própria altura.** Estouro em âmbar | P1 |
| **Navigation** | Rótulo da barra inferior em 10px | Mínimo tipográfico do app = 11px. Item ativo em esmeralda sólido nos dois (sidebar e barra) | P2 |
| **Header** | — | Chip de ícone em `muted` com glifo em `accent-text`. Um por tela. Título com tracking aberto (ver §4) | P2 |
| **List** | Contêiner de lista já unificado no `Card padded={false}`; linhas com botão-ícone de 32px | Linha tem altura mínima de 44px. Ação de linha usa o novo tamanho `icon` | **P0** |
| **Modal** | — | Raio = **contêiner**. Regra modal-vs-inline já escrita no `AGENTS.md`, mantida | P3 |

---

## 7. Alvos de toque

### O que a auditoria disse, e o que a medição refinou

O número bruto era "197 de 387 abaixo de 44px". Classificado por tipo, a 388px em
`/exercicios`:

| Categoria | Quantidade | Menor | Abaixo de 44px |
| --- | --- | --- | --- |
| Botão de ícone | 183 | **32px** | **183** |
| Botão com texto | 185 | 44px | **0** |
| Link de texto inline | 15 | 16px | 11 |
| Campo | 4 | 1px | 3 |

**Os 183 são um único controle repetido**: a estrela de favoritar, uma por linha
do catálogo de 183 exercícios. Não são 183 problemas — é **um componente**.

### Problemas reais

1. **Botão-ícone de 32px** (`size-8`), presente em ~12 arquivos: favoritar,
   editar, excluir, duplicar, mover, fechar diálogo.
2. **Chips de filtro em `h-7` (28px) e `h-8` (32px)** — abaixo do mínimo, e são
   o controle principal de duas telas.

### Falsos positivos

1. **Links de texto inline** ("Abrir diário", "Preencha o perfil"). São texto
   corrido; inflá-los para 44px de altura quebraria o parágrafo. A norma que
   importa aqui é espaçamento entre alvos, não tamanho do alvo.
2. **O campo de 1px** é o radio do alternador de tema, visualmente oculto por
   design — o alvo real é o `label`.

### A regra: **tamanho visual ≠ área de toque**

> Um controle pode desenhar 32px e **capturar** 44px. Isso é obrigatório no
> mobile e recomendado no desktop.

Tecnicamente há duas formas, ambas viáveis aqui:

- **Padding negativo com margem compensatória**: o botão recebe padding para
  chegar a 44px e uma margem negativa igual, mantendo o layout intacto.
- **Pseudo-elemento de área**: `::after` absoluto com `inset` negativo até 44px.
  Não afeta layout nenhum, e é a opção certa dentro de linhas densas.

**Regra do Design System:** todo controle interativo tem no mínimo **44×44 de
área de toque no mobile**, independentemente do tamanho desenhado. Links de texto
dentro de parágrafo são a única exceção, e devem ter no mínimo 8px de separação
vertical de outro alvo.

---

## 8. Identidade sem a logo

> "Removidas a logo e toda menção ao nome, quais cinco características deveriam
> permitir reconhecer o produto?"

A auditoria concluiu que hoje só a cor faz esse trabalho. As cinco abaixo são a
meta — e **nenhuma delas é cor**, de propósito.

1. **O anel com gradiente é a assinatura.** Um arco que vai de emerald-500 a 600
   ao longo do próprio percurso, com ponta arredondada, é uma forma que nenhum
   concorrente desenha igual. É o elemento que substitui a logo.
2. **Toda curva mede algo.** Um produto sem um único arco decorativo é
   reconhecível pela ausência — é disciplina visível.
3. **Progresso mostra direção, não só posição.** Seta + delta como padrão, não
   como exceção. É a tradução literal da trajetória da marca.
4. **Uma escada de três raios com papéis nomeados** — inline, controle,
   contêiner. Interfaces genéricas têm raio arbitrário; esta tem gramática.
5. **A voz.** "Nada registrado hoje ainda." "Você perdeu 2,9 kg desde então."
   Direta, sem parabenizar, sem infantilizar, sem exclamação. Já existe e já é
   metade da personalidade do produto — e sobrevive a qualquer paleta.

---

## 9. LOCKED — não alterar sem motivo forte

Uma implementação futura deve tratar esta lista como congelada. Cada item foi
medido, defendido, ou já reverteu uma tentativa anterior.

| Item | Por que está trancado |
| --- | --- |
| **A paleta** | Vem das oito cores da marca; 67 duplas de contraste passam em AA nos dois temas |
| **Tinta escura sobre o esmeralda** | Branco reprova em 2,54:1 e 3,77:1. Reverter quebra AA |
| **Superfícies slate, não verdes** | Já testado contra três variantes de verde; verde tira do esmeralda o papel de única cor saturada |
| **Sem gradiente de fundo** | Testado, aprovado e depois removido a pedido |
| **Tokens de densidade** | Mobile é a base, desktop é mais denso, não menor |
| **`tabular-nums` sem monoespaçada** | Resolveu "parece log" sem perder alinhamento |
| **Três tons de cartão** | Diferem por superfície e luz, nunca por geometria |
| **Codificação de macro** | Uma tabela; tokens de texto separados dos de área por medição de contraste |
| **Tabela em Alimentos** | Forma seguindo o dado; já apontado como inconsistência duas vezes e defendido as duas |
| **Confirmação em dois toques com barra de tempo** | Protege dado |
| **`formatDecimal` em toda superfície** | Com teste que varre o código e falha apontando arquivo e linha |
| **Barra inferior de cinco abas** | Ergonomia de polegar |
| **Animação atrelada ao toque, nunca ao estado** | Impede 24 checks pularem ao abrir um treino; tem teste próprio |
| **Um glifo por conceito, vindo de `ICONS`** | Fecha o caso do ícone que mudava entre o toque e a chegada |
| **A voz dos textos** | Metade da personalidade atual |
| **Sem IA, chat ou LLM** | Restrição fundadora, reconfirmada em 12/08/2026 |

---

## 10. Princípios

### 01 — Toda curva mede algo
Curva é progresso, movimento ou continuidade. Arco sem número por trás é
decoração, e decoração não é identidade.

### 02 — Progresso mostra direção, não só posição
Onde existe um valor anterior, mostre para onde está indo. O app já guarda o
passado; deixe de escondê-lo.

### 03 — Raio expressa papel
Inline, controle, contêiner, marcador. Quatro papéis, quatro valores. Um
desenvolvedor nunca deve precisar adivinhar.

### 04 — A marca é concentrada, nunca diluída
Superfícies neutras; o esmeralda só em ação primária, estado ativo e progresso.
Se o verde aparece em três lugares numa tela, um está errado.

### 05 — O número é o conteúdo
Um herói por tela, unidade sempre menor que o valor, travessão no lugar do
desconhecido. Nunca destaque um número que ninguém pode mudar.

### 06 — O polegar manda
44px de área de toque no mobile, sempre — mesmo quando o desenho é menor. O app é
usado de pé, entre séries, com uma mão.

### 07 — Na dúvida, omitir
Vale para foto, classificação, dado nutricional e agora também para forma: um
elemento visual sem função é pior que espaço vazio.

---

## 11. Design System consolidado

**Brand personality** — Orgânica · Ascendente · Fluida · Viva · Confiante ·
Natural

**Shape language** — Contêineres retangulares com curva generosa e consistente.
Curva real reservada para medição. Nenhuma forma orgânica em contêiner.

**Radius system** — `sm` inline 8px · `md` controle 18/14px · `lg` contêiner
24/16px · `full` marcador. `xl` e `2xl` banidos. Controles que se tocam
compartilham raio.

**Spacing system** — Ritmo de 4px. Padding de cartão da densidade (20/24px). Gap
entre cartões 12px. Entre seções 32px. Estado vazio respira mais que cartão
cheio — única exceção, intencional.

**Typography** — Geist Sans no corpo. Títulos com tracking aberto e peso
`medium`. Display secundária opcional, só em número-herói e título de tela.
Mínimo tipográfico: 11px.

**Number typography** — Três níveis: herói (36–40px/600), figura (18–20px/500),
dado (14–15px/400). `tabular-nums` sempre. Unidade sempre um nível abaixo.

**Color usage** — Slate nas superfícies, emerald na ação/estado/progresso.
Gradiente da marca em **um lugar só**: o anel. Estouro é âmbar, falha é vermelho.

**Iconography** — Lucide, stroke uniforme, um glifo por conceito, de `ICONS`. A
marca nunca vira ícone.

**Progress language** — Arco para o cíclico, linha para o histórico, barra para
fração. Ponta arredondada em todos. Direção + magnitude onde houver passado.

**Cards** — Três tons: `hero` (um por tela), `default`, `quiet` (vazio). Nem tudo
precisa de cartão.

**Buttons** — Um primário por tela. Tinta escura sobre o esmeralda. Altura e raio
da densidade. Par com campo compartilha altura e raio. Tamanho `icon` com 44px de
toque.

**Forms** — Campo e botão com o mesmo raio. Rótulo sempre visível. Mensagem única
por campo, ligada por `aria-describedby`. Erro substitui dica, não empilha.

**Navigation** — Sidebar no desktop, barra inferior no celular, mesmo glifo.
Ativo em esmeralda sólido.

**Feedback** — Toast para escrita sem rastro na tela. `Notice` em quatro tons com
ícone, `role` derivado do tom. Confirmação de dois toques para destrutivo.

**Motion** — Saída rápida, chegada lenta. 150ms cor, 220ms gesto, 300–500ms dado.
Atrelado ao toque, nunca ao estado. Respeita `prefers-reduced-motion`.

**Mobile interaction** — 44px de toque mínimo. Ação primária ao alcance do
polegar. Leitura possível de pé, de relance, com o braço cansado.

---

## 12. Teste de consistência

| Tela | Mudança visual mais importante |
| --- | --- |
| **Home** | O anel ganha o gradiente da marca e vira a assinatura do produto. É a única tela onde a mudança é de identidade e não de arrumação. |
| **Nutrição / Diário** | As barras de macro garantem a curva da ponta mesmo em valores baixos, e os botões passam a ter o raio dos campos ao lado. A tela para de ter três curvas competindo por linha. |
| **Treinos** | O "Criar" e o campo ao lado ficam com o mesmo raio, e o cartão de rotina passa de `xl` para `lg`. Mudança pequena, e é o que tira a sensação de peças de origens diferentes. |
| **Execução de treino** | O `9/9` vira uma barra fina de largura total no topo — o mesmo número, desenhado. É onde o conceito de progresso mais falta, e onde não custa dado nenhum. |
| **Exercícios** | A estrela de favoritar ganha 44px de área de toque sem mudar de tamanho desenhado. É a maior correção de usabilidade mobile do app inteiro, em um componente. |

---

## Respostas finais

### 1. Maior impacto visual
**O sistema de raios.** Toca toda tela, todo componente, e é a única mudança que
faz a interface falar a língua da marca sem depender do vetor da logo.

### 2. Menor esforço
**Ponta arredondada nas barras de volume.** Um atributo, um arquivo, e alinha o
gráfico ao anel que fica duas telas ao lado.

### 3. Maior risco de piorar
**Trocar a família tipográfica (cenário C).** Geist resolve dois problemas
medidos — qualidade de `tabular-nums` e legibilidade em corpo pequeno. Trocar
arrisca os dois por um ganho que o cenário B entrega sem risco. Em segundo lugar,
o **progresso comparativo**, que é onde a especificação encosta em escopo
funcional.

### 4. Implementar primeiro
**Raio, e dentro dele o botão adotando o raio do campo.** É P0, é reversível, não
depende de nada externo, e é o degrau que destrava a percepção de sistema.

### 5. O que NÃO fazer, apesar de parecer bonito
**Espalhar o gradiente da marca.** Ele é lindo em botão, em cartão e em header —
e se aparecer nos três, o produto vira um tema de dashboard genérico e o anel
perde a única coisa que o torna a assinatura. **Um lugar só.**

Em segundo: **a silhueta de folha como elemento gráfico**. É a tentação mais
óbvia da marca e a mais rápida de transformar identidade em clip-art.
