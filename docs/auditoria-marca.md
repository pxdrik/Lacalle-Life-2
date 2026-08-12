# Auditoria de marca — a logo contra o produto

Feita em 12/08/2026, com a logo oficial como âncora. A pergunta não é se a marca
aparece no app; é se **o app inteiro parece pertencer à mesma marca**.

Método: navegação real no app rodando, com banco populado — perfil, cinco
pesagens, dieta de três refeições, diário do dia, treino de três exercícios e uma
sessão concluída. Desktop em 2133px e **mobile em viewport real de 388px**, via
iframe, porque o redimensionamento da janela desta máquina não alcança o viewport
da página. Medições feitas no navegador, não estimadas.

---

## 0. O que eu não consegui avaliar

Explícito, para não virar suposição:

- **A logo não está no app.** O `icon.svg` ainda é o "L" placeholder. Toda
  comparação abaixo é entre o *DNA da arte da marca* e a interface — não entre a
  marca aplicada e a interface.
- **Não avaliei animação em movimento.** Os screenshots são estáticos; li as
  durações e curvas no código (`--ease-out`, `--animate-pop`, 220ms), mas não vi
  o timing rodando.
- **Não testei toque real.** Medi tamanho de alvo em pixels; não testei com
  polegar em aparelho.
- **Não testei leitor de tela.** Há `aria-*` em toda parte e o código argumenta
  sobre isso, mas não rodei NVDA/VoiceOver.

---

## 1. DNA visual da logo

### Forma

A marca é **uma fita contínua** que se dobra sobre si mesma. Três leituras
convivem no mesmo traço: um **L**, uma **folha**, e um **movimento ascendente**.

- **Geometria:** nenhuma reta. Tudo é arco, e os arcos são *desiguais* — a haste
  sobe com raio largo e retorna com raio curto, o que cria aceleração. Uma fita
  de raio constante seria um anel; esta tem direção.
- **Ângulos:** só um, implícito, na dobra inferior. O resto é curva.
- **Proporção:** a marca é mais alta que larga (~4:3), inclinada para a direita.
  Inclinação é a coisa mais barata que existe para dizer "movimento", e aqui ela
  é estrutural, não um `skew` aplicado depois.
- **Espessura:** modulada. A fita afina no topo e engrossa na dobra — caligrafia,
  não stroke uniforme. É o que separa esta marca de um ícone de biblioteca.
- **Ritmo:** sobe, dobra, retorna, sai pela folha. Quatro tempos, sem repetição.
- **Progressão:** vem do gradiente **e** da espessura ao mesmo tempo, apontando
  para cima e para a direita. A marca não desenha um ciclo fechado; ela desenha
  uma **trajetória**.
- **Simplicidade:** média, não alta. Isto **não** é um símbolo minimalista — tem
  sobreposição, profundidade e gradiente. É importante registrar porque a
  interface hoje é minimalista, e essa é uma das distâncias reais.

### Personalidade

Seis características, tiradas da forma e não de vocabulário genérico de fitness:

1. **Orgânica** — curva contínua, zero retas, silhueta de folha.
2. **Ascendente** — todo o desenho aponta para cima e para a direita.
3. **Fluida** — a fita não tem começo nem fim marcados; é um gesto só.
4. **Viva** — o gradiente e a espessura modulada dão respiração; não é chapada.
5. **Confiante, não agressiva** — sem pontas, sem ângulos, sem itálico forçado.
   Nada de "esporte radical".
6. **Natural mais que atlética** — a folha fala de saúde e crescimento, não de
   academia. Isto contradiz o clichê do setor, e é a coisa mais valiosa da marca.

O que ela **não** é: técnica, geométrica, rígida, mecânica, minimalista, séria.

### Linguagem visual

