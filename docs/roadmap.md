# Roadmap

O que foi entregue, o que vem a seguir e o que ficou registrado para não
depender da memória de nenhuma conversa.

---

## Entregue

| Módulo | Estado |
| --- | --- |
| Fundação local-first | Contrato `Store<T>`, dois adapters conformes, migrações declarativas |
| Design system | Tokens OKLCH, dark mode sem flash, contraste asserido por teste |
| Alimentos | 581 — 216 curados da V1 + 365 da TACO (ingrediente simples), busca sem acento, favoritos, personalizados |
| Dietas | Refeições, itens, totais automáticos, metas opcionais |
| Motor nutricional | TMB, TDEE, metas, macros, validações — fonte única em `core/nutrition` |
| Perfil | Opcional de ponta a ponta; sem ele a dieta funciona igual |
| Exercícios | 183 curados à mão, busca com índice, filtros na URL, personalizados |
| Fotos dos exercícios | 105 pares verificados à mão, CC BY-SA 4.0 atribuída, via CDN |
| Treinos | Criar rotina, montar, configurar séries/reps/peso/descanso/RPE |
| Execução | Marcar série, cronômetro, edição inline, finalizar, resumo |
| Retomar e histórico | Treino em andamento, `/historico`, abrir/editar/apagar sessão |
| "Última vez" | Última performance por exercício durante a execução |
| PRs e volume | Recorde por exercício, volume por período, 1RM estimado |
| Drag and drop | Refeições, itens e exercícios da rotina — setas mantidas |
| Duplicar e copiar | Refeição, alimento entre refeições, exercício, rotina e dieta inteiras |
| Detalhe do exercício | Duas fases do movimento animadas, curadoria completa, fotos no treino |
| Evolução corporal | Peso, gordura e 9 medidas por dia, gráfico de tendência com média móvel |
| Identidade visual | Esmeralda da V1, escuro por padrão, contraste asserido nos dois temas — **as superfícies verdes serão revertidas**, ver a sprint abaixo |
| Densidade por contexto | Desktop mais denso que o celular, não menor — 1152px de conteúdo, cartão de 24px |
| Números em pt-BR | `formatDecimal` em toda superfície: 2,7 e 2.220, e travessão no lugar de `NaN` |
| Tela de hoje | Anel de calorias, macros contra a meta e o treino do dia — funciona sem perfil |
| Navegação no celular | Barra inferior de 5 abas ao alcance do polegar; o resto atrás de "Mais" |
| PWA e offline | Instalável, e abre sem rede — shell, assets e payloads de rota em cache |
| Incremento rápido | −1/+1 rep e ∓2,5 kg na série em execução, partindo do planejado quando o campo está vazio |
| Peso decimal digitável | O separador era engolido ao ser digitado: 6·2·vírgula·5 gravava 625 kg |
| Total à prova de dado corrompido | Um valor ilegível some da soma em vez de virar `NaN` e levar a tela inteira |
| Aviso de peso desatualizado | O perfil oferece usar a última pesagem quando divergem em 1 kg ou mais — oferece, não sincroniza |
| Toast de confirmação | Para as escritas que não deixam rastro na tela: salvar perfil, criar e editar alimento |
| Nome do exercício legível | O cabeçalho da rotina quebra no celular; o nome saiu de 3px para 139px em duas linhas |
| Página 404 própria | Diz o que aconteceu e oferece dois caminhos de volta, com a navegação do app |
| Rótulo de confirmação | `confirmLabel` virou obrigatório — o tipo impede cair no genérico |
| Tempo restante da confirmação | Barra que esvazia no ritmo do desarme, ligada ao mesmo `DISARM_AFTER_MS` |
| Filtro sobreposto | Sheet no celular, modal no desktop, com a contagem de resultados viva enquanto se escolhe |
| Regra modal vs inline | Escrita no `AGENTS.md` e em `dialog.tsx`, com o caso difícil nomeado |
| Criar exercício ao buscar | Antes só existia no estado vazio: com 8 resultados e nenhum sendo o seu, não havia saída |
| Ícone de tela inicial no iOS | PNG gerado pelo Next a partir do próprio traço, sem binário no repositório |
| Catálogo TACO | 365 alimentos da Tabela Brasileira de Composição de Alimentos somados aos 216 da V1 — só ingrediente simples, pratos compostos ficaram de fora; `seedCatalogue` passou de "só roda se o banco está vazio" para diff por id, senão a expansão não chegava a quem já tinha o app instalado |
| Fundo consistente em Hoje | Alimentação e Treino sempre com o cinza do `Card` padrão — antes só o treino em andamento tinha superfície, e o verde continua reservado só para esse estado |
| Corrigir início de treino travado | Campo "Início" na execução: uma sessão esquecida aberta parava de mostrar "começou há 56 horas" só depois de finalizada — agora dá para corrigir o horário sem sair do treino |
| Corrigir conflito falso em Treinos/Dietas | `use-diet-editor`, `use-routine-editor`, `use-session-runner` chamavam `persist()` de dentro do updater de `setState` — o React (`reactStrictMode: true`) invoca esse updater duas vezes de propósito, então uma única edição disparava duas gravações e a segunda perdia a corrida, aparecendo como "alterado em outro lugar" numa única aba. Corrigido com uma `ref` síncrona em vez do padrão funcional de `setState`. Achado pela auditoria externa de 19/08 (BUG-008) |
| `Select` no design system | Todo `<select>` nativo do app (unidade g/ml, mover item, RPE, categoria, sexo/atividade/objetivo) ganhou borda, hover e chevron próprios — o popup continua nativo de propósito, mesma razão do `RpeSelect` original. Pedido depois que o seletor g/ml saiu "meio invisível" |
| Tamanho de botão personalizável | Preferência por aparelho (Compacto/Padrão/Confortável) em Perfil → Aparência, mesma arquitetura do tema. Só afeta altura/padding de botão — input fica fixo em 44px por regra do brandbook, card tem eixo de densidade próprio |
| Dieta vinculada a dia da semana | Iniciativa E do roadmap, decidida e entregue: uma dieta pode ocupar vários dias, um dia aponta pra uma dieta só, o Diário sugere direto em vez de precisar abrir a lista. Atalhos de "fim de semana" e um preset pessoal de "dias de treino" |
| Gráfico de duração em Evolução | Alternância Volume/Duração nos gráficos semanal e mensal de Treinos — mesmo componente de barras, generalizado com `metric`/`formatMetric` em vez de duplicado. Inspirado num app de referência que o Pedro trouxe; único item das sete telas comparadas que valia a pena, o resto (feed social, conta/assinatura, donut de macro) não coube na arquitetura ou na regra de "um destaque por tela" |

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar → rever no histórico.

---

## Sprint atual — redesign visual

Pedido em 10/08/2026, a partir de duas auditorias independentes (uma da V1,
uma da V2). Escopo **exclusivamente visual**.

### O diagnóstico

A V2 parece um **dashboard técnico / terminal / SaaS de desenvolvedor**. Deveria
parecer um app de saúde, nutrição, treino e bem-estar: moderno, confiável,
agradável, acolhedor.

### A regra

**V1 é a referência visual. V2 é a referência funcional e estrutural.**

Não é copiar componente da V1, nem inventar uma terceira linguagem. É entender o
que fazia a V1 parecer um app de saúde e reproduzir esses **princípios** aqui,
preservando o que a V2 evoluiu. O teste é olhar para a tela e pensar "é
claramente o mesmo produto que a V1".

Quando a estrutura da V2 for melhor — a barra inferior é o exemplo — **mantém-se
a estrutura e troca-se a aparência**.

### Isto reverte uma decisão desta mesma trilha

Registrado porque o `tokens.css` argumenta o contrário, por escrito, e quem ler
só o comentário vai desfazer o redesign de boa fé.

