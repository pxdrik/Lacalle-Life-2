# Roadmap

O que foi entregue, o que vem a seguir e o que ficou registrado para não
depender da memória de nenhuma conversa.

---

## Entregue

| Módulo | Estado |
| --- | --- |
| Fundação local-first | Contrato `Store<T>`, dois adapters conformes, migrações declarativas |
| Design system | Tokens OKLCH, dark mode sem flash, contraste asserido por teste |
| Alimentos | 216 curados da V1, busca sem acento, favoritos, personalizados |
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

      **Decisão em aberto: o raio do botão contra o do campo.** Lado a lado e
      da mesma altura, o botão fecha em `--corner-md` (10px no desktop) e o
      campo em `--corner-lg` (14px). Não mexi porque uniformizar muda o
      acabamento de todos os botões ou de todos os campos do app, e a direção
      que combina com a sprint — arredondar mais, que lê mais acolhedor que
      utilitário — é escolha de dono, não de implementação.

### P3 — Consistência

- [ ] **Uma linguagem só entre desktop e mobile.** A barra inferior fica; ganha a
      identidade da V1. No desktop, navegação reconhecível e com hierarquia.
- [ ] **Mobile não paga a conta do desktop.** Alvo de toque, legibilidade,
      pouco esforço visual — o app é usado durante a refeição e durante o treino.
- [ ] **Alimentos parece planilha.** A lista pode continuar lista; a tela precisa
      parecer app de alimentação. (Ver a decisão tabela-vs-cartão mais abaixo: a
      forma foi escolhida por causa do dado, e continua valendo. O que muda aqui
      é o acabamento — hierarquia, agrupamento, busca, filtro, estado.)
- [ ] **Exercícios:** o filtro foi apontado como um dos melhores componentes
      atuais. Preservar a ideia — chips, categorias, modal, badges — e trazer
      para a mesma linguagem.
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

---

## Ajustes pendentes

Os treze achados verificados das auditorias foram fechados. Sobram dois: uma
oportunidade e um achado de contraste.

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

**Virou bloqueio.** O redesign visual pede o símbolo em cinco lugares — header,
celular, favicon, carregamento e estado vazio — e ele não existe. É a única
peça da sprint que não dá para tirar do código.

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

**`next dev` quebrado nesta máquina.** Falha com `0xc0000142` — erro do Windows
ao inicializar processo — centenas de vezes: os workers do Turbopack não sobem.
Não é o código; `npm run build` e a suíte inteira passam. É a máquina sem
recursos para criar processos, depois de muitos ciclos de build e teste. Um
reinício do Windows costuma resolver.

Enquanto isso, `npm run build && npm run start` serve normalmente — com a
diferença de que **não recarrega ao editar**.