| Dimensão | A logo diz |
| --- | --- |
| Formas | orgânicas, curvas, sobrepostas |
| Bordas | nenhuma — a forma é preenchimento, não contorno |
| Peso | pesado no centro, leve nas pontas |
| Contraste | alto (verde saturado sobre quase-preto) |
| Densidade | baixa — a marca é ~40% cheia, o resto é ar |
| Cheio × vazio | o vazio interno da dobra é parte da forma, não sobra |
| Sensação | crescimento |

**A frase que resume:** *uma trajetória ascendente desenhada em um traço só.*

---

## 2. O DNA da logo contra o app, área por área

| Área | Veredito | Por quê |
| --- | --- | --- |
| Hoje / Dashboard | **B — parcialmente alinhada** | O anel de calorias é o único lugar onde a interface fala a mesma língua da marca: arco, progressão, esmeralda. Tudo em volta é retângulo. |
| Diário | **C — neutra** | Grade densa de números e barras retas. Legível, sem personalidade. |
| Dietas / detalhe | **C — neutra** | Cartões empilhados; nada aqui vem da marca. |
| Treinos / editor | **C — neutra** | Linhas de série em grade tabular. Funcional, anônimo. |
| Execução de sessão | **B** | O check que assenta com ultrapassagem em 220ms é gesto, não estado — é o momento mais "vivo" do app. Mas o resto da tela é formulário. |
| Exercícios | **C** | Lista com foto. Poderia ser qualquer catálogo. |
| Alimentos | **D — desconectada** | É uma planilha. Colunas alinhadas, tipografia tabular, zero curva. Decisão deliberada e bem argumentada (forma segue o dado), mas de marca é o ponto mais distante. |
| Evolução | **B** | O gráfico de tendência com média móvel tem curva e direção — o parente mais próximo da marca depois do anel. As barras de volume são retângulos duros. |
| Perfil | **B** | O cartão herói com 2.067 kcal e macros coloridos tem hierarquia de verdade. |
| Navegação | **B** | A sidebar com item ativo em esmeralda sólido é o bloco de marca mais forte fora do anel. |
| 404 | **B** | Voz própria, dois caminhos, CTA claro. |

**Nenhuma área é A.** O motivo é único e estrutural, e está na seção 3.

### O achado central

> A logo é **curva, modulada e ascendente**. A interface é **ortogonal, uniforme
> e estática**.

Não é falta de cor nem falta de logo: a paleta já é a da marca e está correta. É
que **a marca desenha trajetórias e a interface desenha caixas**. Todo cartão é
um retângulo de canto arredondado; toda barra de progresso é um retângulo dentro
de outro; todo separador é uma reta horizontal. A única curva do produto é o anel
de calorias — e ele é bom exatamente porque é a exceção.

---

## 3. O que deve ser herdado da logo

### Formas — o que adotar

- **Arcos como linguagem de progresso, não só no anel.** Hoje o anel é a única
  peça curva. A marca justifica estender isso onde há progressão: meta batida,
  série concluída, tendência de peso.
- **Terminações arredondadas em tudo que é traço.** O anel já usa
  `strokeLinecap="round"`. As barras de macro **não** — elas terminam em corte
  reto. É uma inconsistência de um atributo, e ela contradiz a marca em quatro
  telas.
- **Espessura modulada onde couber.** É o traço mais distintivo da logo e o mais
  difícil de traduzir. Cabe no gráfico de tendência (linha que engrossa no
  presente) e em nada mais. **Não force.**

### Formas — o que NÃO adotar

- Folhas decorativas. Ver seção 5.
- Formas orgânicas em containers. Um cartão com borda ondulada é fantasia, não
  identidade — e destrói o alinhamento de dado que a V2 acertou.
- Diagonais em layout. A inclinação da marca não deve virar seção enviesada.

### Bordas e raio — **o problema medido**

No mobile, em três telas, contei **quatro raios distintos em uso simultâneo**:
`12px`, `16px`, `18px`, `24px` (mais `16px 16px 0 0` no sheet). Vindo dos tokens:

