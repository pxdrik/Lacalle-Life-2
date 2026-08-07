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

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar → rever no histórico.

---

## Próximo

### 1. Detalhe do exercício e fotos no treino

Duas lacunas da mesma raiz: a foto existe, mas só cabe numa miniatura de 64 px
e não aparece onde o treino acontece.

#### A execução já está no banco

**Cada um dos 105 exercícios tem exatamente duas fotos** — a convenção da
Everkinetic é posição inicial e posição final. Hoje renderizamos só a
primeira, ou seja, **jogamos fora metade do que já baixamos, e essa metade é
justamente o movimento.** Mostrar as duas (lado a lado, ou alternando) entrega
"ver a execução" sem nenhum investimento novo de conteúdo. É o maior retorno
por esforço de todo o roadmap.

#### O que entra na tela de detalhe

- As duas fotos em tamanho grande, com zoom
- Músculos secundários, estabilizadores, padrão e plano de movimento — tudo
  curado e invisível hoje
- Dificuldade técnica, unilateral, composto, equipamentos, outros nomes
- Última performance e recorde, que já existem em `services/history.ts`

Os 78 exercícios sem foto precisam valer a abertura mesmo assim. O detalhe é
sobre o exercício, não sobre a imagem.

#### Onde precisa ser alcançável

- `/exercicios` — tocar na linha
- Editor de rotina — a foto ao lado de cada exercício, e o detalhe ao tocar
- Execução — o caso mais importante e o mais delicado: é de pé, com uma mão,
  no meio da série. A foto **não pode empurrar as séries para fora da tela**.
  Miniatura que abre o detalhe, nunca imagem grande embutida.

#### Decisão de modelagem que precisa ser respeitada

`RoutineExercise` e `SessionExercise` guardam `{ exerciseId, name }` — o nome é
**cópia**, o id é **referência viva**. A foto segue o id, nunca a cópia:

- Copiar a foto para dentro da rotina congelaria uma imagem que ainda podemos
  corrigir, e incharia o documento agregado sem necessidade.
- A regra de "sessão é uma fotografia da rotina" continua valendo: o que foi
  congelado é a **estrutura do plano**, não o dado de referência do catálogo.

Consequência prática: os cards de rotina e de sessão hoje não têm o `Exercise`
completo em mãos. O editor de rotina já carrega o catálogo; **a execução não**
— resolver isso é o grosso do trabalho, e não pode custar o offline.

#### Obrigações que acompanham a imagem

O crédito CC BY-SA 4.0 vale onde a obra aparece. Toda superfície nova que
mostrar foto renderiza a atribuição a partir de `taxonomy/media-sources.ts` —
nunca escrita à mão.

---

## Roadmap

### 2. Refinamentos restantes de `/exercicios`

Levantados na auditoria de UX. O detalhe do exercício sai daqui e vira o item
1; o resto continua adiado:

- Navegação por grupo muscular na primeira dobra
- Agrupar os 19 chips de músculo em 6 regiões
- Reduzir o ruído da linha (três tags por linha)
- Recentes e mais usados

### 3. Cobertura de fotos

78 exercícios sem imagem. `wger` tem licença por imagem e cerca de 360 fotos —
serve para preencher lacunas, uma a uma, com a mesma regra do catálogo: **foto
errada é pior que foto nenhuma.** Nunca por casamento automático.

### 4. Evolução corporal

Peso corporal, medidas, fotos, gráficos de tendência. Entidades novas e escopo
próprio.

### 5. PWA e offline completo

Service worker cacheando o shell. O dado já é local e funciona offline; falta
a aplicação abrir sem rede — e, agora, as fotos. Passar pelo otimizador do
Next deixou as URLs same-origin justamente pensando nisso.

### 6. Sincronização

A camada de repositório foi desenhada para isto desde o primeiro commit:
`updatedAt` em toda entidade, ids gerados no cliente, e a raiz de composição
como único ponto que sabe qual implementação está por trás de cada interface.
Trocar local por remoto é editar `composition/`.

Exigirá tombstones para deleção propagar — decisão adiada de propósito, e que
muda implementações de adapter, nunca portas nem UI.

---

## Fora de escopo, permanentemente

Nada de IA, chat, geração automática de dieta ou treino, prompts, embeddings
ou integração com LLM. Decisão de produto registrada no `AGENTS.md`.

---

## Infraestrutura

Repositório em `github.com/pxdrik/Lacalle-Life-2`, `main` sincronizada.
