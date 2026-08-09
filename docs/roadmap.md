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
| Identidade visual | Esmeralda da V1 nas superfícies, escuro por padrão, contraste asserido nos dois temas |
| Densidade por contexto | Desktop mais denso que o celular, não menor — 1152px de conteúdo, cartão de 24px |
| Números em pt-BR | `formatDecimal` em toda superfície: 2,7 e 2.220, e travessão no lugar de `NaN` |
| Tela de hoje | Anel de calorias, macros contra a meta e o treino do dia — funciona sem perfil |
| Navegação no celular | Barra inferior de 5 abas ao alcance do polegar; o resto atrás de "Mais" |
| PWA e offline | Instalável, e abre sem rede — shell, assets e payloads de rota em cache |
| Incremento rápido | −1/+1 rep e ∓2,5 kg na série em execução, partindo do planejado quando o campo está vazio |
| Peso decimal digitável | O separador era engolido ao ser digitado: 6·2·vírgula·5 gravava 625 kg |

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar → rever no histórico.

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

### 4. Sugerir atualizar o peso do perfil

Hoje o registro corporal e o perfil são independentes de propósito: o peso do
perfil é **entrada** do cálculo de metas, e o registro é a **história**. Mas um
perfil parado em 84 kg enquanto a última pesagem diz 80 kg calcula metas
erradas em silêncio.

O passo certo é oferecer, não sincronizar: "seu perfil usa 84 kg, sua última
medição é 80 kg — atualizar?". Mantém a dieta sem depender de nada opcional.

### 5. Fibra rastreável

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

### 6. Sincronização

A camada de repositório foi desenhada para isto desde o primeiro commit:
`updatedAt` em toda entidade, ids gerados no cliente, e a raiz de composição
como único ponto que sabe qual implementação está por trás de cada interface.
Trocar local por remoto é editar `composition/`.

Exigirá tombstones para deleção propagar — decisão adiada de propósito, e que
muda implementações de adapter, nunca portas nem UI.

---

## Ajustes pendentes

Achados verificados que não entraram em nenhum item acima. Cada um é pequeno o
bastante para caber numa sessão; nenhum exige redesenho. Marcados com a origem,
porque saber quem apontou ajuda a decidir se ainda vale.

### Comportamento

| O quê | Onde | Por quê |
| --- | --- | --- |
| **Toast de confirmação** | Salvar perfil, criar alimento | Não existe nenhum toast no app. Editar gramas se auto-evidencia — o número muda na frente da pessoa — mas salvar perfil e criar alimento só confirmam navegando de volta, que é feedback fraco para escrita |
| **Aviso antes do timeout** | `useArmed` | O botão armado volta ao normal em 4 s sem contador nem transição. Quem hesita perde a ação em silêncio e precisa clicar de novo — justamente num momento de decisão |
| **Nome do exercício em duas linhas** | Editor de rotina | "Supino Declinado com Barra" vira "Supi…" numa linha só. Na montagem do treino, que é quando se escolhe |
| **Filtro sobreposto** | `/exercicios` | O painel expande inline e empurra a lista inteira para baixo. Num telefone custa rolagem para voltar aos resultados |
| **Placeholder que parece preenchido** | Perfil | `30`, `180`, `80` são valores plausíveis. A cor está certa (`ink-subtle`), o conteúdo é que engana — trocar por texto que não possa ser confundido com dado |

### Consistência

| O quê | Estado medido |
| --- | --- |
| **Rótulo de confirmação** | 5× `"Excluir?"`, 1× `"Remover?"`, 1 sem rótulo caindo no `"Confirmar"` genérico (`body-history`) |
| **Botão de criar entre catálogos** | Treinos, Dietas e Alimentos têm botão fixo; Exercícios só oferece criar depois de busca sem resultado. A solução do Exercícios é melhor — escolher uma e aplicar às quatro |
| **Tabela vs cartão** | Alimentos usa colunas, Exercícios usa cartão com foto. São a mesma coisa conceitual: catálogo de referência com busca e filtro |
| **Modal vs painel inline** | A distinção existe e é coerente (modal = consulta, inline = edição), mas não está escrita em lugar nenhum. Sem regra registrada, a próxima tela decide sozinha |

### Robustez

| O quê | Por quê |
| --- | --- |
| **Guarda de macro inválido na escrita** | Não há nenhum `isFinite` em `features/foods`, `features/diet` ou `core/domain`. A tela está protegida — `formatDecimal` mostra travessão —, mas o dado não: um macro corrompido entra no `sumMacros` e contamina o total |
| **Página 404 própria** | Não existe `not-found.tsx`. A página padrão do Next não tem link de volta nem a navegação do app |
| **`apple-touch-icon`** | O manifesto tem SVG, que o Android usa. iOS quer PNG — sem ele, a tela inicial do iPhone usa uma captura da página |

### Identidade

O app tem voz e comportamento reconhecíveis, mas nenhum elemento gráfico
exclusivo além da cor: tirando o nome do topo, não há uma forma, ícone ou
ilustração que seja só dele. É oportunidade, não defeito — um gesto visual
pequeno (marca no anel de progresso, ilustração para estado vazio) transformaria
"app calmo e técnico" em algo identificável à primeira vista.

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