| Elemento | Token | Mobile | Desktop |
| --- | --- | --- | --- |
| Cartão | `rounded-xl` | **24px** | 16px |
| Campo | `rounded-lg` | **18px** | 14px |
| Botão `md` | `rounded-md` | **12px** | 10px |
| Chip | `rounded-full` | pílula | pílula |
| Sheet | `rounded-t-2xl` | **16px** | 16px (fora do token) |

Um botão de 12px encostado num campo de 18px dentro de um cartão de 24px. **Três
raios em três controles que se tocam.** A marca é uma curva só, contínua; a
interface tem quatro vocabulários de curva competindo na mesma tela.

Isto já tinha sido levantado e está registrado no roadmap como decisão pendente.
A auditoria confirma e sobe a prioridade: **é P0**, porque raio é a única
propriedade em que a interface poderia falar a língua da marca de graça.

### Tipografia

Fonte atual: **Geist Sans**. Uma neo-grotesca técnica, suíça, de terminações
retas e eixo vertical — a mesma família de gosto de Inter e Helvetica.

O wordmark da marca é uma **geométrica arredondada**: o "C" de LaCalle é quase um
círculo perfeito, o "a" tem barriga redonda, o "L" tem terminação limpa. É
Poppins/Gilroy em espírito, não Inter.

**Veredito: a tipografia é o segundo maior desalinhamento depois do raio.** Geist
é uma fonte excelente e é *neutra* — que é exatamente o problema: ela não
contradiz a marca, ela simplesmente não a acompanha.

Não recomendo trocar a fonte do corpo. Recomendo uma **fonte de display só para
números-herói e títulos de tela** — o 772 do anel, o 82,5 do peso, o 2.067 do
perfil. São seis lugares, é onde a marca teria voz, e não custa legibilidade no
corpo do texto.

O que **não** mudar: `tabular-nums` em toda parte, e a ausência de monoespaçada.
Ambas foram decisões medidas e corretas.

### Cores

**A paleta está certa e não deve mudar.** Ela veio das oito cores da marca, os
dois passos de esmeralda são estopes do próprio gradiente, e as 67 duplas de
contraste passam em AA nos dois temas.

Um detalhe que a marca sugere e o app não tem: **o gradiente**. A logo não é
verde chapado, é uma transição de emerald-500 para emerald-600. Hoje o app usa
sempre um valor plano. O anel de calorias é o candidato óbvio — um arco que vai
de 500 a 600 ao longo do percurso é a marca desenhada com dado real dentro.

---

## 4. Progresso como elemento visual

> "O usuário consegue sentir visualmente que o produto é sobre evolução?"

**Parcialmente. Ele sente no Hoje e perde em todo o resto.**

| Onde | Estado |
| --- | --- |
| Anel de calorias | ✅ o melhor elemento do app. Arco, cor, direção, tamanho. |
| Barras de macro | ⚠️ funcionam, mas são retângulos de ponta reta. Sem arredondamento e sem direção. |
| Gráfico de tendência | ✅ curva com média móvel; lê como trajetória. |
| Volume semanal/mensal | ❌ barras retas, e com um dado só viram um bloco verde gigante. |
| Recordes / 1RM | ❌ **é uma lista de texto.** O dado mais "evolução" do app inteiro — seu recorde pessoal — não tem representação visual nenhuma. |
| Séries na sessão | ⚠️ o check tem gesto, mas não há barra de progresso da sessão além de "9/9". |
| Peso ao longo do tempo | ✅ gráfico + delta com seta. |
| Metas batidas | ❌ **não existe momento de meta batida.** Já está no roadmap P4. |
| Streaks | ❌ não existem. |

**O problema estrutural:** o app mostra *estado* ("133 / 207g") em quase todo
lugar e mostra *trajetória* em dois. Uma marca cujo desenho é uma trajetória
deveria ter a comparação com o passado como padrão, não como exceção. O app já
guarda o histórico — "última vez" existe na execução — e quase nunca o desenha.