O verde nas superfícies foi pedido ("deixa o verde mais forte, é pra ser o msm
verde que está na V1") e implementado de propósito. O raciocínio na época: a V1
concentra cor numa sidebar de 256px em croma 0.08, a V2 não tem sidebar, então a
cor que ela carregaria foi **espalhada pelas superfícies**.

A medição feita então continua valendo e agora aponta para o outro lado: **na V1
os cartões são neutros — croma 0.01**. A cor mora num elemento só. Espalhar foi
o erro; a saída não é menos verde, é verde concentrado.

### P0 — Identidade ✅ entregue

- [x] **Superfícies neutras de verdade.** Croma caiu de 0.03–0.065 para
      0.005–0.008 no escuro; a profundidade passou a vir de claridade, em
      degraus de ~5 L\* medidos no navegador (2,8 → 7,8 → 13,1 → 18,3).
- [x] **O verde ganha valor ao recuar.** Medido na tela: a superfície tem a\*
      −1,9 e o accent −72,8. O esmeralda é, por larga margem, a coisa mais
      saturada em vista — e agora só aparece na aba ativa, no CTA e no progresso.
- [x] **Números param de parecer log.** As 50 ocorrências saíram; `tabular-nums`
      ficou onde a monoespaçada estava, então o alinhamento sobreviveu à troca.
      A Geist Mono não é mais carregada.
- [x] **Escuro é dark fitness app, não green terminal.**
- [x] **Claro não é o escuro invertido.** Página neutra clara, cartão branco
      destacando por claridade antes da sombra.

Tokens de estado (`warning`, `info`) criados junto — não existiam, e é por isso
que tudo caía em verde ou vermelho. Sucesso é o accent e erro é `danger` de
propósito: um segundo verde ao lado de uma marca verde não é um estado, é ruído.

### P1 — Hierarquia

- [x] **Caloria como herói.** O anel foi de 128px para 144/176px e o número de
      `text-2xl` para `text-3xl sm:text-4xl`.
- [x] **Desktop usa a largura.** Alimentação e treino lado a lado a partir de
      `lg`, dois terços contra um — a proporção diz qual é o principal.
- [x] **Cor de macro sobrevive ao dia zerado.** As barras já usavam
      `protein/carbs/fat`, mas com 0 g a largura é 0% e só o trilho cinza
      aparecia; um ponto colorido ao lado do rótulo carrega a identidade quando
      a barra não pode. Marca identidade, não estado: mantém o tom quando a
      barra fica vermelha por estouro.
- [x] **Refeições e progresso no Hoje.** Saiu junto com o preenchimento da tela:
      `TodayMeals` e `TodayProgress` respondem o que foi comido e para onde o
      peso está indo. A tela passou de duas perguntas para quatro.
- [x] **Cartões com identidade.** O `Card` ganhou três tons — `hero`, `default`
      e `quiet` — que diferem por **superfície e luz, nunca por geometria**:
      mesmo raio e mesmo padding, porque cartão que também muda de forma deixa
      de parecer da mesma família. `hero` é a única coisa que a tela existe para
      mostrar, no máximo um por tela; `quiet` é o cartão sem conteúdo ainda.

      Junto foram embora **onze superfícies escritas à mão** — seis contêineres
      de lista e cinco estados vazios. Não era só duplicação: por serem escritos
      à mão nunca receberam a hairline do topo, então no escuro a lista de
      alimentos parecia um buraco recortado na página enquanto os cartões ao
      lado pareciam elevados. Os cinco estados vazios também discordavam entre
      si sobre o padding (`py-12` contra `py-14`).
- [x] **CTA primário inconfundível** em toda tela que tenha um. O achado não foi
      falta de destaque — foi o CTA principal **desalinhado do campo ao lado
      dele** nas três telas de lista. Em Dietas e Treinos o "Criar" era `lg`
      (46px) contra um campo de 40px; em Alimentos o "Novo" nem vinha do
      primitivo: `h-11` escrito à mão, 44px, quatro pixels pendurados abaixo da
      busca. O botão passou a ler a altura dos mesmos tokens de densidade que o
      campo, e os dois `Link` estilizados à mão como botão primário — Alimentos
      e o fim da sessão — passaram a usar `buttonClasses()`.

      **Hoje continua sem CTA, de propósito.** A tela responde perguntas e a
      navegação está três centímetros acima; o item pede CTA em toda tela *que
      tenha um*.

### P2 — Design system

- [x] **Macros com codificação consistente.** A tripla estava definida em **seis
      lugares** com rótulo e cor próprios, e o "sumir na outra" era literal: no
      formulário de alimento personalizado — a única tela onde alguém *digita*
      proteína, carboidrato e gordura — não havia cor nenhuma. Agora há uma
      tabela só, `design-system/macros.ts`, com rótulo curto e longo (um cabe
      num cabeçalho de refeição, o outro num resumo de perfil).

      **Achado medido: `carbs` como texto reprovava em AA no tema claro** —
      3,58:1 contra o mínimo de 4,5. Os três tokens foram afinados para área
      (barra, ponto, gráfico) e são asseridos a 3:1, que é o que um gráfico
      deve; mas cinco telas imprimem esses números como texto pequeno. Daí
      `--protein-text`, `--carbs-text` e `--fat-text`, a mesma separação que
      `--accent-text` já fazia — só a claridade muda, hue e croma continuam
      idênticos. Nove duplas novas no `tokens.test.ts` fecham a lacuna.
- [x] **Estados visualmente distinguíveis.** Componente `Notice` com quatro
      tons, substituindo a receita da caixa de alerta escrita à mão em **19
      lugares, todos vermelhos** — o app só sabia dizer uma coisa. Cada tom
      leva ícone, porque cor sozinha falha para quem não separa vermelho de
      âmbar e falha para todo mundo no sol segurando o celular entre séries.
      O `role` vem do tom e não do call site: `alert` interrompe leitor de tela,
      `status` espera a vez — nota de rodapé não grita.
- [x] **Estourar meta virou âmbar, não vermelho.** Era o mesmo `danger` de
      "não consegui ler seus dados". Comer 30 g de carboidrato além da meta
      merece ser notado e não é falha; vermelho fazia uma terça-feira normal
      parecer defeito.
- [x] **Advisories do perfil saíram do cinza.** A única mensagem que diz "mudei
      o que você pediu" era renderizada em `bg-muted text-ink-muted`, idêntica
      a uma legenda inerte.
- [x] **Iconografia.** Cada rota já tinha um glifo no cabeçalho; o que faltava
      era eles concordarem. **Dois dos quatro tabs abriam numa tela com outro
      ícone** — Hoje era casa na barra e calendário na página, Diário era talher
      na barra e caderno na página. Ícone que muda entre o toque e a chegada é
      pior que ícone nenhum: gasta a atenção do leitor e depois se contradiz.

      Agora vem tudo de `design-system/icons.ts`. Dois empates desfeitos, com o
      raciocínio registrado lá: **Hoje é calendário** (a tela se chama Hoje e a
      marca no topo já leva ao início) e **Diário é talher** (as duas coisas são
      verdade, e o desempate foi para o glifo que o app já usava três vezes).

      A folha "Mais" ganhou os quatro ícones que não tinha — era o único lugar
      onde alguém está *procurando* uma tela, e o único sem os glifos. O cartão
      de Treino no Hoje era o único dos quatro sem um.

      Fora de escopo: **a navegação do desktop segue só texto.** Oito links num
      cabeçalho lêem bem, e o item pede ícone para reconhecer, não para encher.
- [ ] **Nada de valor solto no componente.** Cor, tipografia, radius, sombra e
      espaçamento centralizados em token. As doze superfícies e os dois botões
      primários escritos à mão saíram; o que resta são os controles — input,
      chip e botão de ícone repetem a mesma receita de borda em cerca de quinze
      arquivos.

      Dois saíram desde então: o **controle de Filtros**, que Alimentos e
      Exercícios implementavam em separado, e o botão de ícone, que ganhou
      regra única na Sprint 2.

      **O raio do botão contra o do campo estava listado aqui como decisão em
      aberto — foi resolvido na Sprint 1.** Os dois leem `--corner-md`. A
      direção escolhida foi a que a sprint pedia: arredondar mais, com o botão
      indo de 12 para 18px no celular.

### P3 — Consistência

- [ ] **Uma linguagem só entre desktop e mobile.** A barra inferior fica; ganha a
      identidade da V1. No desktop, navegação reconhecível e com hierarquia.
- [ ] **Mobile não paga a conta do desktop.** Alvo de toque, legibilidade,
      pouco esforço visual — o app é usado durante a refeição e durante o treino.
- [ ] **Alimentos parece planilha.** A lista pode continuar lista; a tela precisa
      parecer app de alimentação. (Ver a decisão tabela-vs-cartão mais abaixo: a
      forma foi escolhida por causa do dado, e continua valendo. O que muda aqui
      é o acabamento — hierarquia, agrupamento, busca, filtro, estado.)

      **Busca e filtro saíram na Sprint 3B** — chips recolhidos, contagem viva
      na folha, contador no botão. Faltam hierarquia, agrupamento e estado.
- [ ] **Exercícios:** o filtro foi apontado como um dos melhores componentes
      atuais. Preservar a ideia — chips, categorias, modal, badges — e trazer
      para a mesma linguagem. O controle que **abre** o filtro já veio para a
      receita compartilhada na Sprint 2; os chips e o modal continuam como
      estavam, de propósito.
- [ ] **Evolução:** os dados ficam, o tratamento muda. Progresso é conquista, não
      tabela de métricas.
- [x] **Passar em todas as rotas** com dado de verdade no banco — perfil, cinco
      pesagens, dieta de três refeições, diário do dia, treino de três
      exercícios e uma sessão concluída, tudo semeado pelos formulários do
      próprio app. Três defeitos que só existem com dado dentro:

      1. **`72.5 kg` com ponto** no resumo da sessão, e mais nove superfícies
         chamando `toLocaleString("pt-BR")` direto — separador certo, mas
         pulando o travessão que `formatDecimal` põe no lugar de `NaN`. As duas
         coisas estão listadas como entregues aqui em cima e nenhuma tinha
         teste. Agora `core/format/number-format.test.ts` varre o código e
         falha apontando arquivo e linha.
      2. **135px de buraco no Hoje** entre Treino e Progresso. Os dois eram
         filhos diretos do grid, então a altura vinha das linhas que a coluna
         da esquerda definia — enquanto todo o resto da tela usa 12px.
      3. **Os dois cartões do Hoje se tocavam no celular.** O espaçamento era
         `lg:space-y-3`, e conferido na folha compilada essa regra vive dentro
         de `@media (min-width:64rem)`: abaixo disso não havia regra nenhuma.
         Num app cuja premissa é o celular, na tela que ele abre primeiro.

      Conferido e **não** é defeito: campo de data e hora saem em `MM/DD` e
      `AM/PM` neste navegador porque controle nativo segue o locale do
      navegador (`en-US` aqui), não o `lang` da página — o valor gravado é
      `2026-08-12`. E as miniaturas de exercício carregam (`falhas: 0`); elas
      parecem vazias no tema claro porque são fotos sobre fundo branco.
- [ ] Preservar o que a V2 já corrigiu da V1: 404 com identidade própria,
      skeleton neutro, tema persistente, sem navegação redundante, componente
      reutilizável.

### P4 — Polimento

- [x] **Série concluída.** O toque mais repetido do app, dado de pé e sem olhar
      com atenção — ali o retorno é funcional, não enfeite. O check assenta com
      leve ultrapassagem em 220 ms.

      **Atrelado ao toque, nunca ao estado.** Uma animação ligada a
      `isCompleted` dispararia também na montagem, e reabrir um treino de 24
      séries faria 24 checks pularem juntos — a diferença entre um app que
      reconhece você e um que te parabeniza por rolar a tela. O invariante tem
      teste próprio.
- [ ] **Microinteração no resto:** alimento registrado, treino concluído, meta
      atingida, peso registrado. Os três primeiros já têm toast; o que falta é
      o momento da meta batida.
- [ ] Estados vazios no padrão da V1: ícone + mensagem clara + CTA relevante.

### As cinco sprints implementadas

12 a 14/08/2026, depois que a marca chegou. Sprints 1 e 2 estão no GitHub; **3 a
5 ficam em commits locais até a trilha ser validada** — decisão tomada, não
esquecimento.

- **Sprint 1 — raio e área de toque.** O raio passou a expressar **papel** e não
  tamanho: inline, controle, contêiner, marcador. Eram seis valores sem regra
  nenhuma, e cinco apareciam na mesma tela a 388px. Na prática mudou uma coisa —
  **o botão adotou o raio do campo**, 12 → 18. `--radius-xl` deixou de ser
  mapeado de propósito, para que um `rounded-xl` esquecido fique errado na hora
  em vez de funcionar quieto e reintroduzir um quinto vocabulário. Os 183 alvos
  pequenos da auditoria eram um controle só repetido, a estrela de favoritar: o
  desenho fica em 32px e a área cresce por pseudo-elemento, fora do layout —
  crescer a estrela cresceria a linha, e a densidade é o que torna 183
  exercícios navegáveis.
- **Sprint 2 — a assinatura.** O anel ganhou o degradê da marca e é o único
  lugar do produto que tem um; **estouro segue âmbar chapado**, porque vestir um
  aviso com a assinatura seria mentir. O botão de ícone voltou a ser controle: a
  Sprint 1 o tinha feito círculo, e círculo é fechado e estático onde a marca é
  fita aberta e direcional. Tipografia: só título de tela, só tracking e peso —
  o H1 media −0,84px, que é convenção de neo-grotesca e o oposto do wordmark. E
  o `9/9` virou dois pixels na borda da barra fixa, sem trilho atrás: não é
  componente, é linha de percurso, e não pode competir com o anel.
- **Sprint 3 — composição do Hoje.** O anel saiu da moldura compartilhada. Era o
  elemento mais proprietário do produto dentro da mesma caixa, no mesmo raio,
  com o mesmo cabeçalho dos três cartões abaixo — que é exatamente como uma
  assinatura lê como widget. As macros desceram, Refeições, Treino e Progresso
  viraram seções abertas, e o agrupamento passou a vir do espaço: as bordas
  estruturais da Home caíram de 6 para 3. Na **3B**, o anel ganhou estado vazio
  — tracejado no trilho, nunca no progresso — e os filtros de Alimentos foram
  recolhidos: abertos custavam ~200px em toda visita e empurravam a tabela para
  444px no celular; medido depois, 240px.
- **Sprint 4 — Treinos abre na ação.** A tela levava 336px até o primeiro
  treino, 80% da viewport, com um subtítulo reafirmando o título para quem tinha
  acabado de tocar numa aba escrita Treinos. Ficou em 160px sem sessão aberta,
  272px com uma. O espaçamento é desigual de propósito: 12px antes do formulário
  e 28px depois dizem quais dois blocos formam um momento, sem desenhar borda.
  **A composição da Home não virou template** — o que atravessou foi a gramática,
  não o layout.
- **Sprint 5 — trilha de execuções. Entregue e não aprovada.** Cada rotina passou
  a carregar as últimas oito semanas com uma marca por sessão concluída, **na
  posição do tempo real**: com marcas equidistantes, três sessões em dez dias e
  três espalhadas em dois meses desenhariam a mesma coisa, e a tela voltaria a
  mostrar contagem em vez de cadência. Nenhum dado novo — `Session.routineId`
  liga sessão a rotina desde que sessões existem. Só a marca mais recente leva o
  esmeralda.

#### Composição do Hoje em blocos — 14/08/2026

Pedida diretamente, e **não é a Sprint 6**: a trilha de execuções continua
intocada e continua não validada. Escopo fechado no Hoje.

As quatro seções sem contorno viraram **cinco blocos num grid** — calorias,
macros, refeições, treino, progresso — todos com o mesmo raio, o mesmo padding
e a mesma borda. O ranking sai da geometria: o anel é a maior coisa da tela e a
única forma que o app não desenha em nenhum outro lugar, e é isso que o mantém
como assinatura. Vesti-lo diferente dos vizinhos seria hierarquia por
decoração.

**Isto reverte parte da Sprint 3A**, que tirou as bordas de propósito. O
argumento de lá continua verdadeiro — o anel dentro da mesma caixa dos outros
lê como widget — e a resposta agora é outra: todos ganham caixa, e o que
distingue é o conteúdo. Medido no antes: com as seções soltas, Treino tinha
**52px contra 194 de Refeições**, lado a lado na mesma linha. Duas metades do
dia com essa diferença de peso não estavam dizendo nada verdadeiro. Agora medem
244 e 244.

Custo registrado: a página cresceu de **849px para 1209px de altura no
celular** — cinco blocos com padding próprio ocupam mais que quatro seções sem
contorno. Foi contido em 139px ao manter as macros em três colunas no celular e
empilhá-las só a partir de `lg`, que é onde elas precisam de altura para ficar
ao lado do anel. Abaixo disso não há nada para equilibrar, e empilhar custava
altura em troca de nada.

#### A trilha está em validação, não em refinamento

Ela custou **25 a 41px por cartão** (76 → 101–117) numa tela cujas Sprints 3 e 4
existiram justamente para reduzir a distância até a ação. E o caso que
justificaria esse preço — várias execuções espaçadas ao longo de semanas —
**nunca foi visto com dado real**: o banco de teste tem uma rotina com uma
execução. Sete testes cobrem a semântica das marcas e **nenhum deles responde se
alguém decide melhor por causa delas**. Teste verde prova correção técnica, não
valor de produto.

**Não propagar para Dietas, Alimentos, Diário ou Perfil. Não compactar, não criar
prop de densidade, não abrir sprint de refinamento em cima dela.** Com histórico
real acumulado, três perguntas:

1. Com 3–5 execuções **próximas**, a frequência é percebida na hora?
2. Com 3–5 execuções **espaçadas**, a diferença de cadência fica óbvia?
3. Rotina nunca executada ao lado de uma com histórico — a trilha **muda a
   decisão**, ou é informação decorativa?

Três sins → trajetória temporal vira linguagem do produto e vale generalizar,
com cada tela mostrando a dimensão temporal do *seu* dado — não todas ganhando
trilha. Menos que isso → cortar ou simplificar sem apego.

### Dependência e lacunas conhecidas

- **A logo não existe.** O pedido cita "o novo símbolo do LaCalle Life quando
  disponível", para header, mobile, favicon, loading e estado vazio. É o mesmo
  buraco do item _Identidade_ mais abaixo, e continua sendo o único bloqueio
  desta sprint.
- **"Configurações" e "Ajuda" não são rotas da V2.** Aparecem na lista de telas
  a revisar porque existiam na V1. Criar rota é escopo funcional, não visual —
  fica fora até haver decisão.

### O que não muda

Funcionalidade, dado, rota, regra de negócio, cálculo nutricional, lógica de
treino, persistência e modelo de dados. Nada de simplificar recurso para
facilitar o redesign. **A sprint é visual.**

### Antes de dizer pronto

Além do `npm run verify` e do `npm run build` de sempre: conferir as rotas
principais nos dois temas, no celular e no desktop, procurando especificamente
por verde excessivo, contraste insuficiente, número parecendo código, cartão sem
hierarquia, tela vazia demais e componente que destoa do resto.

A pergunta de controle, antes de cada componente: **"isso pertence a um app
moderno de saúde, nutrição e treino?"** Se a resposta for "parece SaaS",
"parece ferramenta de desenvolvedor" ou "parece terminal", refazer.

---

## Roadmap

### 1. Refinamentos restantes de `/exercicios`

Levantados na auditoria de UX. O detalhe do exercício saiu daqui e foi
entregue; o resto continua adiado:

- Navegação por grupo muscular na primeira dobra
- Agrupar os 19 chips de músculo em 6 regiões
- Reduzir o ruído da linha (três tags por linha)
- Recentes e mais usados

### 2. Cobertura de fotos

**25 exercícios sem imagem**, de 78 originais. A segunda passagem no
`free-exercise-db` fechou 47 e o `wger` fechou 6.

As duas fontes livres estão esgotadas. Para os 25 restantes existem três
caminhos, e a escolha é de produto:

1. **Deixar sem foto.** O modelo trata isso como estado legítimo e a tela de
   detalhe funciona sem imagem. Custo zero, lacuna permanente.
2. **Permitir que uma foto sirva a mais de uma entrada** quando o movimento é
   o mesmo e só o equipamento muda — leg press horizontal usando a foto do
   45°, elevação pélvica na máquina usando a da barra. Fecharia cerca de 12.
   Custo: a foto mostra um equipamento diferente do que o nome promete.
3. **Fotografar ou ilustrar sob encomenda.** Fecha tudo, com custo real.

Gerar por IA está fora: contradiz a regra fundadora do projeto.

### 3. Fotos de progresso

A metade da evolução corporal que ficou de fora. Exige infraestrutura que
ainda não existe: redimensionar a imagem antes de guardar (uma foto de celular
tem 4 MB, e uma por semana enche o IndexedDB em um ano) e um store separado,
para que ler um peso não arraste blobs junto.

### 4. Fibra rastreável

Hoje o perfil calcula uma meta de fibra (14 g por 1000 kcal) que o app não tem
como conferir: **nenhum dos 216 alimentos carrega fibra**. A tela passou a
dizer isso em voz alta — é referência para ler no rótulo, não meta acompanhada
— porque um número ao lado de proteína, carboidrato e gordura promete uma
medição que nunca chega.

Fechar de verdade exige fibra na fonte, e a fonte é o problema: inventar valor
para 216 alimentos contraria a regra de omitir na dúvida. O caminho realista é
uma tabela que já traga o dado (a TACO traz) e uma migração que acrescente o
campo, com `null` para o que não for encontrado.

Meia solução é pior que nenhuma: somar só os alimentos que tiverem fibra
mostraria "12 g de 31" para quem comeu 25 — um número errado com cara de certo.

### 5. Sincronização

A camada de repositório foi desenhada para isto desde o primeiro commit:
`updatedAt` em toda entidade, ids gerados no cliente, e a raiz de composição
como único ponto que sabe qual implementação está por trás de cada interface.
Trocar local por remoto é editar `composition/`.

Exigirá tombstones para deleção propagar — decisão adiada de propósito, e que
muda implementações de adapter, nunca portas nem UI.

**Sprint de arquitetura entregue em 24/08/2026, ainda sem código** — ver
`docs/arquitetura-sincronizacao.md`. Mapeou as oito entidades, separou
catálogo de foods/exercises (dado de referência, nunca por usuário) dos
favoritos e customizados (dado real de usuário), e resolveu a pergunta
central por família de entidade — `BodyEntry` e `Profile` sempre em
conflito visível (nunca last-write-wins silencioso, mesmo sendo "só um
número"), `FoodLog` com merge estruturado por `Meal.id` como única
exceção, `Session` em progresso não sincroniza até `finishedAt`.

**As seis perguntas de produto foram fechadas no mesmo dia** (§17 do
documento) e o schema completo do Postgres/Supabase está desenhado (§18):
DDL de todas as tabelas, RLS sem política de `DELETE` (tombstone via
`deleted_at`, apagar de verdade só por `service_role`), trigger de
`server_updated_at` para nunca confiar no relógio do cliente, e o esboço da
função RPC que faz o equivalente ao `putIfVersionMatches` local contra o
Postgres. Nenhum arquivo de migration real foi criado e nenhum código de
app foi tocado — é desenho para revisão antes da Sprint de Auth.

---

## Auditoria de robustez — 13/08/2026

Feita numa sessão **sem acesso ao código**, só com o app rodando no navegador.
Os achados abaixo foram depois **conferidos na fonte**, e a conferência mudou o
veredito de dois deles — que é a razão de registrar a verificação junto e não só
o relato.

### Confirmados

- [x] **Peso e medidas entram sem validação nenhuma.** `features/body` era a
      **única feature sem pasta `validation/`**: o formulário chamava
      `parseDecimal` e gravava o que viesse. A auditoria pegou peso negativo
      (−15 kg aceito, virando "peso atual" e distorcendo gráfico e delta); lendo
      o código, gordura corporal e as nove medidas tinham o mesmo buraco. O
      padrão a replicar já existia e a própria auditoria o chamou de exemplar:
      `foods/validation/food-schema.ts`. **Fechado em 15/08 como BUG-009** da
      auditoria externa.
- [ ] **Sessão de treino não tem teto de duração.** Uma esquecida "em andamento"
      acumulou 25h de cronômetro e, ao finalizar, gravou isso como duração real
      no histórico. **O gatilho foi uma sessão de teste deixada aberta em
      12/08** — mas a ausência de limite é do produto, e quem dorme com o treino
      aberto produz o mesmo lixo. Decisão de produto pendente: encerrar
      automaticamente, marcar como suspeita, ou só limitar o que é gravado.
- [x] **Quantidade de alimento aceita até 100 kg.** `Math.min(Number(digits),
      100_000)` em `meal-item-row`. O teto existe para conter número colado, não
      para sanidade nutricional — e agora diz isso, como `MAX_GRAMS`. Continua
      sendo 100 kg de propósito: apertar para uma faixa "plausível" transformaria
      um guarda contra colagem numa opinião sobre o que se pode comer, e o app
      não tem essa. Revisado junto do **BUG-002** em 15/08.

### Verificados e **não** são defeito

- **Botão de finalizar "não responde a cliques únicos".** É a confirmação de
  dois toques: `DISARM_AFTER_MS = 4000`, então cinco toques espaçados armam e
  desarmam cinco vezes sem confirmar. Existe para impedir que encerrar um treino
  na série 1 de 8 seja um toque acidental. **Não mexer no `useArmed`** — mas o
  fato de um auditor ter tentado cinco vezes e concluído "quebrado", mesmo com o
  rótulo mudando para "Encerrar assim?" e a barra de tempo esvaziando, é achado
  de **comunicação**, e esse é legítimo.
- **"Falha silenciosa" ao criar dieta ou treino com nome vazio.** O botão fica
  `disabled` com o campo vazio. Não há erro porque não há submissão.

### O que a auditoria não pôde ver, e o que disso é vazio de verdade

Banco, backend, autenticação server-side, build, lint, testes e responsividade
ficaram marcados como BLOCKED por falta de acesso — **não como aprovados**. Com
o repositório, build/lint/testes e modelo de dados são verificáveis. Mas
**backend e autenticação vão continuar vazios**, e não por falta de acesso: o
app é local-first, sem servidor e sem contas. Não há o que auditar ali.

Do lado positivo e verificado: React escapa corretamente (não foi possível
produzir XSS), rota com id inválido não vaza detalhe interno, e não há segredo
em `localStorage`.

---

## Auditoria visual — 14/08/2026

Cinco achados, e **um só é novo**. Registrar o saldo importa mais que a lista:
auditorias externas vão continuar reencontrando os outros quatro enquanto a
causa não mudar, e sem isto escrito eles voltam parecendo cinco problemas.

### Novo — e é sobre a solução, não sobre o produto

- [x] **O estado vazio do anel era lido como defeito.** **Três observadores
      independentes** descreveram o anel do Hoje como "o único elemento que
      esqueceu a marca — cinza em vez de verde", ou como um círculo feito de
      bolinhas. A mecânica estava correta: sem nada registrado não há arco, o
      trilho ficava tracejado e a legenda virava "kcal para hoje" — a mesma
      regra de não desenhar progresso inexistente que vale para as barras de
      macro.

      **Mas a mecânica estar certa não salvou a comunicação.** Três leitores
      atentos chegando à mesma conclusão errada é o veredito: o tracejado não
      dizia "ainda não", dizia "quebrado".

      Resolvido em 14/08 — o trilho é sólido e contínuo em todo estado, e a
      ausência é dita pela legenda. **O efeito colateral está aceito de olhos
      abertos**: o anel vazio volta a ser o círculo cinza sólido que a Sprint
      3B existiu para evitar. O tracejado era a tentativa de resolver isso e
      falhou por ler pior, então o cinza sólido é o estado conhecido e não uma
      descoberta. Se ele incomodar, a próxima tentativa precisa ser outra
      coisa — traço interrompido já foi testado e reprovado por três leitores.

### Os outros quatro já estão documentados

- **Ícone do app é um "L" placeholder** e **a sidebar não tem símbolo**: são o
  mesmo bloqueio, não dois achados — falta o vetor da marca. Ver
  `docs/logo-brief.md` e _Identidade_ mais abaixo. É a pendência mais antiga em
  aberto, e nenhuma auditoria vai deixar de encontrá-la enquanto o arquivo não
  existir.
- **Ícones flat contra logo com gradiente**: decidido em `docs/auditoria-marca.md`
  — Lucide é correto e neutro, e a marca **não vira ícone**. A alternativa é
  desenhar um conjunto proprietário, que é escopo grande e não priorizado.
- **Qualidade desigual das fotos de exercício**: item 2 deste roadmap. É da
  origem — bases livres, 105 pares verificados à mão, 25 sem foto — e as três
  saídas possíveis já estão escritas lá.

O `<script>alert(1)</script>` encontrado em Dietas era dado de teste da própria
auditoria anterior, no IndexedDB local. React escapa corretamente; não houve
risco.

---

## Auditoria externa — 14/08/2026

Sobre o commit `d84d5c9`, com o código em mãos e o app em build de produção.
Veredito **NÃO PRONTO**, nota 6,5, **nenhum P0**, 22 achados.

O padrão vale mais que a lista: **a arquitetura é boa; o risco mora na
orquestração UI → hook → repositório → storage.** 22 hooks, 1 testado. Os quatro
P1 estão todos nessa camada, e é por isso que o plano abaixo é por camada e não
por severidade.

### O plano, em cinco frentes

Não é a ordem da auditoria. Ela misturava integridade de dado com qualidade
arquitetural; aqui os dois estão separados, e **entre uma frente e a seguinte
entra uma auditoria focada**.

1. **Integridade** — BUG-002, 003, 009 · ✅ entregue, ver abaixo
2. **Durabilidade** — BUG-004: sem `navigator.storage.persist()` e **sem
   exportação**. Medido: `persisted: false`, 5,8 MB de 10.246 disponíveis.
3. **Concorrência** — BUG-001, 008: duas abas na mesma dieta se sobrescrevem em
   silêncio. `updatedAt` existe e ninguém lê.
4. **Infraestrutura** — BUG-005, 007, 010, 014
5. **UX e performance** — BUG-006, 011, 013, 016, 017

**Duas ressalvas que valem mais que os achados:**

- **`persist()` é hardening, não backup.** Não cobre limpar o navegador,
  desinstalar o PWA, trocar de aparelho ou perder o celular. **Exportação é
  obrigatória**; `persist()` é recomendado. Não tratar um como o outro.
- **Não mudar a arquitetura de agregado** por causa do BUG-001. A decisão está
  certa para o tamanho do dado; falta o mecanismo que a protege — concorrência
  otimista por `updatedAt` **no repositório**, não `BroadcastChannel` na UI.

### O que a auditoria **não** validou

A distinção importa: _não encontrei defeito_ não é _foi validado_. Ficaram de
fora iOS e Safari, qualquer aparelho físico, leitores de tela reais, drag and
drop, cronômetro de descanso, upgrade de schema com aba antiga aberta, cota
cheia, curadoria par a par das 105 fotos, e **a trilha de execuções —
deliberadamente**, porque ela mesma ainda está em validação.

### Frente 1 — Integridade ✅ entregue em 15/08/2026

Os três achados foram conferidos na fonte antes de qualquer correção, e cada
correção foi **provada revertendo-a e vendo o teste falhar** — teste de
regressão verde não prova nada por si.

- [x] **BUG-002 · o campo de gramas gravava `12,5` como `125`.** `toGrams` fazia
      `replace(/\D/g, "")`, e a defesa contra o sinal negativo comia o
      separador junto. Dez vezes a porção, na ação mais repetida do app,
      propagando para o total da refeição, o do dia, o anel e a comparação com a
      meta — e nada parecia errado, porque 125 é um número de gramas
      perfeitamente comum.

      **Parsear não bastava**, que era a correção proposta pela auditoria: com o
      valor voltando do número gravado, digitar `12,` parseia para 12,
      re-renderiza como `"12"` e a vírgula some antes do próximo dígito.
      Precisou da técnica de rascunho que `WeightField` já usava. **É a segunda
      cópia dela, de propósito** — compartilhar exigiria subir um componente de
      treinos para o design system, e esta frente não podia refatorar. Está
      escrito no próprio arquivo. Consolidar as duas é candidato a follow-up.

- [x] **BUG-003 · refeição criada no Diário nunca era gravada.** `isEmptyLog`
      chamava de vazio um dia cujas refeições não tinham itens, e o hook apaga o
      que julga vazio em vez de gravar. O nome, o horário e as notas ficavam na
      tela e em lugar nenhum. Passou a ser `meals.length === 0`: declarar uma
      refeição é registro de intenção, e o app pediu por ela.

- [x] **BUG-009 · `features/body` era a única feature sem `validation/`.** O
      formulário chamava `parseDecimal` e gravava o que viesse: −15 kg entrava e
      virava "peso atual", distorcendo a linha de tendência e o delta de 30 dias.
      Agora tem `body-schema.ts`, com piso e teto para peso, gordura e as nove
      medidas, mensagem por campo e `aria-invalid` ligado ao erro. Peso e gordura
      reusam `INPUT_BOUNDS`, que o motor nutricional já aplica às mesmas duas
      grandezas — duas faixas para uma medida é como o app viria a discordar de
      si mesmo.

Isto também fecha dois itens da _Auditoria de robustez_ mais acima: a validação
ausente em `features/body` e o teto de gramas, que agora existe como
`MAX_GRAMS` com o motivo escrito.

### Frente 5 — UX e Acessibilidade · parcial, 15/08/2026

Adiantada fora de ordem, por decisão direta: em vez de seguir 2 → 3 → 4 → 5,
esta sprint atacou só o **BUG-006** e os dois achados de comunicação que andam
junto dele — **BUG-016** e **BUG-017** — deixando **BUG-011** (listas sem
virtualização) e **BUG-013** (service worker sem checar `response.ok`) para
quando a frente for retomada por completo. Nenhuma das outras quatro frentes
foi tocada.

Cada correção foi **provada revertendo-a e vendo o teste cair** antes de ser
aceita, e o BUG-006 também foi medido no navegador, antes e depois, em build
de produção — não só em `jsdom`.

- [x] **BUG-006 · o `ConfirmButton` tinha área de toque efetiva de 15 × 15 px.**
      `overflow-hidden` vivia no mesmo elemento que carrega `touch-44`, e
      recortava o pseudo-elemento que a *utility* usa para expandir o alvo para
      44 × 44 sem crescer o desenho — um ícone de 16 ou 32 px continuava
      parecendo o mesmo ícone, mas o toque ao redor dele desaparecia junto com o
      corte. Medido antes: 16×16 visual, 15×15 efetivo — os números exatos do
      laudo. Medido depois, em três instâncias reais e nas seis larguras
      pedidas (320 a 430 px): 41 a 43 px nos dois eixos, variando com o quanto
      os controles vizinhos na mesma linha também disputam área de toque. A
      barra de confirmação, que precisava do corte para não escapar dos cantos
      arredondados, passou a viver num `<span>` próprio que cobre só a caixa
      visual — a área de toque continua sendo o `<button>` inteiro.
- [x] **BUG-016 · o valor de cada barra do gráfico de volume só existia em
      `title`.** Tooltip nativo não abre no celular, e o `sr-only` que cobria o
      resto existe só para leitor de tela — não para quem enxerga a barra e não
      usa um. Uma
      linha de resumo — sempre visível, sem hover — mostra o período mais
      recente por padrão e troca ao tocar em qualquer barra, que virou um
      `<button>` de verdade. Nenhum número por barra: 12 períodos imprimindo
      cada um o seu valor é a "tela cheia de números" que a correção evita.
- [x] **BUG-017 · série concluída com peso e sem repetições saía do volume
      calada.** A fórmula estava certa — não há o que multiplicar sem a
      repetição —, o silêncio é que era o defeito. `sessionVolumeKg` agora
      também conta quantas séries concluídas caíram nesse caso específico, e
      dois lugares avisam: o cartão de término do treino ("kg movidos", a
      frase que o laudo citou ao pé da letra) e o relatório permanente da
      sessão. **A exclusão de peso corporal continua muda, de propósito** — é
      o caso comum e documentado há mais tempo neste arquivo, e avisar sobre
      ele alarmaria toda série sem peso do produto.

Testes: 868 → 887 (19 novos, em 5 arquivos — 2 deles novos:
`volume-chart.test.tsx` e `session-summary.test.tsx`). `verify` e `build`
verdes; conferido em build de produção no navegador com um treino real de três
séries, uma delas sem repetições.

---

## Brand System V1.1 — aplicado em 15/08/2026

O brandbook chegou como PDF e virou a fonte de verdade da identidade. A
aplicação inteira está registrada em **`docs/brandbook.md`**: as seis
divergências com a emenda proposta para cada uma, os quatro conflitos internos do
documento com a leitura adotada, o checklist da pág. 53 item a item e os três
testes de identidade da pág. 52.

Leia de lá. O que fica aqui é só o saldo:

- [x] **Tokens** — a paleta neutra deixou de ser slate e virou a escala Gray;
      tipografia de Geist para Inter, com a escala de LH e tracking acoplada ao
      tamanho; raios 8/12/16/20/24 fixos, sem os proibidos 14 e 18; as duas
      curvas oficiais e os quatro tiers de duração.
- [x] **A marca** — a pendência mais antiga do repositório, fechada. Ver
      _Identidade_ mais acima.
- [x] **A casca** — sidebar de 264 px com grupos e bloco de conta na base,
      drawer na faixa de 768–1023, tab bar abaixo de 768, conteúdo em 1280.
- [x] **Componentes** — card, botão, input, estados e ícones na anatomia das
      pág. 24 a 28.
- [x] **Motion e dados** — `prefers-reduced-motion` virou fade de 120 ms em vez
      de 0,01 ms, que apagava também hover, foco e confirmação de ação.

**Três coisas que este trabalho reverteu**, e valem registro porque cada uma
tinha razão escrita:

1. **O degradê do anel saiu.** Era a assinatura da tela Hoje, entregue na Sprint
   2. A pág. 46 proíbe gradiente em barras de progresso, e um anel é uma barra
   curvada. O teste da própria página decide: remova o gradiente e veja se a peça
   deixa de funcionar — não deixa.
2. **O anel de foco voltou a ser o acento.** O comentário que defendia o azul
   dizia que verde "some sobre o botão verde"; medido, com `outline-offset` de
   2 px o anel encosta na página e o acento mede 3,60 contra ela, enquanto o azul
   media 1,32 contra o verde.
3. **O título da página voltou a crescer no desktop.** Encolher era defensável,
   mas a tabela da pág. 32 é explícita na direção contrária.

### O que ficou de fora, e por quê

Está detalhado em `docs/brandbook.md`, seção _Lacunas conhecidas_. Em resumo: o
grid de 12 colunas não está aplicado literalmente (margens, gutter e largura
máxima estão; a contagem de colunas não), e sobram usos de 6 e 2 px fora da
escala base 4. **O BUG-006** — a área de toque de 15 × 15 px do
`ConfirmButton` — foi **fechado em 15/08**, na Frente 5 (ver acima).

---

## Ajustes pendentes

Os treze achados verificados das **auditorias de design** foram fechados. Sobram
dois: uma oportunidade e um achado de contraste. Os achados de robustez e os
visuais têm seção própria mais acima e não estão contados aqui.

### `ink-subtle` sobre linha em hover, no escuro

Medido ao dar superfície ao cartão herói. No tema escuro `ink-subtle` sobre
`muted` mede **3,97:1** — abaixo dos 4,5:1 que texto exige. Só acontece no
hover de uma linha de lista, e em quase todo lugar é inofensivo porque o mesmo
elemento troca para `text-ink` ao passar o mouse. **A exceção é a porção de
`food-row`**, que fica em `ink-subtle` durante o hover.

Não foi corrigido junto porque a saída óbvia — clarear `ink-subtle` até 0.665 —
o encosta em `ink-muted` (0.73) e apaga a diferença entre "secundário" e
"terciário" no app inteiro, para resolver um estado de hover. A saída provável
é a linha trocar de cor no hover, como as outras já fazem.

### Identidade

O app tem voz e comportamento reconhecíveis, mas nenhum elemento gráfico
exclusivo além da cor: tirando o nome do topo, não há uma forma, ícone ou
ilustração que seja só dele. É oportunidade, não defeito — um gesto visual
pequeno (marca no anel de progresso, ilustração para estado vazio) transformaria
"app calmo e técnico" em algo identificável à primeira vista.

**A marca chegou em 12/08/2026** e o bloqueio caiu pela metade. Ver
`docs/logo-brief.md`.

- [x] **A paleta do app é a da marca**, nos dois temas, com todas as duplas de
      contraste aferidas. O nome virou `LaCalle`, com C maiúsculo. **Em 15/08 a
      paleta foi substituída pela do Brand System V1.1** — os neutros deixaram
      de ser slate e passaram a ser a escala Gray da pág. 18; o acento
      emerald 500/600/800 sobreviveu intacto, porque era o mesmo.
- [x] **O brilho da apresentação entrou, o verde nas superfícies não.** Foram
      comparadas quatro variantes na mesma tela e com o mesmo dado — slate puro,
      verde sutil, verde forte, e slate com brilho. As quatro passam em AA, então
      a escolha foi de olho. Verde forte é o modo de falha que originou a sprint,
      e tem custo: com o fundo verde o esmeralda deixa de ser a única coisa
      saturada em vista. O brilho põe o verde **no ar e não no material**.
- [x] **O símbolo entrou em 15/08/2026**, e a pendência mais antiga do
      repositório fechou. O "L" placeholder saiu do favicon, do ícone do iOS e
      do maskable, e a assinatura completa — símbolo + "LaCalle" + qualificador,
      como a pág. 14 obriga dentro de um produto — entrou no cabeçalho e na
      sidebar.

      **O bloqueio era o vetor, e a saída foi reler o que faltava.** A nota
      antiga dizia que traçar a fita a partir do PNG "seria adivinhar curva por
      curva", e ela estava certa sobre a arte que tinha em vista: uma fita
      renderizada em 3D, cuja leitura vem inteira do sombreado. Mas a versão que
      o brandbook pede na pág. 8 é outra — "em monocromia, usar a versão de
      contorno preenchido" — e essa é a silhueta do canal alfa, que é um
      contorno fechado, sem buracos e sem quinas. Traçada em resolução 6× e
      ajustada em bézier, ela diverge do original em 6,6% de área, quase toda a
      franja de antialias de 1 px.

      O maior render disponível em qualquer um dos dois brandbooks mede
      **139 × 137 px** — é o teto, e uma curva ajustada em cima dele fica melhor
      que ele, não pior. Quando o vetor oficial da pág. 51 existir, ele
      substitui duas constantes em `design-system/brand/mark.ts` e nada mais
      muda: `mark.test.ts` garante que os SVGs de disco não possam divergir do
      módulo.

---

### Tabela em Alimentos, cartão em Exercícios — decidido, não pendente

Uma auditoria de design leu isso como inconsistência. É a forma seguindo o
dado: alimento se **compara** — kcal, proteína, carboidrato e gordura alinhados
em coluna dão para varrer de cima a baixo — e exercício se **reconhece**, por
foto e tag. Unificar em cartão tiraria o alinhamento dos macros; unificar em
tabela tiraria a foto, que é justamente o que identifica um exercício de
relance.

Fica registrado porque a próxima auditoria vai apontar de novo.

---

## Sprint 3 — Release Reliability ✅ entregue em 16/08/2026

A partir da auditoria de fechamento pós-sprints (15/08), que manteve o veredito
**NÃO PRONTO** com três P1: dois herdados (BUG-001, BUG-004) e um novo,
introduzido pelo Brand System (overflow horizontal mobile). Esta sprint **não é
de design** — nada de tokens, cor, tipografia, raio ou motion mudou.

Critério de conclusão, todos atendidos: zero overflow horizontal nas seis
larguras testadas, BUG-001 fechado com teste de conflito real (não `save()`
retorna sucesso), BUG-008 verificado, export/import funcionando com validação
antes de escrever, `persist()` como hardening depois disso, suíte e build
verdes, Brand System intacto — mais os quatro fluxos centrais, reload e
fechar/reabrir confirmados juntos na Fase 4.

Os três P1 que travavam o release na auditoria de 15/08 estão fechados. Não
significa "pronto para produção" sem ressalvas — os P2/P3 do laudo original
seguem abertos, de propósito: esta sprint tinha um escopo, e não era esse.

### Fase 1 — REGR-MOBILE ✅ entregue em 16/08/2026

- [x] `PAGE_SHELL_BLEED` em `page-shell.tsx`, ao lado de `pageShell()`, para que
      sangria e padding só possam descasar se alguém editar um sem olhar o outro.
- [x] Substituir `-mx-6 … px-6` em `food-log-screen.tsx`, `diet-editor.tsx`,
      `session-runner.tsx`, `routine-editor.tsx`, `session-editor.tsx`.
- [x] Validar 320/360/375/390/414/430 px em `/diario`, `/sessao/[id]`,
      `/treinos/[id]`, `/dietas/[id]` — `scrollWidth === clientWidth` nos quatro,
      nas seis larguras. Medido com dado real criado na hora (rotina com um
      exercício, sessão iniciada, dieta), não com o banco vazio, porque o
      cabeçalho fixo só existe depois que há conteúdo para rolar.
      `typecheck`/`lint`/`test` (887) e `build` verdes antes da medição.

### Fase 2 — BUG-001 e BUG-008 ✅ entregue em 16/08/2026

Concorrência otimista no repositório, como a auditoria de 14/08 já havia
decidido — nunca `BroadcastChannel` na UI.

- [x] `putIfVersionMatches` em `Store<T>`, implementado nos dois adapters —
      uma transação `readwrite` única no `IndexedDbStore`, para que nada
      escreva entre a leitura e a comparação; `MemoryStore` é atômico por
      construção (JS de thread única, sem `await` entre ler e escrever).
- [x] `revise()`, e todo `create*` de agregado, passam a emitir `updatedAt` de
      `entityTimestamp()` — um relógio monotônico por processo, não
      `Date.now()` cru. Precisou cobrir as fábricas de criação também, não só
      `revise()`: um teste real pegou uma criação e a primeira edição caindo no
      mesmo milissegundo, o que zerava a checagem de versão silenciosamente.
      **Risco residual documentado, não escondido:** duas abas com relógios de
      sistema distintos podem, em teoria, colidir no mesmo milissegundo; um
      campo `version` inteiro fecharia isso por completo, a um custo de
      migração que esta sprint decidiu não pagar agora.
- [x] `DataError("CONFLICT")` novo, com mensagem própria em
      `describe-data-error.ts`; os cinco repositórios de agregado (rotina,
      sessão, dieta, diário, corpo) exigem a versão esperada em `save()`;
      conflito nunca sobrescreve em silêncio.
- [x] `apply()` de `use-routine-editor`, `use-session-runner` e
      `use-diet-editor` passou para a forma funcional de `setState` — não só
      por causa da versão esperada. Achado durante a implementação: sem isso,
      múltiplos `apply()` no mesmo lote do React perdiam edição **no próprio
      estado da UI**, antes mesmo de qualquer escrita — o mecanismo real por
      trás do "1 de 3 é gravado" do laudo original. `use-food-log` resolve o
      mesmo problema com uma ref em vez de updater com efeito colateral, que
      este arquivo já havia banido antes por um motivo próprio.
- [x] Teste determinístico por domínio (rotina, sessão, dieta, diário, corpo):
      A lê v, B lê v, A salva, B rejeitada — contra `IndexedDbStore` real, não
      só `MemoryStore`. Mais criação duplicada rejeitada, sequência válida de
      atualizações, e conflito contra uma entidade removida.
- [x] BUG-008 com teste de componente real: dois toques síncronos (`fireEvent`,
      não `userEvent` — que já insere esperas entre toques) marcando duas
      séries diferentes no mesmo lote do React. As duas sobrevivem, na tela e
      no IndexedDB.
- [x] Reproduzido ao vivo, duas abas reais, build de produção: aba A renomeia
      a rotina, aba B — que carregou antes da edição de A — tenta renomear
      diferente. B é rejeitada com o aviso na tela; o banco guarda a versão de
      A. Confirmado por leitura direta do IndexedDB, não só pela tela.
- [x] 936 testes (887 → 936, 49 novos), `typecheck`, `lint` e `build` verdes.

### Fase 3 — BUG-004 ✅ entregue em 16/08/2026

Exportação e importação vêm antes de `persist()` — é o backup real, `persist()`
é hardening.

- [x] `exportAll()`/`importAll()` em `composition/backup.ts`, cobrindo os oito
      stores (rotina, sessão, dieta, diário, corpo, perfil, alimentos,
      exercícios) — `schemaVersion` próprio, independente da versão de
      migração do banco.
- [x] Import valida o envelope inteiro (zod) e a forma mínima de cada registro
      antes de escrever qualquer coisa; nunca abre uma transação com o arquivo
      não validado. Toda a escrita acontece numa única transação IndexedDB
      abrangendo os oito stores — uma falha no meio reverte todos, não deixa o
      banco pela metade.
- [x] `navigator.storage.persist()` disparado no startup da composição,
      silencioso e tolerante a recusa — nunca bloqueia a inicialização.
- [x] Fronteira arquitetural respeitada, não contornada: o lint pegou a
      própria auditoria tentando importar `composition/backup` direto de um
      componente. Resolvido com o padrão já usado em todo o resto do app —
      `BackupRepository` em `features/profile/data/`, provider ligado por
      `composition/`. A interface exposta à feature nem conhece a forma real
      do arquivo (`Diet[]`, `Routine[]`...) — só `unknown` e um resultado
      genérico, exatamente para não vazar tipo de outras features para dentro
      de uma.
- [x] Painel em `/perfil`: exportar baixa um `.json`; importar exige escolher
      o arquivo e depois confirmar em dois toques (`ConfirmButton`) — trocar
      tudo por engano custa uma segunda intenção clara. Mostra se o navegador
      concedeu armazenamento persistente.
- [x] 20 testes novos: round-trip por domínio, round-trip via
      `JSON.stringify`/`parse` (não só o objeto em memória), arquivo inválido,
      envelope corrompido, registro sem a forma mínima de entidade, versão
      incompatível, importação vazia substituindo o banco — todos confirmando
      que uma falha **não toca no banco existente**. Mais a UI isolada com um
      `BackupRepository` falso.
- [x] Reproduzido ao vivo, ponta a ponta, build de produção: criada uma rotina
      real, exportado um arquivo de 245&nbsp;KB (216 alimentos + 183
      exercícios + a rotina), banco inteiro apagado via
      `indexedDB.deleteDatabase` — o mesmo efeito de "limpar o navegador" —,
      arquivo reimportado, rotina de volta com o **mesmo id**, confirmado no
      IndexedDB e na tela de Treinos.
- [x] 949 testes, `typecheck`, `lint` e `build` verdes.

### Fase 4 — Release verification ✅ entregue em 16/08/2026

Passagem final, com tudo junto, depois de cada blocker já ter sido verificado
ao vivo isoladamente na própria fase que o resolveu.

- [x] 949 testes, `typecheck`, `lint` e `build` de produção verdes numa
      última rodada limpa.
- [x] `git diff` revisado — 56 arquivos (47 modificados, 9 novos), zero
      `console.log`/`debugger`/comentário de depuração esquecido, zero arquivo
      de Brand System ou token tocado, `package.json` intacto.
- [x] Os quatro fluxos centrais, numa sessão contínua no build de produção:
      criar rotina → adicionar exercício → iniciar treino → concluir uma série
      (Monte treinos); criar dieta (Monte dietas); registrar um alimento no
      diário de hoje (Registre alimentação); registrar peso (Acompanhe
      evolução).
- [x] Reload da página — os quatro domínios sobreviveram, decimal com vírgula
      correto (78,5, não 785).
- [x] Fechar a aba e abrir uma nova no mesmo endereço — mesmo resultado.
      **Um achado do próprio processo, não do produto:** a primeira tentativa
      de registrar o alimento reportou sucesso mas não persistiu — o clique
      caiu na lista de busca do seletor, não no item; o texto "Abacate"
      continuava na tela de qualquer forma, o que bastava para a checagem
      ingênua passar. Corrigido repetindo a ação e **confirmando pelo
      resultado observável (fechar e reabrir), não pela resposta imediata do
      clique** — o mesmo cuidado que a rodada de BUG-001 já exigia.
- [x] Overflow horizontal mobile reconferido nas quatro rotas centrais com
      dado real (não formulário vazio), 320–430&nbsp;px: zero.
- [x] BUG-001, BUG-008 e BUG-004 não foram reexecutados ao vivo nesta fase —
      cada um já tem prova ao vivo própria, na fase que o resolveu, e nenhum
      arquivo relevante mudou desde então. A suíte automatizada que os cobre
      (conflito de duas abas em cinco domínios, toques síncronos no mesmo
      lote, round-trip de backup) continua verde nesta rodada.

---

## Feedback de uso real e validação adversarial — 16/08/2026

Duas rodadas de evidência consolidadas aqui: a validação de uso real por
telas (Perfil, Hoje, Diário, Treinos, Dietas, Alimentos, Evolução) e o
resultado da Sprint 4 — validação adversarial independente, veredito
**READY WITH KNOWN RISKS**, zero blocker de release, seis riscos residuais
registrados. Cada item de UX abaixo foi conferido no código antes de virar
proposta; o enquadramento é o mesmo de sempre — o produto precisa ser
entendido, usado e confiado por uma pessoa comum, sem o Pedro explicando o
funcionamento por trás.

Formato por iniciativa: objetivo, problema, impacto no usuário,
dependências, escopo, fora de escopo, prioridade, critérios de aceite,
evidência necessária e — quando aplicável — riscos. Prioridade em cinco
níveis: **P0** bloqueador, **P1** alta prioridade antes de escala, **P2**
importante, **P3** melhoria, **P4** polish/futuro.

---

### RESOLVIDO — não reabrir sem evidência nova

- **BUG-001/BUG-008 (concorrência otimista), BUG-004 (export/import +
  persist), REGR-MOBILE (overflow responsivo).** Sprint 3, commit
  `8ddb76c`, cada um provado ao vivo com duas abas reais e build de
  produção. Não é hipótese — tem reprodução documentada na seção da Sprint 3
  acima.
- **Cálculo automático de calorias a partir dos macros.** Já existe:
  `estimateKcal` em `foods/services/create-food.ts` (`proteína×4 +
  carboidrato×4 + gordura×9`), já ligado ao formulário de alimento
  personalizado (`custom-food-form.tsx:99-102`) como sugestão que nunca
  sobrescreve o valor digitado, já coberto por teste
  (`create-food.test.ts`), e já é a **única exceção documentada** à regra de
  "nada de sugestão automática" (seção _Fora de escopo_ deste arquivo: "é
  aritmética, não opinião sobre o que comer"). A ressalva sobre fibra
  também já está no comentário da própria função. **Não criar de novo.**
- **Criação de exercício personalizado.** Existe e está visível:
  `createCustomExercise` → `useExerciseCatalogue` → botão "Criar exercício"
  em `exercise-browser.tsx:302-305`, presente no estado vazio **e** dentro
  dos resultados de busca (item já entregue: "Criar exercício ao buscar").
  A única ação cabível é conferir se algum ponto de entrada ficou de fora —
  não reimplementar.
- **Horário do Diário em AM/PM não é bug de armazenamento.** Investigado em
  14/08 e de novo nesta rodada: `<input type="time">` nativo em
  `meal-card.tsx:114`, o formato de exibição segue o locale do navegador,
  o valor gravado já é ISO 24h (`"14:30"`). O pedido de mostrar sempre 24h é
  legítimo, mas é item de UX/produto novo (ver Iniciativa A), não correção
  de um defeito de dado.

### RISCOS ACEITOS — Sprint 4, não bloqueiam usuário real, mas seguem registrados

- **NOVO-3.** Peso de série aceita magnitudes absurdas, sem crash nem perda
  de dado. Aceito por ora; se algum item futuro mexer em `WeightField`, vale
  revisar limites junto.
- **BUG-007.** Erros de IndexedDB observados durante `next build`, não
  reproduzidos em requisição real de produção. Aceito, monitorar.
- **Offline real, instalação PWA e atualização de service worker em
  dispositivo físico** — não testados ainda. Aceito como risco residual,
  não como item de código; entra como critério de aceite da Iniciativa F
  abaixo, que já mexe na mesma camada.

---

### A — Linguagem, onboarding e confiança

- **objetivo:** reduzir a maior fonte de confusão para quem nunca usou o
  produto, sem tocar em dado nem estrutura.
- **problema:** três pontos concretos de jargão/orientação ausente.
  1. TDEE aparece sem tradução — ocorrência única confirmada em
     `profile/components/plan-summary.tsx:65`, `label="TDEE"`, não se repete
     em nenhum outro componente.
  2. A tela Hoje funciona sem perfil (já é requisito entregue), mas não
     convida ninguém a completá-lo.
  3. A execução de treino não tem cabeçalho de coluna —
     `session-exercise-card.tsx` não imprime nenhum rótulo, enquanto o
     editor de rotina já tem `# REPS PESO RPE`.
- **impacto no usuário:** três pequenas barreiras de compreensão no
  primeiro contato com o produto — exatamente onde "pessoa comum sem o
  Pedro explicando" mais aparece.
- **dependências:** nenhuma entre os três itens; nenhuma com outra
  iniciativa.
- **escopo:** (1) trocar o rótulo por algo como "Gasto calórico diário
  estimado", com TDEE como detalhe secundário se algum usuário avançado
  precisar — não remover o termo tecnicamente, só deixar de ser a primeira
  coisa que aparece; (2) cartão não-bloqueante em Hoje, com CTA direto para
  `/perfil`, que some sozinho quando o perfil fica completo, no padrão
  `Notice` já usado no resto do app; (3) replicar em
  `session-exercise-card.tsx` o mesmo cabeçalho que o editor de rotina já
  tem.
- **fora do escopo:** revisão geral de microcopy — é iniciativa própria,
  ver abaixo; qualquer mudança no motor nutricional.
- **prioridade:** **P1** — os três itens são baratos e o ganho é direto.
- **critérios de aceite:** rótulo novo em todas as telas onde TDEE aparecia
  (uma só, confirmado); aviso de Hoje aparece com perfil incompleto e some
  ao completar; cabeçalho de execução idêntico em rótulo ao do editor.
- **evidência necessária:** teste de render por item; nenhum precisa de
  suíte de integração nova.

#### A.1 — Ritmo de mudança de peso: presets, não valor livre

- **objetivo:** tirar do usuário a obrigação de saber "quanto é seguro"
  perder ou ganhar por semana.
- **problema:** hoje `weeklyChangeKg` é texto livre
  (`profile/components/profile-form.tsx`), com a única orientação sendo a
  dica "Opcional. É limitado ao que for sustentável." — sem dizer o que é
  sustentável.
- **impacto no usuário:** a pessoa digita um número sem saber se é seguro,
  e só descobre no envio se foi rejeitado ou silenciosamente ajustado.
- **contraponto técnico à proposta original:** presets fixos em kg/semana
  (0,25 / 0,5 / 0,75 / 1) não podem ser implementados como pedido.
  `core/nutrition/constants.ts` define `MAX_WEEKLY_LOSS_RATIO = 0.01`
  (1%/semana) e `MAX_WEEKLY_GAIN_RATIO = 0.005` (0,5%/semana) —
  **percentuais do peso corporal, assimétricos entre perder e ganhar, não
  valores fixos.** Exemplo real: para 60 kg, o teto de corte é 0,6 kg/semana
  — o preset de "1 kg/semana" já seria inválido; o teto de ganho é 0,3
  kg/semana — **até "0,5 kg/semana" already estouraria o limite seguro de
  ganho.** Presets fixos funcionariam para uns pesos e quebrariam
  silenciosamente para outros.
- **dependências:** nenhuma de outro item; precisa de uma decisão de rota
  antes de codar.
- **escopo:** presets derivados do percentual já existente no motor, não de
  números fixos — apresentados por objetivo (perda/ganho/manutenção), com
  rótulo qualitativo ("ritmo leve/moderado") e o kg/semana resultante
  calculado e arredondado por pessoa. "Personalizado" continua aceitando o
  valor livre já validado hoje.
- **fora do escopo:** qualquer alteração dos limites do motor nutricional
  em si — reuso, não mudança de regra.
- **prioridade:** **P1** — é o item mais citado como confuso, mas só entra
  em sprint depois da decisão de rota (ver Decisões Pendentes).
- **critérios de aceite:** presets corretos e distintos para peso
  baixo/médio/alto; nenhum preset oferecido estoura o teto da pessoa;
  "Personalizado" inalterado.
- **evidência necessária:** testes contra `MAX_WEEKLY_LOSS_RATIO`/
  `GAIN_RATIO` para múltiplos pesos, incluindo casos de borda.

#### A.2 — Revisão de microcopy

- **objetivo:** tirar a "cara de IA" do texto do produto sem virar
  prescrição de estilo.
- **problema:** uso excessivo de travessão e explicação longa em vários
  pontos do app, sem levantamento por arquivo nesta rodada — é auditoria de
  tom, não um achado pontual.
- **impacto no usuário:** soa artificial, contradiz o objetivo de "escrito
  por equipe de produto, não por chatbot".
- **dependências:** nenhuma técnica.
- **escopo:** passada de revisão tela por tela contra o tom já definido em
  `docs/brandbook.md` — frases mais naturais, menos explicação redundante,
  consistência de tom. Não é proibir travessão, é reler cada string com
  essa vara de medir.
- **fora do escopo:** reescrita completa de qualquer fluxo; mudança de
  informação, só de tom.
- **prioridade:** **P3** — real, mas sem risco e sem urgência; é trabalho
  contínuo, não uma sprint fechada.
- **critérios de aceite:** não há métrica automática — critério é revisão
  humana contra o brandbook.

### B — Modelo de unidade e porção de alimento (estrutural)

- **objetivo:** permitir registrar comida do jeito que as pessoas comem —
  "1 ovo", "1 fatia", "100 ml de leite" — não só em grama.
- **problema:** `MealItem.grams: number` é o único campo de quantidade em
  todo o domínio de dieta (`diet/types/diet.ts`) — `Meal`, `MealOwner` e
  `Diet` não carregam nenhum conceito de unidade alternativa.
  `itemMacros` calcula direto `scaleMacros(item.per100g, item.grams)`
  (`diet/services/diet-macros.ts:16-17`). O seletor de quantidade
  (`meal-item-row.tsx`) é um stepper numérico de grama, com teto de 100 kg
  já documentado como guarda contra colagem, não opinião nutricional.
- **impacto no usuário:** quem não pesa comida — a maioria — converte de
  cabeça toda vez, ou desiste de registrar.
- **dependências:** compartilha schema de `Food` com o item de nutrientes
  opcionais (ver Alimentos, abaixo) — fazer as duas mudanças na mesma
  decisão evita duas migrações separadas do mesmo tipo. **É pré-requisito
  de sequenciamento (não técnico) para a Iniciativa E** — evitar duas
  mudanças estruturais grandes em paralelo no mesmo domínio de dieta.
- **escopo da fase de decisão** (não é ainda escopo de implementação):
  - quais unidades são universais (g, kg, ml, l) vs. específicas por
    alimento (unidade, fatia, colher, xícara, porção);
  - como cada unidade converte para grama/mililitro por alimento;
  - como representar líquidos (densidade varia — leite ≠ água ≠ óleo, "100
    ml" não é sempre "100 g");
  - como tratar alimento vendido por unidade, onde "1 ovo" pode ter um
    valor nutricional diferente de "100 g de ovo" dependendo da fonte;
  - pesquisar/avaliar fonte de dado nutricional que já traga porção por
    unidade (mesma pesquisa já cogitada para fibra — TACO ou equivalente);
  - como preservar compatibilidade com os 216 alimentos já curados e com
    todo `MealItem` já gravado.
- **proposta técnica preliminar** (a confirmar na fase de decisão): **não
  generalizar `MealItem.grams`** — é a base de cálculo confiável hoje, e
  mexer nele arrisca quebrar silenciosamente cinco lugares (total da
  refeição, do dia, anel, meta, histórico). Rota aditiva: `Food` ganha uma
  lista opcional de unidades nomeadas (`{ label, grams }[]`), a UI de
  adicionar/editar item oferece "unidade + quantidade" e converte para
  grama **na entrada** — `MealItem.grams` continua sendo o dado gravado,
  zero migração do que já existe.
- **fora do escopo (agora):** qualquer código de produção. Isto é desenho
  de dado.
- **prioridade:** **P1 estrutural** — é a mudança mais citada como
  importante ("SUPER IMPORTANTE" no seu próprio texto), mas é também a
  maior mudança estrutural desta rodada inteira. Fase de decisão antes de
  qualquer sprint de implementação.
- **critérios de aceite (da fase de decisão):** documento de schema final,
  plano de conversão por unidade, decisão sobre os 216 alimentos existentes
  e sobre a fonte de dado nutricional, revisado antes de qualquer PR.
- **evidência necessária:** nenhuma de código ainda — a evidência que falta
  é de produto (fonte de dado, escopo de curadoria).
- **riscos:** subestimar o tamanho é o risco real aqui — toca cadastro de
  alimento, catálogo curado, seletor de quantidade, picker, editor de dieta,
  diário e o cálculo nutricional em si. Por isso a fase de decisão vem
  antes, não depois.

### C — Descoberta e catálogo de exercícios

- **objetivo:** que "bíceps" encontre rosca direta, e que o catálogo seja
  confiável, não só grande.
- **problema:** `search-exercises.ts` indexa só `name` e `aliases`,
  confirmado por leitura completa — `MUSCLE_LABELS` (mapa de rótulo em
  português, ex. `biceps: "Bíceps"`) já existe em `taxonomy/muscles.ts` e
  não é usado na busca. Separadamente, "duplicatas" suspeitas no catálogo
  — ex. puxada alta na máquina vs. puxada frontal pronada — foram
  conferidas em `workouts/data/catalogue/costas.json`: têm taxonomia de
  músculo e padrão **idênticas**, diferindo só no campo `equipment` (cabo
  vs. máquina). É distinção real mal comunicada, não duplicação de dado.
- **impacto no usuário:** busca por intenção falha (item 3 do seu
  feedback); catálogo parece inflado quando na verdade está mal explicado.
- **dependências:** busca por músculo é independente de tudo; a auditoria
  de catálogo é trabalho de conteúdo, roda em paralelo a qualquer sprint de
  código, sem bloquear nem ser bloqueada.
- **escopo:**
  1. estender `buildExerciseIndex` para indexar também rótulos de músculo
     (e equipamento, se fizer sentido), num tier abaixo de nome/alias — a
     ordem de relevância atual não muda, músculo entra como camada extra;
  2. badge de equipamento mais visível na lista/seletor de exercícios, para
     que pares como o da Puxada parem de parecer duplicata por má
     comunicação;
  3. auditoria manual completa do catálogo — candidatos a duplicata real
     (mesmo músculo, padrão **e** equipamento) viram candidatos a mesclar;
     preferência por catálogo menor e confiável é registrada como critério
     de julgamento da auditoria, não como meta numérica;
  4. exercício sem imagem (25 dos 183, número já registrado na seção
     "Cobertura de fotos"): a proposta de ocultar (não apagar) vira uma
     quarta opção **naquela seção já existente**, decidida junto da
     auditoria de catálogo — inclui confirmar quantos exercícios seriam
     afetados e se imagem de fato muda a decisão do usuário antes de agir.
- **fora do escopo:** apagar qualquer exercício sem a auditoria manual
  completa primeiro; recriar criação de exercício personalizado — já
  existe (ver Resolvido).
- **prioridade:** busca por músculo **P1** (barato, resolve lacuna real);
  badge de equipamento **P2**; auditoria de catálogo e exercício-sem-foto
  **P3, trabalho paralelo**, não item de sprint fechada.
- **critérios de aceite:** busca por "bíceps"/"peito"/"costas" retorna
  exercícios corretos, ranqueados abaixo de nome/alias; badge de
  equipamento visível na lista.
- **evidência necessária:** casos de teste de busca por músculo isolado e
  combinado com termo de nome.

### D — UX de execução de treino: série concluída

- **objetivo:** que marcar uma série seja imediatamente reconhecível sem
  quebrar a regra de verde escasso que a sprint de redesign já estabeleceu.
- **problema:** hoje o único efeito de `set.isCompleted` na linha é
  `opacity-60` (`performed-set-row.tsx:55-59`) — sem tom de cor, sem
  destaque de fundo equivalente ao que `isNext` recebe (`bg-muted`).
- **impacto no usuário:** no meio de um treino, sem prestar atenção, é
  fácil perder qual série já foi marcada.
- **contraponto técnico à proposta original:** tonalizar toda a linha de
  verde colide direto com a regra que a própria Sprint de redesign fechou —
  "verde concentrado, não espalhado" (P0 da sprint de identidade). Numa
  sessão de 20-30 séries, tonalizar cada linha concluída reintroduz
  exatamente o padrão que aquela sprint existiu para reverter.
- **dependências:** decisão de design antes de qualquer código — não é
  implementação direta do pedido original.
- **escopo:** manter o verde reservado ao ícone de check; resolver
  "mais perceptível" com uma combinação de contraste de superfície (um
  `bg-muted` mais assertivo, no espírito do que `isNext` já faz) e/ou borda
  — sem introduzir uma segunda cor saturada na lista. Julgamento de design
  na hora da implementação, não um mockup fechado agora.
- **fora do escopo:** qualquer mudança em outra tela de treino.
- **prioridade:** **P2** — real, mas com decisão de design pendente antes
  de qualquer código.
- **critérios de aceite:** série concluída reconhecível à distância;
  nenhuma segunda cor saturada introduzida na lista.
- **evidência necessária:** o teste já existente de "animação atrelada ao
  toque, nunca ao estado" (P4 da sprint de redesign) precisa continuar
  passando — qualquer novo estilo de linha não pode disparar na montagem.

### E — Planejamento semanal de dieta (estrutural) ✅ entregue em 20/08/2026

Decidido direto com o Pedro, sem esperar a Iniciativa B: dieta pode repetir
em vários dias; um dia aponta pra uma dieta só (vincular rouba de qualquer
outra); apagar a dieta avisa quantos dias desvincula; apagar só o dia no
Diário não mexe na dieta. `Diet.weekdays`, `assignWeekdays` em
`diet-schedule.ts`, sugestão no `EmptyDay` do Diário. Ver a entrada
correspondente em "Entregue".

- **objetivo:** abrir o Diário num dia e já ver a dieta planejada, sem
  reconstruir a escolha manualmente todo dia.
- **problema:** `Diet` (`diet/types/diet.ts`) é só `{ name, meals }` — zero
  campo de calendário. O mecanismo existente,
  `startDayFromDiet(diet, day)` (`diet/services/start-day.ts:36`), semeia
  um dia manualmente, sob demanda — não é vínculo recorrente.
- **impacto no usuário:** quem segue um plano semanal (dieta de treino vs.
  dieta de descanso, por exemplo) repete "Começar de uma dieta" todo dia.
- **dependências:** nenhuma técnica direta, mas **sequenciada depois da
  Iniciativa B** — mesmo domínio de dieta, e empilhar duas mudanças
  estruturais grandes ao mesmo tempo ali é o tipo de risco que este
  documento existe para evitar.
- **escopo da fase de decisão:** associação dieta ↔ dia da semana; se a
  mesma dieta pode repetir em vários dias; o que significa "sem dieta"
  nesse dia; o que acontece quando a dieta vinculada é editada ou apagada;
  como isso aparece no Diário; se `startDayFromDiet` continua tendo
  prioridade sobre o vínculo automático quando alguém sobrepõe manualmente
  um dia específico (resposta preliminar: sim — o vínculo é o padrão, a
  sobreposição manual sempre vence).
- **fora do escopo (agora):** qualquer código de produção.
- **prioridade:** **P2 estrutural** — real, mas sem o mesmo custo diário de
  fricção que a Iniciativa B; entra depois dela.
- **critérios de aceite (da fase de decisão):** modelo de vínculo definido,
  comportamento de edição/exclusão de dieta vinculada definido,
  compatibilidade com `startDayFromDiet` confirmada.
- **evidência necessária:** nenhuma de código ainda.

### F — Saneamento de cache do service worker (BUG-013 + NOVO-1)

- **objetivo:** parar de servir erro do cache e parar de crescer sem
  limite — os dois problemas que a Sprint 4 encontrou na mesma camada.
- **problema, confirmado por leitura de `public/sw.js`:**
  1. `networkFirst()` (linhas 130-145, usada para toda navegação e para os
     payloads RSC) faz `cache.put(request, response.clone())`
     **incondicionalmente** — sem checar `response.ok`. `cacheFirst()`, no
     mesmo arquivo, já faz essa checagem (linha 155) — o padrão de correção
     já existe no próprio arquivo, só não foi aplicado nas duas funções.
  2. `isPayload(url)` (linha 101-103) reconhece qualquer URL com
     `_rsc=<hash>` como cacheável via `networkFirst` — e cada navegação
     client-side gera um payload com um hash potencialmente novo. Sem
     limite de entradas nem expiração, isso é crescimento não-limitado por
     construção, não só por falta de rotina de limpeza. Bate com o número
     observado na Sprint 4: 144 das 160 entradas eram variantes de
     `_rsc=`.
- **impacto no usuário:** uma rota que respondeu erro uma vez pode
  continuar respondendo esse erro do cache; o cache do app cresce
  indefinidamente na mesma origem que a Iniciativa de backup (Sprint 3)
  existe para proteger contra estouro de cota.
- **dependências:** nenhuma com os outros itens desta rodada — é
  autocontido em `public/sw.js` — mas compartilha tema de "confiança de
  armazenamento" com o item de backup vazio (H, abaixo).
- **escopo:** checar `response.ok` em `networkFirst` antes de `cache.put`
  (mesmo padrão de `cacheFirst`, mesmo arquivo); separar o cache de
  payloads `_rsc=` do cache do shell, com um limite de entradas e
  descarte das mais antigas quando o limite é atingido; testes reais de
  rota inexistente, online, offline, recuperação online, atualização de
  service worker e nova versão publicada — os mesmos cenários que a Sprint
  4 já cobrou e que ainda não têm teste automatizado.
- **fora do escopo:** qualquer mudança na lista `ROUTES` pré-cacheada ou na
  estratégia `cacheFirst` dos assets imutáveis — já corretos.
- **prioridade:** **P1** — não é só débito técnico; é um bug de correção
  real (serve erro do cache) mais um risco de armazenamento sem teto, na
  mesma camada que a Sprint 3 tratou como crítica para a confiabilidade do
  release.
- **critérios de aceite:** resposta de erro nunca é gravada no cache;
  contagem de entradas do cache de payloads tem um teto e não cresce
  indefinidamente numa sessão longa; os seis cenários de teste passam,
  incluindo em dispositivo real (fecha também o risco aceito de "offline
  real não testado").
- **evidência necessária:** teste de unidade do service worker (ou
  equivalente) para a checagem de `response.ok`; medição real de contagem
  de entradas antes/depois, como já é praxe neste projeto para mudanças de
  cache/storage.

### G — Comunicação nutricional

- **objetivo:** que o resultado mais acionável da tela (estou comendo mais
  ou menos do que preciso) nunca fique menos visível que um aviso
  secundário — e que quando o motor ajusta a meta por segurança, isso seja
  dito, não descoberto.
- **problema, com cenário adversarial concreto da Sprint 4:** mulher, 60
  anos, 150 cm, 45 kg, sedentária, objetivo corte, ritmo pedido de 1
  kg/semana. Resultado: meta 1.200 kcal/dia, TDEE 1.112 kcal — **a meta
  calculada é 88 kcal **acima** do gasto**, ou seja, a pessoa pediu
  emagrecimento e o sistema, corretamente, aplicou um piso de segurança que
  vira superávit. Tecnicamente correto — os limites (`MAX_WEEKLY_LOSS_RATIO`
  etc.) existem exatamente para isto. Mas em `plan-summary.tsx`, esse
  resultado ("Superávit de 88 kcal por dia") é um `<p>` simples, enquanto os
  `advisories` logo abaixo usam `Notice tone="warning"` — o aviso
  secundário tem mais peso visual que o resultado principal.
- **impacto no usuário:** alguém pode não perceber que pediu perder peso e
  a meta virou manutenção/ganho — exatamente o cenário que o teste
  adversarial expôs.
- **dependências:** nenhuma — **não muda o motor nutricional**, só a
  comunicação do resultado que ele já produz corretamente.
- **escopo:** envolver o resultado em `Notice` (tom conforme o sinal —
  dentro do esperado pode ser `info`, superávit-quando-pediu-corte é
  `warning`); conectar explicitamente o resultado ao objetivo escolhido
  ("Seu objetivo era perder peso; com seus dados atuais, o limite seguro
  não permite esse ritmo — a meta ficou em manutenção" ou equivalente,
  texto final a definir na implementação, sem alarmismo); revisão mais
  ampla de linguagem nutricional (TDEE, TMB, déficit, superávit, macros)
  para não pressupor que o usuário já conhece os termos — parte do mesmo
  esforço de humanização da Iniciativa A, aplicado à tela de nutrição.
- **fora do escopo:** qualquer alteração de `MAX_WEEKLY_LOSS_RATIO`,
  `MAX_WEEKLY_GAIN_RATIO` ou de como a meta é calculada — o motor está
  certo, é a comunicação que está fraca.
- **prioridade:** **P1** — cenário real, adversarial, comprovado; risco
  direto de confiança ("o app disse que eu ia emagrecer e não vou").
- **critérios de aceite:** o cenário da Sprint 4 (mulher, 45 kg, corte 1
  kg/semana) mostra claramente que a meta foi ajustada por segurança, com
  destaque visual igual ou maior que os avisos ao lado.
- **evidência necessária:** teste de render usando exatamente o cenário
  adversarial acima como caso de teste — não um cenário genérico.

### H — UX e confiança de backup

- **H.1 — Hierarquia visual do painel de backup.**
  problema: o painel vive como cartão de topo em `/perfil`, competindo
  visualmente com os campos principais do perfil logo na primeira visita.
  impacto: nenhum risco funcional — é hierarquia de informação.
  escopo: mover para uma área secundária (ex. "Dados e segurança"),
  dobrada/colapsada por padrão, sem reduzir função nem visibilidade real —
  continua alcançável, só não é a primeira coisa vista.
  dependências: nenhuma. `backup-panel.test.tsx` continua válido sem
  alteração — muda só onde o componente é montado.
  prioridade: **P3** — estético, zero risco, zero urgência.

- **H.2 — NOVO-2: backup vazio substitui dados reais sem aviso
  proporcional.**
  problema: um backup tecnicamente válido, mas com zero registros, hoje
  passa pela mesma confirmação genérica de qualquer outro backup.
  evidência: `composition/backup.ts` — `importAll` (linha 153) só calcula
  `recordCount` **depois** de já ter escrito os dados (linha 197-207); a
  UI (`backup-panel.tsx`) só mostra esse número no toast de sucesso, depois
  do fato consumado. Não existe hoje um passo de "espiar" o conteúdo do
  arquivo antes de confirmar.
  impacto: quem confirma por hábito (mesmo com o toque duplo do
  `ConfirmButton`) pode apagar todos os dados reais com um arquivo vazio ou
  corrompido, sem saber até depois.
  proposta: **não bloquear a importação de backup vazio** — pode ser
  legítimo. Mudar quando a contagem é conhecida: separar validação/leitura
  da contagem de registros da escrita em si, para que o passo de
  confirmação já mostre "Este arquivo contém 0 registros" (ou o número
  real) **antes** do segundo toque. Isso muda o contrato de
  `BackupRepository`/`importAll` — não é só texto na UI, é expor a
  contagem num passo que hoje não existe separado da escrita.
  dependências: nenhuma com os outros itens; compartilha tema de
  "confiança de armazenamento" com a Iniciativa F.
  prioridade: **P1** — risco de perda de dado real por confirmação
  apressada, mesmo que raro.
  critérios de aceite: a tela de confirmação sempre mostra a contagem de
  registros do arquivo antes do toque final de confirmação; importar um
  backup de fato vazio continua possível, com a mensagem deixando claro o
  que vai acontecer.
  evidência necessária: teste cobrindo arquivo com 0 registros, arquivo
  com N registros, e o texto de confirmação correspondente a cada caso.

### I — Page Reveal Global (motion) — agendado, mecanismo já decidido por padrão

Analisado o arquivo de referência (`lacalle-motion-prototype.html`) e
comparado com `design-system/tokens.css` e com a arquitetura de rotas
(`src/app/layout.tsx`, sem `template.tsx`, sem biblioteca de animação
instalada) antes de propor qualquer coisa.

- **O que já está implementado, idêntico ao protótipo — nada a criar:**
  as curvas (`--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`,
  `--ease-in: cubic-bezier(0.64, 0, 0.78, 0)`) e os quatro tiers de duração
  (`--duration-micro: 150ms`, `--duration-standard: 250ms`,
  `--duration-signature: 450ms`, `--duration-hero: 800ms`) batem
  exatamente com o protótipo, tier a tier. Qualquer Page Reveal deve
  **reusar esses tokens**, nunca criar novo valor de curva ou duração.
- **problema/pedido:** aplicar a transição de máscara circular ("LaCalle
  Reveal" — um círculo colorido que expande e vira o fundo da tela
  seguinte) como entrada padrão em todas as rotas principais, incluindo a
  navegação pela barra inferior.
- **contraponto técnico direto, porque a alternativa é melhor:** o próprio
  arquivo de referência restringe esse efeito por escrito — "use apenas em
  splash, onboarding e troca de contexto — nunca em navegação comum" — e
  essa restrição não é acidental. Quatro razões concretas para não aplicar
  o mecanismo **literal** (máscara circular colorida cobrindo a tela
  inteira) à navegação do dia a dia:
  1. **Repete o erro que a sprint de identidade já corrigiu.** A mesma
     lição do verde escasso (Iniciativa D) se aplica a movimento: reservar
     o gesto mais expressivo do sistema para o momento mais raro é o que o
     torna reconhecível. Uma máscara colorida cobrindo a tela inteira a
     cada toque na barra de navegação — potencialmente dezenas de vezes
     por sessão — espalha a assinatura em vez de concentrá-la.
  2. **Custo de implementação real, não cosmético.** Um reveal circular
     "que nasce do ponto tocado" exige capturar a coordenada de origem de
     cada gatilho de navegação (aba da barra inferior, item da sidebar,
     link interno, botão voltar, voltar do navegador) — é plumbing de
     estado por todo canto de navegação, não uma transição CSS isolada.
  3. **Velocidade percebida.** Uma barra de navegação inferior é tocada
     com alta frequência; cobrir a tela inteira e revelar de novo a cada
     toque, mesmo em 350-450ms (tier Signature), tende a parecer mais
     lento que o crossfade/slide que qualquer app de tab bar nativo usa —
     e isso contraria diretamente o seu próprio princípio ("rápido,
     discreto... sem delay perceptível").
  4. **Não há infraestrutura de transição de rota hoje.** `layout.tsx` é
     único, sem `template.tsx` por segmento, sem biblioteca de animação. O
     app já tem a peça certa para uma entrada discreta e reaproveitável: a
     keyframe `--animate-rise` (`tokens.css`), já usada nos cartões que
     aparecem hoje — fade + leve deslocamento vertical, no tier Standard.
- **proposta alternativa:** adotar a **linguagem** do Reveal (curva
  Ease Out, tier Signature reservado a raros momentos de verdade) sem
  adotar o mecanismo de máscara circular para navegação comum. Para
  entrada de página padrão, reaproveitar `--animate-rise` via `template.tsx`
  por segmento de rota — nativo do Next.js App Router, sem biblioteca nova,
  sem captura de coordenada de toque. Reservar a máscara circular (se algum
  dia fizer sentido) para um momento genuinamente raro e único — ex. fim de
  uma sessão de treino concluída — não para navegação repetida.
- **dependências:** nenhuma técnica. Decisão de **entrar na sequência**
  já veio (16/08) — falta só confirmar o mecanismo antes da sprint começar:
  por padrão, esta seção adota a rota recomendada (`--animate-rise`, sem
  máscara circular na navegação comum); se a intenção for a máscara
  circular literal mesmo assim, avisar antes da Sprint 8 para trocar o
  escopo abaixo.
- **escopo:** `template.tsx` por segmento
  de rota principal (`/hoje`, `/treinos`, `/treinos/[id]`, `/sessao/[id]`,
  `/dietas`, `/dietas/[id]`, `/diario`, `/evolucao`, `/alimentos`,
  `/perfil`); CSS puro (`transform`/`opacity`, tokens existentes), sem
  JavaScript de animação; `prefers-reduced-motion` herdando a mesma regra
  global já implementada (fade de 120ms); avaliar separadamente o
  comportamento em **voltar** — se a mesma entrada piorar a sensação de
  velocidade no retorno, usar uma estratégia diferente ali (ex. sem
  animação, ou uma mais curta), registrado explicitamente, não assumido.
- **fora do escopo:** qualquer animação por componente/card — a unidade é
  a entrada da página inteira, não cada elemento dela; qualquer biblioteca
  de animação nova.
- **prioridade:** **P2** — agendado (Sprint 8), sem risco de dado, mas
  toca toda rota principal do app; não implementar antes da sprint chegar.
- **critérios de aceite:** zero overflow/
  layout shift em 320-430px; navegação pela barra inferior não parece mais
  lenta que hoje; `prefers-reduced-motion` remove a transição, mantendo
  navegação instantânea; nenhum token novo de cor/curva/duração criado.
- **evidência necessária:** medição de percepção de velocidade antes/depois
  na barra inferior (mesmo padrão de medição real já usado nas sprints
  anteriores), não só ausência de bug técnico.

---

### PRÓXIMAS SPRINTS — sequência validada contra dependências reais

**Sprint 5 — Confiança essencial ✅ entregue em 16/08/2026**

- objetivo: fechar os itens de maior impacto de compreensão e de risco de
  dado, todos de baixo risco técnico.
- escopo: Iniciativa A (TDEE, aviso de perfil incompleto, cabeçalho
  PESO/REPS) e A.1 (presets de ritmo, após decisão de rota); Iniciativa G
  (BUG-015 — `Notice` + mensagem conectando objetivo↔resultado, usando o
  cenário adversarial da Sprint 4 como caso de teste); H.2 (NOVO-2 — aviso
  de backup vazio, inclui expor `recordCount` antes da escrita).
- fora do escopo: qualquer item estrutural (B, E); Page Reveal; cache do
  service worker (Iniciativa F, sprint seguinte); microcopy transversal
  (A.2, contínuo).
- dependências: decisão de rota de A.1 precisa estar fechada antes da
  sprint começar; nenhuma outra.
- critérios de aceite: todos os itens do escopo entregues e testados;
  nenhum token de Brand System tocado.
- testes necessários: um por item, conforme descrito em cada iniciativa —
  nenhum exige suíte de integração nova.
- risco de regressão: baixo. O item de maior risco relativo é A.1, por
  reusar constantes do motor nutricional — testar contra os limites
  existentes evita regressão silenciosa.

**O que foi entregue, por item:**

- [x] **A — TDEE.** O rótulo em `plan-summary.tsx` virou "Gasto diário
      (TDEE)" — o termo continua ali para quem o reconhece, só deixou de ser
      a primeira palavra.
- [x] **A — aviso de perfil incompleto.** `ProfileIncompleteNotice`, novo,
      lido pelo mesmo `useProfile` da tela de perfil: aparece em Hoje só com
      `status === "empty"`, com CTA para `/perfil`, e some sozinho assim que
      o perfil existe — sem botão de dispensar, porque não há o que dispensar
      depois que o motivo desaparece.
- [x] **A — cabeçalho PESO/REPS na execução.** `SessionExerciseCard` ganhou o
      mesmo cabeçalho `# Reps Peso RPE` que o editor de rotina já tinha, com
      as mesmas larguras de coluna — os dois botões de 44px da linha (concluir
      e remover) viraram spaçadores no cabeçalho para as colunas continuarem
      alinhadas.
- [x] **A.1 — presets de ritmo.** Decisão tomada pela rota recomendada:
      `weeklyRatePresets(weightKg, goal)`, novo em `core/nutrition`, deriva
      "Leve" (50% do teto) e "Moderado" (100% do teto) dos mesmos
      `MAX_WEEKLY_LOSS_RATIO`/`MAX_WEEKLY_GAIN_RATIO` que o motor já aplica —
      nunca um valor fixo, que a auditoria já tinha mostrado que quebraria
      para pesos diferentes. `ProfileForm` mostra os dois como chips acima do
      campo livre, que continua aceitando qualquer valor.
- [x] **G — objetivo↔resultado.** `PlanSummary` agora recebe o `goal` do
      perfil e compara com o sinal de `energyBalanceKcal`: quando alguém pede
      corte e a meta calculada não fica em déficit (ou pede ganho e não fica
      em superávit), a frase nomeia os dois — "Seu objetivo era perder peso;
      com seus dados atuais, o limite seguro de ritmo não permite esse
      resultado — a meta ficou em superávit" — e o `Notice` vira `warning` em
      vez de `info`. Testado com o cenário adversarial exato da Sprint 4
      (mulher, 60 anos, 150 cm, 45 kg, corte, 1 kg/semana pedido).
- [x] **H.2 — aviso de backup vazio.** `composition/backup.ts` ganhou
      `previewImport`, que reaproveita a mesma validação de `importAll` sem
      abrir transação nenhuma — nenhum store é tocado. `BackupPanel` chama a
      prévia assim que o arquivo é escolhido e só mostra o botão de
      confirmação depois que "Este arquivo contém N registros" aparece; um
      backup de fato vazio não é bloqueado, só nomeado antes do toque que
      substitui tudo.

967 testes (949 → 967, 18 novos, 6 arquivos), `typecheck`, `lint` e `build`
de produção verdes.

**Sprint 6 — Saneamento de armazenamento e descoberta ✅ entregue em 17/08/2026**

- objetivo: fechar o risco de cache sem limite (Iniciativa F) e destravar
  descoberta de exercício (Iniciativa C, parte 1), preparando o terreno
  para a Sprint 7.
- escopo: Iniciativa F completa (response.ok em `networkFirst`, cache de
  `_rsc=` separado e com teto, os seis cenários de teste real, incluindo
  dispositivo físico); busca por músculo/sinônimo (Iniciativa C); BUG-011
  (virtualização de lista) — fechamento do bloqueador identificado na
  rodada anterior, pré-requisito da Sprint 7.
- fora do escopo: catálogo completo do Diário em si (Sprint 7); auditoria
  manual de duplicatas/exercício-sem-foto (paralelo, não-sprint).
- dependências: nenhuma entre os três itens do escopo — rodam em paralelo,
  arquivos completamente distintos; BUG-011 é pré-requisito da Sprint 7.
- critérios de aceite: os seis cenários de F passam, incluindo em
  dispositivo real; busca por músculo retorna resultado correto; qualquer
  lista grande do app renderiza sem degradação perceptível com o catálogo
  cheio.
- testes necessários: unidade do service worker; casos de busca por
  músculo isolado/combinado; medição real de performance de lista antes/
  depois (dado real, não banco vazio — mesma lição já registrada nas fases
  anteriores).
- risco de regressão: médio — mexer em cache e em renderização de lista
  são as duas superfícies mais fáceis de quebrar sutilmente (scroll,
  offline, atualização de versão). Medir ao vivo, não só suíte automatizada.

**O que foi entregue, por item:**

- [x] **F — `response.ok` em `networkFirst`.** O mesmo padrão que
      `cacheFirst` já usava: uma rota que respondeu erro uma vez não é mais
      gravada no cache, então uma visita offline seguinte não pode reproduzir
      esse erro para sempre.
- [x] **F — cache de payload `_rsc=` separado, com teto.** Saiu do cache do
      shell para `PAYLOADS`, um cache próprio com `MAX_PAYLOAD_ENTRIES = 40`
      e descarte do mais antigo (`Cache.keys()` preserva ordem de inserção,
      que é o que "mais antigo" significa aqui). `activate` passou a
      preservar as três caches da versão atual, não só duas.
- [x] **F — testado rodando o `public/sw.js` real**, não uma reimplementação:
      `src/service-worker/load-sw.ts` executa o arquivo publicado dentro de um
      escopo global falso (`self`, `caches`, `fetch`), então um teste vermelho
      aqui significa o arquivo publicado está errado, não que uma cópia dele
      divergiu. Cobre os dois achados acima e a retenção das caches da versão
      atual no `activate`. **Não cobertos, e não reivindicados:** offline num
      aparelho físico e atualização de versão com o app aberto — ficam como
      risco residual, registrados e não escondidos.
- [x] **C — busca por músculo.** `buildExerciseIndex` agora indexa também os
      rótulos de `MUSCLE_LABELS` de `primaryMuscles`/`secondaryMuscles` (nunca
      `stabilizerMuscles`), num tier abaixo de nome e alias — texto sempre
      vence intenção. Confirmado ao vivo: buscar "panturrilha" retorna cinco
      exercícios cujo nome já leva a palavra, seguidos de "Agachamento com
      Salto", "Bicicleta Ergométrica", "Caminhada", "Corrida" e "Elíptico" —
      nenhum deles com "panturrilha" no nome ou alias, todos com panturrilhas
      no músculo primário ou secundário.
- [x] **BUG-011 — `useIncrementalReveal`.** Não é o virtualizador com janela
      que desmonta linha rolada — a essa escala (183 exercícios, 216
      alimentos, centenas e não milhares) o custo real nunca foi manter
      linhas montadas, foi montar todas de uma vez a cada tecla digitada.
      O hook revela em páginas de 40, crescendo por `IntersectionObserver`
      quando a sentinela entra na viewport (com `rootMargin` para carregar
      antes de faltar), e reseta para a primeira página quando a busca muda
      — nunca num render não relacionado. Aplicado em `ExerciseBrowser` e
      `FoodBrowser`/`FoodList`. Fallback explícito para navegador sem
      `IntersectionObserver`: revela tudo, em vez de travar na primeira
      página para sempre sem explicação.

      Confirmado ao vivo, build de produção: as duas listas rolam do
      primeiro ao último item (183 e 216) sem erro no console, com a nova
      busca por músculo testada na mesma passagem.

      **O `food-picker.tsx` continua com o teto de 8** — remover esse teto é
      escopo da Sprint 7, que este item apenas destrava.

19 testes novos (6 do service worker, 6 de busca por músculo, 7 do hook,
incluindo um benchmark de custo de montagem por proporção — mesmo raciocínio
do benchmark de busca em `search-exercises.test.ts`, não limiar de
milissegundos). 986 testes, `typecheck`, `lint` e `build` de produção verdes.

**Sprint 7 — Diário e execução, polimento ✅ entregue em 17/08/2026**

- objetivo: entregar "catálogo completo pelo Diário" — só possível com
  segurança depois do BUG-011 fechado na Sprint 6 — e o estado visual de
  série concluída.
- escopo: estender `food-picker.tsx` com filtro de categoria/favoritos,
  removendo o teto artificial de 8 resultados; Iniciativa D (série
  concluída), com decisão de design resolvida antes da sprint começar;
  H.1 (backup para área secundária — cabe aqui por ser barato e sem
  dependência).
- fora do escopo: qualquer coisa da Iniciativa B ou E; Page Reveal.
- dependências: **BUG-011 fechado (Sprint 6)** é obrigatório para a parte
  do Diário; decisão de design de D deve estar fechada antes da sprint
  começar.
- critérios de aceite: buscar e navegar por categoria funcionam no
  `FoodPicker` sem degradação perceptível ao digitar; série concluída
  reconhecível sem segunda cor saturada.
- testes necessários: `FoodPicker` com filtro; regressão do teste de
  "animação atrelada ao toque, nunca ao estado".
- risco de regressão: médio — mesma superfície de risco da Sprint 6 (lista
  grande, agora com filtro embutido).

**O que foi entregue, por item:**

- [x] **`food-picker.tsx` sem o teto de 8.** O `LIMIT` saiu; a lista usa o
      mesmo `useIncrementalReveal` da Sprint 6 (páginas de 20, contra 40 nas
      duas telas cheias — a superfície é bem menor aqui), dentro de um
      `max-h-72 overflow-y-auto` próprio, para não empurrar a refeição
      abaixo dele conforme o resultado cresce. Ganhou o mesmo botão
      "Filtros" de categoria/favoritos que `/alimentos` já tinha, via o
      `FoodFilters` compartilhado. Filtro sobrevive à escolha de propósito —
      adicionar vários alimentos da mesma categoria é o caso comum.

      **Achado no processo, não no código:** os primeiros testes escritos
      digitavam no campo de busca logo após montar o componente, sem esperar
      o catálogo sair de "carregando" — nesse estado o campo está
      `disabled`, então o texto nunca era digitado, e ainda assim os testes
      passavam, porque com busca vazia todo alimento aparece de qualquer
      forma. Corrigido esperando o campo ficar habilitado antes de digitar,
      e reforçando os testes para provar que a busca de fato filtrou (um
      alimento que não deveria aparecer, ausente do resultado), não só que
      "algo" apareceu.
- [x] **Iniciativa D — série concluída.** `opacity-60` saiu por completo — era
      o único efeito de `isCompleted` na linha, e apagava também o botão de
      check em si, o único elemento com o acento saturado que a regra do
      redesign pede para preservar. No lugar, a mesma linguagem que um `Card`
      já usa em outro lugar do app: superfície (`bg-muted`) e borda
      (`border-line`) permanentes, não um estado de hover. Continua sem
      segunda cor saturada — o verde nunca sai do ícone do check, que agora
      fica mais visível, não menos. Confirmado ao vivo numa sessão real:
      a série concluída fica visivelmente emoldurada contra a "próxima"
      (que só tem `bg-muted`, sem borda) e contra as ainda não tocadas (sem
      superfície nenhuma). O teste de "animação atrelada ao toque, nunca ao
      estado" continua verde, sem alteração.
- [x] **H.1 — backup para área secundária.** `BackupPanel` saiu do topo de
      `/perfil` — onde competia com os campos que alguém veio preencher — e
      passou a viver dentro de um `<details>` nativo chamado "Dados e
      segurança", colapsado por padrão. Sem biblioteca nova e sem estado em
      React: o elemento já dá o comportamento de abrir/fechar, a
      acessibilidade e a busca de página de graça. `backup-panel.test.tsx`
      não mudou uma linha, como o item previa — só o local de montagem
      mudou.

Confirmado ao vivo, build de produção, nas três telas: `/perfil` com o
painel colapsado e reabrindo; uma sessão real com uma série marcada,
mostrando a linha emoldurada ao lado da "próxima" só com `bg-muted`; e o
`FoodPicker` de uma dieta real filtrando por categoria, listando mais de
oito resultados com rolagem própria, e mantendo o filtro ativo após
adicionar um alimento. Nenhum erro no console em nenhuma das três.

995 testes (986 → 995, 9 novos), `typecheck`, `lint` e `build` de produção
verdes.

**Fase de decisão (sem código) — Modelo de unidade de alimento + nutrientes
opcionais**

- objetivo: não é sprint de implementação. É fechar a decisão de schema da
  Iniciativa B, incluindo se os nutrientes opcionais (Alimentos, item
  abaixo) entram na mesma migração.
- escopo: tudo listado no "escopo da fase de decisão" da Iniciativa B, mais
  a definição de quais nutrientes opcionais entram (ver Alimentos) e a
  fonte de dado nutricional a usar.
- dependências: nenhuma — pode rodar em paralelo às Sprints 6-7.
- critérios de aceite: documento de decisão revisado antes de qualquer PR
  de implementação.

**Sprint 8 — Identidade visual e maturidade de produto**

Pedida em 17/08/2026, com o LaCalle Finance como referência de maturidade
visual — **referência de princípios, não template a copiar**. Substitui e
absorve a antiga "Sprint 8 — Page Reveal Global" (agora item 12 abaixo).

- **objetivo:** o Life passa a maioria das auditorias de confiabilidade,
  mas continua lendo como "um app funcional com um bom design system", não
  como um produto com identidade própria. O Finance já tem mais variedade
  de cor funcional, hierarquia mais clara, componentes com personalidade
  além do card, e mais contraste entre estados. A meta é abrir Hoje →
  Treinos → Dietas → Diário → Evolução → Perfil e reconhecer "isso é
  LaCalle Life" sem olhar a logo — não empilhar mais cor, sombra ou
  animação por si só.
- **escopo, é só visual/UX/motion/microcopy.** Fora do escopo, sem exceção:
  arquitetura, persistência, IndexedDB, motor nutricional, qualquer
  funcionalidade nova. Uma necessidade funcional encontrada no caminho
  entra no roadmap como item novo, não na sprint.
- **regra de admissão de cada mudança:** melhora hierarquia, compreensão,
  diferenciação de estado, identidade do Life, percepção de qualidade, ou
  torna a experiência mais agradável e memorável? Nenhuma dessas → não
  entra. Isto vale tanto para cor e sombra quanto para motion.
- **não mexer:** logo, símbolo, tipografia oficial, tokens fundamentais de
  marca, proporções já definidas no Brand System (`docs/brandbook.md`). Um
  token que pareça limitar a evolução visual é documentado aqui como
  achado — nunca substituído em silêncio.
- **responsividade:** as seis larguras de sempre (320/360/375/390/393/430
  mais desktop) continuam sem overflow — a auditoria anterior confirmou
  54/54 combinações limpas, e esta sprint não pode regredir isso, com
  atenção a headers fixos, barra inferior, execução de treino, formulários,
  cards e gráficos.

**Bloqueio de partida — resolvido em 17/08/2026:** o pedido citava imagens
de referência do Finance que não tinham chegado à conversa; o Pedro anexou
quatro capturas reais do FinFlow/LaCalle Finance (Início, evolução do
dinheiro, transações, previstos) e a Fase 1 rodou contra elas de verdade,
mais uma auditoria ao vivo do Life em build de produção (Hoje, Diário,
Evolução).

**Status — ✅ entregue em 19/08/2026.** Fase 1, Fase 2 e Fase 2.5 (auditoria,
direção, refinamento) aprovadas antes da implementação. Fase 3 entregue em
oito checkpoints — tokens, componentes base, Hoje, Treinos/Execução,
Evolução/Perfil/Dietas, Alimentos/Exercícios (sem mudança — ver abaixo),
motion, auditoria final. Relato completo logo depois desta seção.

**Uma conclusão da Fase 2.5 não sobreviveu à Fase 3, e a correção está
registrada onde ela aconteceu:** a leitura de
`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` dizia
que o App Router "já suporta `<ViewTransition>` nativamente" — mas o
`react` de fato instalado (`19.2.8`, conferido em
`node_modules/react/package.json`) não exporta `ViewTransition`; o guia
pressupõe uma build canary que este projeto não tem. A máscara circular
foi substituída por `--animate-rise` via `template.tsx`, o fallback que o
pedido original já previa para este cenário. Detalhe técnico completo
na Iniciativa I, item 6 das decisões pendentes (agora resolvida).

### As quatro fases, na ordem — cada uma termina antes da próxima começar

1. **Auditoria.** Hoje, Treinos, Execução, Dietas, Editor de dieta, Diário,
   Evolução, Alimentos, Perfil, Exercícios — por tela: hierarquia (o que é
   primário/secundário/apoio, e onde dois elementos com peso diferente
   parecem iguais), superfícies (onde há card/container/borda/fundo/seção/
   divisor hoje, e onde o padrão "fundo → card → card → card" já cansou),
   e lista de oportunidades de cor, motion e componente. Produz uma lista
   de problemas, não código.
2. **Direção visual.** Antes de tocar em código: como o Life deve parecer —
   paleta funcional, tratamento de superfície, vocabulário de componente,
   hierarquia, motion, densidade, personalidade. Por escrito, revisável
   antes da Fase 3 começar.
3. **Implementação**, nesta ordem: tokens → componentes base → tratamento
   de superfície → tipografia → cores funcionais → motion → telas
   principais. Não é "editar 30 arquivos de uma vez" — cada camada se
   apoia na anterior.
4. **Revisão crítica.** Comparar as seis telas lado a lado: "isso parece um
   produto com identidade, ou só um conjunto de telas bonitas?" Se ainda
   ler genérico, mais uma rodada de refinamento antes de encerrar — a
   sprint não termina na primeira versão "bonitinha".

### O que cada frente cobre

1. **Cor funcional**, em cima da paleta do Brand System, não ao lado dela:
   primária (ação/navegação ativa/CTA), verde (progresso/conclusão/meta
   batida — continua escasso, a regra da sprint de identidade não muda),
   vermelho (erro/exclusão/negativo real), âmbar (atenção/aviso), azul
   (informação/dado/contexto neutro), e a cor de marca para identidade e
   momentos estratégicos. Cor comunica; não decora. Sem app arco-íris.
2. **Vocabulário de componente além do card**: hero/destaque, metric
   (número grande + contexto pequeno), progress, insight, notice, section
   (sem exigir um card em volta), list (mais leve que um card por item),
   action, empty state e success state com personalidade. Escolher o que
   cada tela precisa, não aplicar os nove em toda parte.
3. **Hoje** é o cartão de visita — primeira impressão do produto. Repensar
   como calorias, progresso, treino, alimentação, evolução e pendências se
   compõem, para deixar de ler como "seis cards empilhados" e ler como uma
   central pessoal de saúde.
4. **Treinos**: linguagem visual própria para exercício, série, peso,
   reps, RPE, progresso, exercício atual/seguinte. **Série concluída**
   continua sendo o ponto mais citado — o tratamento (superfície + borda,
   Sprint 7) é o piso, não necessariamente o teto; qualquer evolução aqui
   respeita o mesmo verde escasso.
5. **Dieta**: clareza + precisão + progresso. O anel/círculo nutricional é
   tratado como peça de identidade, não como mais um número dentro de um
   card.
6. **Diário**: registro rápido + clareza — responder "o que comi hoje"
   rápido, com refeição/alimento/quantidade/horário/total diferenciados
   sem empilhar container.
7. **Evolução**: progresso ao longo do tempo — peso, medidas, gráfico,
   histórico. As observações contextuais que já existem (achados medidos,
   não adivinhados) são preservadas, não redesenhadas por capricho.
8. **Perfil** para de parecer tela de configurações genérica: identidade
   pessoal, objetivos, nutrição, treino, preferências e dados/backup
   claramente separados — backup já foi para uma área secundária colapsada
   na Sprint 7 (H.1) e continua lá.
9. **Tipografia**: hierarquia mais clara entre título de página, título de
   seção, métrica, label, descrição, texto auxiliar, aviso e CTA — usando
   peso, espaçamento, contraste, posição, superfície e cor, não só
   tamanho.
10. **Microcopy**: mesma frente que a Iniciativa A.2 já registrava como
    contínua — travessão em excesso, frase explicativa longa, formalidade
    que soa gerada. "Você ainda não definiu sua meta" em vez de um
    parágrafo justificando por que perguntar. Revisão ao longo da sprint,
    não só nas telas que mudaram de layout.
11. **Motion / Page Reveal**, lendo a implementação/protótipo já citado no
    roadmap antes de tocar em qualquer curva ou duração: reusar
    `--ease-out`/`--ease-in` e os quatro tiers já existentes, sem token
    novo. A máscara circular do Reveal não vai para navegação comum — o
    contraponto técnico já registrado (verde escasso aplicado a motion,
    custo real de captura de coordenada, velocidade percebida numa barra
    tocada dezenas de vezes por sessão, ausência de infraestrutura de
    transição por rota) continua de pé até que uma auditoria nova o
    derrube com medição, não com preferência. Rota padrão: `--animate-rise`
    via `template.tsx` por segmento, tier Standard, exatamente como a
    antiga Sprint 8 já especificava — ver critérios de aceite abaixo.
12. **Fora do escopo, explícito:** Iniciativa B, Iniciativa E, qualquer
    funcionalidade nova, qualquer mudança de arquitetura.

### Critérios de aceite

Os da antiga Sprint 8 continuam valendo integralmente para o Reveal (zero
overflow/layout shift nas seis larguras, navegação da barra inferior sem
parecer mais lenta — medido, `prefers-reduced-motion` remove a transição,
nenhum componente ganha animação própria fora da entrada de página) — mais,
para o resto da sprint: as seis telas principais lidas em sequência
comunicam identidade própria sem depender da logo; nenhum token, proporção
ou regra do Brand System alterado sem registro explícito aqui; `npm run
verify` e `npm run build` verdes; confirmação visual nas seis larguras e
desktop, sem regressão de overflow.

### Entrega — 19/08/2026

**Tokens novos/alterados:** `--reveal-x`/`--reveal-y` (origem do Reveal,
`50% 50%` como padrão — acabaram não sendo consumidos, ver a nota sobre o
Reveal abaixo). `--info` foi **investigado e não alterado** — a leitura da
Fase 2.5 achava que era cinza por acidente; `tokens.test.ts` prova que é um
valor citado literalmente da pág. 27 do brandbook, então mexer seria
reabrir uma decisão de marca sem registrar. Nenhum outro token tocado.

**Componentes novos:** `Section` (título + subtítulo + conteúdo, sem
borda — generaliza o que só existia em `/evolucao`), `Metric` (número +
legenda, com `align="center"`), `Badge` (cinco estados —
neutro/próximo/atenção/concluído/negativo, texto sempre presente),
`PageTransition` (o wrapper de `--animate-rise` que todo `template.tsx`
reexporta).

**Telas com intervenção, da maior para a menor:**
1. **Hoje** — a maior mudança da sprint. `TodayEnergy` virou um
   `Card tone="hero"` só (anel + três `Metric` centralizados como tira
   secundária), `TodayMeals`/`TodayWorkout` viraram `Section`,
   `TodayProgress` virou uma linha sem superfície nenhuma. Quatro níveis
   de hierarquia onde havia cinco cards iguais.
2. **Perfil** — `profile-form.tsx` ganhou três `Section` (Identidade,
   Objetivo, Nutrição); nenhum campo, validação ou submissão mudou.
3. **Execução** — o exercício com a próxima série vira `Card tone="hero"`
   (reusa `nextSetId`, dado que já existia); nunca mais de um por vez.
4. **Evolução** — o único `Section` escrito à mão virou o componente.
5. **Nove rotas** ganharam `template.tsx` com `--animate-rise`.
6. **Treinos, Diário, Dietas, Alimentos, Exercícios** — sem mudança de
   código, por três razões diferentes e registradas: Treinos já
   satisfazia a composição (hero condicional via `InProgressBanner`);
   Diário compartilha `MealCard` com Dietas, e as duas instruções juntas
   exigiriam bifurcar edição de refeição — risco maior que o ganho;
   Alimentos/Exercícios já tinham personalidade própria e nenhuma mudança
   de estado real a comunicar que justificasse um `Badge` novo.

**Arquivos alterados/criados:** `tokens.css`; `section.tsx`, `metric.tsx`,
`badge.tsx`, `page-transition.tsx` (novos, com teste); `today-energy.tsx`,
`today-meals.tsx`, `today-workout.tsx`, `today-progress.tsx`,
`in-progress-banner.tsx`, `app/page.tsx`; `session-exercise-card.tsx`;
`app/evolucao/page.tsx`; `profile-form.tsx`; nove `template.tsx`.

**Page Reveal:** implementado como `--animate-rise`, não a máscara
circular — a Fase 2.5 achou viável citando um guia do Next.js que
pressupõe React canary; o `react` real deste projeto é `19.2.8` estável e
não exporta `ViewTransition` (conferido por grep no pacote, não por
documentação). `/sessao/[id]` ficou sem `template.tsx`: `translate` cria
containing block para descendentes `fixed`, e `RestTimerBar` é `fixed`
dentro dessa rota — evitado, não corrigido.

**Testes executados:** 986 → 1012 (26 novos). `typecheck`, `lint`,
`npm run build` verdes em cada um dos oito checkpoints, não só no final.
Verificação visual ao vivo em build de produção: as seis larguras
(320/360/375/390/393/430) mais 1440px desktop, em Hoje, Diário, Treinos,
`/treinos/[id]`, `/sessao/[id]`, Evolução, Perfil e Alimentos — zero
overflow, zero erro no console em qualquer combinação testada.

**Comparação antes/depois, em uma frase:** Hoje foi de quatro cards do
mesmo peso para uma resposta (anel), duas perguntas (alimentação/treino) e
um rodapé quieto (peso); Perfil foi de um formulário corrido para três
blocos nomeados; Execução e Treinos passaram a falar a mesma língua visual
(o exercício atual e a rotina em andamento usam o mesmo friso).

**Problemas encontrados, não corrigidos nesta sprint:** nenhum bug
funcional novo. Um achado de processo, já corrigido na hora: a Fase 2.5
propôs um "friso superior" para o Hero que contrariava o friso lateral já
existente e documentado contra a pág. 24 do brandbook — mantido o
mecanismo existente, o superior nunca foi implementado.

**O que deliberadamente não foi alterado:** logo, símbolo, tipografia
oficial, qualquer token de cor além dos já listados, a forma de Alimentos
(tabela) e Exercícios (cartão com foto), `MealCard`/Diário/Dietas, o motor
nutricional, IndexedDB, qualquer regra de negócio.

**Alguma regra de produto ou dado foi alterada? Não.**

Commit: seguiu em oito commits, um por checkpoint, cada um com a alteração
mais o motivo — não um commit único "Sprint 8 completa".

O roadmap só foi marcado como entregue depois de todos os itens acima
verificados, não antes.

**Depois — Iniciativa E (planejamento semanal de dieta)**, sequenciada após
a Iniciativa B estar decidida e, de preferência, implementada — mesma
lógica de não empilhar duas mudanças estruturais no mesmo domínio.

---

### FUTURO — não precisa entrar agora

- Auditoria manual de catálogo de exercícios (duplicata real, sem foto) —
  contínua, roda em paralelo, sem sprint fechada.
- Revisão de microcopy (A.2) — contínua.
- Iniciativa E (planejamento semanal) — depois da Iniciativa B.
- Fibra rastreável — sem mudança de rota; **sua leitura está confirmada:
  pode ser ignorado por ora**, a menos que a fase de decisão de nutrientes
  opcionais (abaixo) crie o campo que faltava, e mesmo assim isso não
  obriga a fechar o item de fibra imediatamente.

### Alimentos — nutrientes opcionais (fibra, sódio, açúcar, gordura
saturada, gordura trans, colesterol)

- **objetivo:** permitir campos nutricionais além dos quatro principais,
  sem virar tabela nutricional completa por padrão.
- **problema:** `Macros` (`core/domain/macros.ts:12-17`) tem exatamente
  `kcal`, `proteinG`, `carbsG`, `fatG` — nenhum nutriente opcional existe
  em lugar nenhum do domínio hoje.
- **impacto no usuário:** sem esses campos, pedidos como fibra rastreável
  não têm onde guardar o dado, mesmo que uma fonte apareça.
- **contraponto ao pedido original:** não definir a lista de nutrientes
  antes de responder três perguntas — quais realmente agregam valor ao
  usuário comum (provavelmente fibra e sódio, pelo apelo de saúde mais
  direto), quais são necessários para alguma feature futura já cogitada, e
  quais a fonte de dado escolhida sequer traz de forma confiável. Adicionar
  os seis de uma vez, "porque existem", é o oposto do princípio de manter a
  interface simples que você mesmo pediu.
- **dependências:** compartilha schema de `Food` com a Iniciativa B — decidir
  junto, uma migração só, não duas.
- **escopo (fase de decisão, dentro da fase de decisão da Iniciativa B):**
  lista final de nutrientes opcionais (provavelmente menor que os seis
  citados), todos opcionais/nunca obrigatórios, com `scaleMacros`/
  `roundMacros` estendidos para propagar os campos presentes sem quebrar
  chamadas que só usam os quatro principais.
- **fora do escopo:** qualquer nutriente virar obrigatório; qualquer mudança
  na interface de exibição além de "opcional, se presente".
- **prioridade:** **P2** — real e bem definido, sem a urgência diária da
  Iniciativa B; decide-se junto, implementa-se junto.
- **critérios de aceite:** alimento sem nenhum nutriente opcional continua
  calculando igual a hoje (regressão coberta); nutriente opcional propaga
  corretamente ao escalar por grama/unidade.

---

### DECISÕES PENDENTES — antes de qualquer código

1. ~~**Ritmo de mudança de peso (A.1)**~~ — **decidido e entregue na Sprint 5**:
   presets em percentual do peso, via `weeklyRatePresets` em
   `core/nutrition`. Ver o relato na Sprint 5, acima.
2. **Modelo de unidade de alimento (B):** confirmar a rota aditiva
   (unidades nomeadas em `Food`, `MealItem.grams` intocado); decidir fonte
   de dado nutricional para porções por unidade; decidir quem cura os 216
   alimentos existentes e em que ritmo.
3. **Nutrientes opcionais:** lista final (provavelmente menor que os seis
   sugeridos), decidida junto com a Iniciativa B.
4. ~~**Estado visual de série concluída (D)**~~ — **decidido e entregue na
   Sprint 7**: superfície (`bg-muted`) e borda (`border-line`) permanentes,
   sem opacidade e sem verde espalhado. Ver o relato na Sprint 7, acima.
5. **Exercício sem foto — ocultar como quarta opção:** decidir junto da
   auditoria de catálogo (C).
6. ~~**Page Reveal Global (I)**~~ — **decidido e entregue na Sprint 8**:
   `--animate-rise` via `template.tsx`, em nove das dez rotas listadas
   (`/sessao/[id]` ficou de fora — ver abaixo). A máscara circular via
   `<ViewTransition>` do React foi reavaliada duas vezes: a Fase 2.5 da
   Sprint 8 leu o guia do Next.js e concluiu que era viável porque "o App
   Router já suporta `<ViewTransition>` nativamente, sem configuração" —
   e essa conclusão **não sobreviveu à verificação**. O pacote `react`
   instalado neste projeto é `19.2.8`, uma versão estável, não uma
   canary; `ViewTransition` não existe nos arquivos publicados do pacote
   (conferido com `grep`, não com a documentação). O guia do Next.js
   pressupõe uma build canary do React que este projeto não tem, e
   instalar uma seria mudança de arquitetura fora do escopo desta sprint.
   `--animate-rise` foi o fallback que o próprio pedido já previa para
   esse cenário.

   **`/sessao/[id]` ficou sem `template.tsx` de propósito.** `translate`
   (o que a keyframe `rise` anima) estabelece novo *containing block*
   para descendentes `position: fixed` enquanto tiver valor diferente de
   `none` — inclusive depois da animação terminar, porque
   `animation-fill-mode: both` mantém `translate: 0 0`, não `none`.
   `RestTimerBar` é `fixed` e vive dentro do conteúdo de `/sessao/[id]`;
   embrulhá-lo teria quebrado seu posicionamento relativo à viewport.
   Conferido por grep em todo o app: `Toast` e a navegação (`bottom-nav`,
   `sidebar`) já vivem no layout raiz, fora de qualquer `template.tsx`, e
   não correm esse risco — só `RestTimerBar` corria. Evitado, não
   corrigido: o risco não valia a complexidade de resetar o `translate`
   depois da animação numa tela que segura um cronômetro de treino.

---

## Fora de escopo, permanentemente

Nada de IA, chat, geração automática de dieta ou treino, prompts, embeddings
ou integração com LLM. Decisão de produto registrada no `AGENTS.md`.

### Refeição sugerida ou recomendada

Nada que proponha o que comer: refeição sugerida, plano gerado, "trocar esta
refeição", substituição automática de alimento por equivalente. **Deu dor de
cabeça na V1** e a decisão é não repetir.

O padrão de falha lá era estrutural, não de execução: a tela dependia da
sugestão para ter conteúdo, então quando a geração não devolvia itens a
refeição aparecia vazia — sem plano B visível para quem estava olhando. Uma
funcionalidade que, ao falhar, deixa a tela sem nada é pior que a ausência
dela, porque a ausência pelo menos é honesta.

Aqui a dieta se monta à mão, e é isso. O V2 nunca teve nada do tipo; se em
alguma auditoria futura aparecer "Almoço Renomeado" ou parecido no dado, é
registro que alguém escreveu testando, não recurso escondido.

A única coisa que o app oferece sem ser pedido é a estimativa de calorias pelos
macros no cadastro de alimento personalizado — e ela é mostrada como conferência
do rótulo, nunca aplicada sozinha. É aritmética, não opinião sobre o que comer.

---

## Infraestrutura

Repositório em `github.com/pxdrik/Lacalle-Life-2`, `main` sincronizada.

As Sprints 3 a 5 ficaram deliberadamente em commits locais entre 13 e 14/08,
enquanto a trilha de execuções estava sob decisão. **Estar no GitHub não é
aprovação**: a trilha continua entregue e não validada, e o que a segura é o
registro acima, não a ausência de push.

**`next dev` quebrado nesta máquina.** Falha com `0xc0000142` — erro do Windows
ao inicializar processo — centenas de vezes: os workers do Turbopack não sobem.
Não é o código; `npm run build` e a suíte inteira passam. É a máquina sem
recursos para criar processos, depois de muitos ciclos de build e teste. Um
reinício do Windows costuma resolver.

Enquanto isso, `npm run build && npm run start` serve normalmente — com a
diferença de que **não recarrega ao editar**.

---

## Auditoria externa — 19/08/2026 (produto)

Veredito **READY WITH KNOWN RISKS**, sem P0, nove achados. Cada um foi
reproduzido ao vivo antes de qualquer correção — nem todo achado sobreviveu.

- **BUG-001** (sessão "em andamento" que não fecha) — **diagnóstico
  incorreto**. A sessão fantasma mostrada era "Upper", 0/6 séries, abandonada
  num teste anterior do próprio auditor — não a sessão recém-finalizada.
  Testado do zero: finalizar funciona, a sessão some de Hoje.
- **BUG-002** (janela de confirmação de exclusão curta demais) — **provável
  falso positivo**. `DISARM_AFTER_MS` é 4000ms, não algo minúsculo; a
  reprodução com cliques espaçados por chamadas de screenshot (latência real
  de vários segundos) comeu a própria janela — o mesmo padrão que
  provavelmente enganou o auditor. Não alterado.
- **BUG-003** (hora em AM/PM) — **real, corrigido**. `TimeField` substitui
  `<input type="time">`/`datetime-local` — o Chrome segue a região do
  Windows, não o `lang="pt-BR"` da página.
- **BUG-004** (sem unidade além de grama) — **real, `ml` corrigido em rodada
  seguinte** (commit `3caaada`). "1 unidade" (1 ovo, 1 fatia) fica de fora:
  a TACO não carrega peso por unidade nenhum, e inventar um peso médio por
  alimento contrariaria "na dúvida, omitir". `ml` não tem esse problema —
  1 ml ≈ 1 g é aproximação padrão, sem depender de dado por alimento.
- **BUG-005** (quantidade sem limite superior) — **já corrigido antes da
  auditoria** (commit `f25e36d`, 15/08). O build testado provavelmente veio
  do cache do service worker.
- **BUG-006** (sinal negativo descartado em silêncio) — **decisão
  intencional**, documentada no próprio código (`meal-item-row.tsx`): "um
  sinal de menos não tem significado numa porção". Não alterado.
- **BUG-007** (peso vazio falha silenciosa) — **não é bug**: todo campo do
  formulário de Evolução é opcional por design (`BodyEntryForm`), e um
  registro totalmente vazio é tratado como nada a salvar, não como erro.
- **BUG-008** (aviso de conflito falso) — **real, corrigido**. Os hooks de
  edição (`use-diet-editor`, `use-routine-editor`, `use-session-runner`)
  chamavam a gravação de dentro do updater de `setState`; com
  `reactStrictMode: true` o React invoca esse updater duas vezes de
  propósito, disparando duas gravações concorrentes por uma edição só.
  Corrigido com uma `ref` síncrona em `apply`.
- **BUG-009** (série preenchida mas não confirmada "desaparece") — **real,
  corrigido**. O dado sempre sobreviveu (`isCompleted` só marca a
  confirmação); o resumo é que escondia os valores digitados atrás de "não
  realizada". Agora mostra o valor com "(não confirmada)".