---

## 5. Onde a marca viraria decoração — o que NÃO fazer

Procurei exageros. Hoje **não há nenhum**, e isso é mérito: a V2 é disciplinada.
Registro os riscos porque a próxima implementação vai querer cometê-los:

- **Folha como enfeite.** A silhueta de folha da marca não deve virar bullet,
  divisor, marca d'água ou ícone de estado vazio. Uma folha ao lado de "Nenhuma
  dieta ainda" é clip-art.
- **Arcos decorativos.** Não colocar arco atrás de cartão, atrás de header, ou
  como "swoosh" em canto. Arco no LaCalle Life deve **sempre** medir alguma
  coisa.
- **Logo repetida.** Ela cabe em cinco lugares (header, celular, favicon,
  carregamento, estado vazio) e em nenhum outro.
- **Gradiente em tudo.** O gradiente é da marca; se ele for para botão, cartão e
  barra ao mesmo tempo, vira tema de dashboard barato. **Um lugar só** — o anel.
- **Vocabulário de academia.** Halter e talher já são ícones de navegação. Repetir
  o halter como elemento gráfico apaga a diferença entre marca e seção.

### A pergunta decisiva

> "Se eu remover a logo da interface, ainda reconheço que este produto é da mesma
> marca?"

**Hoje: parcialmente, e só pela cor.** O esmeralda sobre slate é reconhecível — a
paleta faz esse trabalho sozinha. Mas **forma, tipografia e movimento não
carregam marca nenhuma**. Tire a cor e sobra um dashboard competente e anônimo.

Esse é o resumo honesto da auditoria inteira.

---

## 6. Componentes

| Componente | Alinhamento | Observação |
| --- | --- | --- |
| **Button** | B | Três tamanhos coerentes, altura vem de token de densidade, tinta escura sobre esmeralda (correto e medido). **Raio 12px conflita com o campo ao lado.** |
| **Card** | B | Três tons por superfície e luz, mesma geometria — sistema bom. Mas retângulo é o oposto da marca. |
| **Input** | C | Correto e sem personalidade. Raio 18px destoa do botão. |
| **Select** | C | Nativo. Bom para acessibilidade, mas visualmente é do sistema operacional, não do produto. |
| **Chips / filtros** | C | `rounded-full`, e é o **quinto** vocabulário de raio. |
| **Sidebar** | B+ | Item ativo em esmeralda sólido é o bloco de marca mais forte fora do anel. |
| **Bottom nav** | B | Cinco alvos, ícone + rótulo. Rótulo em 10px é pequeno. |
| **PageHeader** | B | Chip de ícone em `muted` com glifo em `accent-text` — a marca concentrada, bem feito. |
| **Progress bar** | C | Retângulo de ponta reta, 4px. Sem `rounded-full` nas pontas, contradiz o anel que fica logo acima. |
| **Progress ring** | **A** | O único componente plenamente alinhado. |
| **Charts** | C | Barras retas; linha de tendência boa. |
| **Notice** | B | Quatro tons com ícone, `role` derivado do tom. Sistema honesto. |
| **Dialog / Sheet** | B | Sheet no celular, modal no desktop, regra escrita. Raio `2xl` fora do token de densidade. |
| **Toast** | B | Em `elevated` com sombra. Discreto. |
| **Empty states** | B | Agora unificados no tom `quiet`: tracejado, sem preenchimento. Consistentes. |
| **Error states** | B | `Notice` em `danger` com ícone, e o app distingue erro de aviso. |
| **Skeleton** | B | Pulso lento e raso, deliberado. |

---

## 7. A Home nos primeiros 5 segundos

1. **Primeira coisa percebida:** o número 772 dentro do anel verde. Correto — é a
   pergunta que o app existe para responder.
2. **Segunda:** a lista de refeições abaixo.
3. **Entende que é saúde?** Sim — kcal, macros, refeições, peso.
4. **Entende que é sobre progresso?** **Fracamente.** Vê-se o *estado de hoje*.
   Não se vê para onde está indo, exceto num "−2,9 kg nos últimos 30 dias" em
   texto pequeno no canto.
5. **Personalidade própria?** Pouca. Tirando o anel, é um dashboard.
6. **Premium ou template?** **Bem executado, mas template.** Nada ali é
   irreprodutível em uma tarde com Tailwind.
7. **Logo e interface parecem da mesma empresa?** **Não ainda.** A logo é
   orgânica e viva; a interface é ortogonal e contida.

| Critério | Nota |
| --- | --- |
| Identidade de marca | 5 |
| Clareza | 9 |
| Hierarquia | 8 |
| Personalidade | 4 |
| Sensação premium | 6 |
| Conexão com a logo | 4 |

---

## 8. Mobile — o mais crítico

> "O design foi pensado para celular ou reduzido do desktop?"

**Foi pensado para celular, e isso é demonstrável.** Os tokens de densidade
invertem a lógica usual: o mobile é a base e o desktop é *mais denso*, não maior.
Controles de 46px no celular contra 40px no desktop; toque do meio da série em
52px. Isso não acontece por acidente.

**Mas há dívidas reais:**

- **Alvos de toque.** Em `/exercicios` a 388px, **197 de 387 elementos
  interativos têm menor dimensão abaixo de 44px**. O número exagera — links
  inline de texto entram na conta — mas os botões de ícone de 32px (`size-8`) em
  linhas de lista, favoritar, editar e excluir, são reais e estão abaixo do
  mínimo.
- **Rótulo da barra inferior em 10px** (`text-[0.625rem]`). É o menor texto do
  app e fica na navegação principal.
- **Título truncado no resumo da sessão:** "Treino A — Emp…" a 388px.
- **Densidade do Diário.** Uma linha de item empilha nome, campo de gramas e
  quatro macros. Funciona, mas é a tela mais apertada do app.
- **Telas vazias demais.** `/treinos` no celular tem um campo, um botão e um
  cartão — o resto é 500px de nada.
- **Anel a 144px** ocupa pouco mais de um terço da largura. Poderia ser o herói
  que a marca pede.

**O que está certo e deve ser preservado:** barra inferior de cinco abas ao
alcance do polegar, incremento rápido de ±1 rep e ∓2,5 kg na série, cronômetro
fixo no rodapé, teclado decimal com vírgula.

---

## 9. Inconsistências encontradas

1. **Raio:** cinco vocabulários simultâneos — 12, 16, 18, 24 e pílula.
2. **Raio do sheet fora do token:** `rounded-t-2xl` é valor fixo; não acompanha a
   densidade.
3. **Terminação de traço:** o anel usa `strokeLinecap="round"`; as barras de
   progresso terminam em corte reto.
4. **Botão de ícone em 32px** (`size-8`) não pertence à escala de tamanhos de
   `Button` (38/46/52 no mobile). É um quarto tamanho, informal, em ~8 arquivos.
5. **Receita de borda de controle** repetida à mão em ~15 arquivos — input, chip,
   botão de ícone. Já registrado no roadmap.
6. **`--info` em hue 265** encosta na família slate das superfícies (256–266).
   Croma muito diferente, então não colide na prática, mas o comentário no token
   justifica 265 por um motivo que mudou quando a paleta virou slate.
7. **Duas famílias de peso tipográfico** sem regra: títulos usam `font-semibold`,
   rótulos de cartão `font-medium`, e o wordmark mistura os dois.
8. **Densidade de página:** `tight` e `roomy` só ganharam nome agora; antes eram
   dois paddings sem regra.
9. **Ícones:** todos de Lucide, stroke uniforme — consistentes entre si, mas
   uniformes é justamente o que a marca não é.

---

## 10. O que faz o LaCalle Life parecer template

- **O cartão retangular de canto arredondado com título à esquerda e link à
  direita.** É o cartão de todo dashboard desde 2015.
- **A barra de progresso de 4px.** MyFitnessPal, Strava, qualquer um.
- **A lista de alimentos com colunas KCAL/PROT/CARB/GORD.** Planilha.
- **Ícones Lucide.** Excelentes e usados por dezenas de milhares de produtos.
- **A grade de cartões 2/3 + 1/3.** Layout padrão de admin.
- **Estado vazio: ícone cinza + frase + botão.** Correto e visto em todo lugar.

### Como tornar proprietário

O caminho **não** é decorar. É escolher **dois ou três momentos** e desenhá-los
como só este app desenharia:

1. **O anel de calorias** vira a assinatura: gradiente da marca ao longo do arco,
   ponta arredondada, e um segundo arco fantasma mostrando *ontem* — a marca é
   trajetória, então o anel deveria comparar, não só medir.
2. **O recorde pessoal** ganha forma. Hoje é texto numa lista. É o dado mais
   emocional do produto.
3. **A conclusão de série** já tem o gesto certo; estendê-lo para meta batida.

Três momentos bem desenhados criam mais identidade que trinta cantos ajustados.

---

## 11. O que já está bom e deve ser preservado

| Elemento | Por quê |
| --- | --- |
| **A paleta** | Veio da marca, é medida, passa em AA nos dois temas. Não mexer. |
| **Tinta escura sobre o esmeralda** | Branco sobre o verde reprova (2,54:1). É decisão medida; reverter quebra AA. |
| **Superfícies slate** | Já testado contra verde: verde tira do esmeralda o papel de única cor saturada. |
| **Anel de calorias** | O melhor elemento do app e o mais alinhado à marca. |
| **Tokens de densidade** | Mobile como base, desktop mais denso. Raro e correto. |
| **`tabular-nums` sem monoespaçada** | Resolveu "parece log" sem perder alinhamento. |
| **Três tons de cartão** | Hierarquia por superfície e luz, geometria constante. |
| **Codificação de macro** | Uma tabela, dois rótulos, tokens de texto separados dos de área. |
| **Tabela em Alimentos** | Forma seguindo o dado. Já defendido duas vezes; não reabrir. |
| **Confirmação em dois toques** | Com barra de tempo restante. Preserva dado. |
| **Formatação pt-BR** | Com teste que varre o código. |
| **Barra inferior de 5 abas** | Ergonomia real. |
| **Voz dos textos** | "Nada registrado hoje ainda" — direta, sem infantilizar, sem parabenizar. É metade da personalidade que o app tem. |

---

## 12. Problemas priorizados

### P0 — crítico para a identidade

1. **Cinco vocabulários de raio.** Unificar numa escala só, derivada da marca.
2. **A logo não está no app.** Falta o vetor.
3. **Nenhuma tipografia de marca.** Números-herói em Geist são anônimos.

### P1 — alto

4. **Barras de progresso com ponta reta** contradizem o anel na mesma tela.
5. **Progresso não é comparativo.** O app mostra hoje; a marca promete trajetória.
6. **Recordes sem representação visual.**
7. **Botões de ícone de 32px** abaixo do alvo mínimo no celular.

### P2 — médio

8. Rótulo da barra inferior em 10px.
9. Título truncado no resumo da sessão a 388px.
10. Receita de borda de controle repetida em ~15 arquivos.
11. Telas quase vazias no celular (`/treinos`).
12. Gráfico de volume vira bloco sólido com pouco dado.

### P3 — polimento

13. Raio do sheet fora do token de densidade.
14. Comentário desatualizado do `--info`.
15. Pesos tipográficos sem regra escrita.

---

## 13. LACALLE DESIGN DNA

Especificação curta, para quem for implementar.

### Brand personality
Orgânica · Ascendente · Fluida · Viva · Confiante · Natural

### Shape language
A marca é **uma curva contínua**. A interface deve ser **retangular com curvas
generosas e consistentes** — não orgânica. Curva de verdade fica reservada para
**medição**: anel, arco, linha de tendência. **Todo arco no app mede alguma
coisa.** Arco que não mede é decoração e está proibido.

### Border radius
Uma escala, quatro degraus, e a regra de que **controles que se tocam
compartilham raio**:

- `sm` — badge, chip pequeno, thumbnail
- `md` — **botão e campo, o mesmo valor** (hoje divergem)
- `lg` — cartão, sheet, modal
- `full` — só para o que é circular por natureza: avatar, ponto, anel

Nada fora dos tokens. `rounded-2xl` fixo no sheet sai.

### Spacing
Ritmo de 4px. Padding de cartão vem da densidade (20px celular, 24px desktop).
Gap entre cartões: 12px. Gap entre seções: 32px. Estado vazio respira mais que
cartão cheio — é a única exceção de padding, e é intencional.

### Typography
- **Corpo:** Geist Sans, mantida.
- **Display:** uma geométrica arredondada, **só** para número-herói e título de
  tela. É onde a marca ganha voz tipográfica.
- **Números:** `tabular-nums` sempre.
- **Hierarquia:** título de tela 28/24px semibold · número-herói 36–40px · título
  de cartão 14px medium · corpo 14–15px · legenda 12px · nunca abaixo de 11px.

### Color philosophy
**Concentrada, nunca diluída.** Superfícies em slate; o esmeralda gasto só em
ação primária, estado ativo e progresso. Se o verde aparece em três lugares numa
tela, um deles está errado. Gradiente da marca: **um lugar só**, o anel.

### Iconography
Lucide, stroke uniforme, 1 glifo por conceito, vindo de `ICONS`. Ícone é
reconhecimento, não enfeite. A marca **não** vira ícone.

### Motion
Saída rápida, chegada lenta (`--ease-out`, expo). 150ms para cor, 220ms para
gesto, 300–500ms para dado que muda. **Animação ligada ao toque, nunca ao
estado** — o invariante que impede 24 checks de pularem ao abrir um treino.
Respeitar `prefers-reduced-motion`.

### Progress language
O elemento mais importante do sistema:

1. **Arco para o que é cíclico** (o dia, a sessão).
2. **Linha para o que é histórico** (peso, volume, carga).
3. **Barra para o que é fração** (macro contra meta) — **com ponta arredondada**,
   igual ao anel.
4. **Todo indicador de progresso mostra ou permite comparar com o passado.** É o
   que transforma "estado" em "evolução".
5. Estourar meta é âmbar, nunca vermelho.

### Cards
Três tons: `hero` (um por tela), `default`, `quiet` (vazio). Diferem por
superfície e luz, **nunca por geometria**. Nem tudo precisa de cartão — texto que
não agrupa nada fica direto na página.

### Buttons
Um primário por tela. Tinta escura sobre o esmeralda, sempre. Altura vem da
densidade. Botão que faz par com campo usa a altura **e o raio** do campo.
Ícone-só ganha um tamanho oficial na escala, com mínimo de 44px no celular.

### Navigation
Sidebar no desktop, barra inferior no celular, mesmo glifo nos dois. Item ativo
em esmeralda sólido — é o maior bloco de marca fora do anel.

---

## 14. Brand fit score

| Critério | Nota |
| --- | --- |
| Conexão com a logo | 4 |
| Identidade própria | 4 |
| Consistência visual | 6 |
| Tipografia | 5 |
| Cores | **9** |
| Shape language | 3 |
| Progress language | 5 |
| Mobile design | 7 |
| Hierarquia | 8 |
| Sensação premium | 6 |
| Personalidade | 4 |
| Coesão geral | 6 |

# BRAND FIT SCORE: 5,6/10

A cor puxa a nota para cima sozinha. Forma e tipografia puxam para baixo.

---

## 15. Veredito

> "Se eu colocasse a nova logo neste aplicativo amanhã, pareceria que ela sempre
> pertenceu a ele?"

**Não. Pareceria uma logo bonita colada num dashboard competente.**

Três coisas impedem, em ordem de peso:

1. **Forma.** A marca é uma curva contínua e modulada. A interface é uma grade de
   retângulos com cinco raios diferentes. Não é falta de arredondamento — é falta
   de **um** arredondamento.
2. **Tipografia.** Geist é técnica e neutra; o wordmark é geométrico e redondo.
   Colados lado a lado no cabeçalho, leem como duas marcas.
3. **Progresso como estado, não como trajetória.** A marca desenha uma
   trajetória. O app quase sempre desenha um instante.

**O que já está certo:** a cor. A paleta é a da marca, medida e correta, e é por
isso que a nota não é mais baixa. Cor é a metade fácil da identidade, e ela está
feita.

---

## 16. Plano de ação

### Sprint 1 — Identidade

| Mudança | Problema → Solução | Impacto | Prio | Risco |
| --- | --- | --- | --- | --- |
| Escala única de raio | Cinco vocabulários → uma escala, botão e campo iguais | Alto — toca toda tela | P0 | **Médio.** Mexe em todos os controles. Mitigar centralizando a receita antes. |
| Aplicar o símbolo | Placeholder "L" → a marca nos cinco lugares | Alto | P0 | Baixo. **Bloqueado: falta o vetor.** |
| Fonte de display | Números anônimos → voz tipográfica em 6 lugares | Médio-alto | P0 | Baixo. Escopo restrito; corpo não muda. |
| Gradiente no anel | Verde chapado → o gradiente da marca | Médio | P1 | Baixo. Um componente. |

### Sprint 2 — Componentes

| Mudança | Problema → Solução | Impacto | Prio | Risco |
| --- | --- | --- | --- | --- |
| Ponta arredondada nas barras | Corte reto contradiz o anel | Médio | P1 | Muito baixo. |
| Tamanho oficial de botão-ícone | 32px informal → entra na escala, 44px no celular | Médio | P1 | Baixo, mas mexe em ~8 arquivos. |
| Receita de controle centralizada | Borda repetida em ~15 arquivos | Baixo visual, alto de manutenção | P2 | Baixo. |
| Sheet no token de densidade | `2xl` fixo → token | Baixo | P3 | Muito baixo. |

### Sprint 3 — Páginas

| Mudança | Problema → Solução | Impacto | Prio | Risco |
| --- | --- | --- | --- | --- |
| Progresso comparativo no Hoje | Estado → trajetória (arco fantasma de ontem) | **Alto** | P1 | **Médio.** É a mudança mais próxima de escopo funcional. |
| Recordes com forma | Lista de texto → representação visual | Alto | P1 | Baixo. |
| Densidade do Diário no celular | Linha apertada demais | Médio | P2 | Médio — mexe na tela mais usada. |
| `/treinos` vazio no celular | 500px de nada | Baixo | P2 | Baixo. |

### Sprint 4 — Polimento

| Mudança | Impacto | Prio | Risco |
| --- | --- | --- | --- |
| Momento de meta batida | Médio | P2 | Baixo |
| Rótulo da barra inferior 10px → 11px | Baixo | P2 | Muito baixo |
| Título truncado no resumo | Baixo | P2 | Muito baixo |
| Regra escrita de peso tipográfico | Baixo | P3 | Nenhum |

---

## Ordem recomendada

**Comece pelo raio.** É P0, é a mudança de maior alcance visual por menor esforço,
e é a única em que a interface passa a falar a língua da marca sem depender do
vetor da logo chegar.

Depois **fonte de display** e **gradiente no anel** — juntas, são o que faz a Home
parar de parecer template.

**Progresso comparativo é o item de maior valor de produto**, e o de maior risco:
é onde a auditoria encosta em escopo funcional. Vale decisão sua antes.
