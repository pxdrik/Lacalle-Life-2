# Catálogo de exercícios — estrutura

Proposta para aprovação. Nada de conteúdo foi escrito ainda.

O objetivo é que este catálogo seja a fonte oficial de exercícios do Lacalle
Life e não precise ser refeito. Isso impõe duas obrigações: as decisões caras
de mudar depois precisam ser tomadas agora, e adicionar exercício precisa ser
edição de dado, nunca de código.

---

## 1. Separação de responsabilidades

```
src/features/workouts/
  types/exercise.ts            ← modelo de dados (código, estável)
  taxonomy/
    muscles.ts                 ← grupos musculares + rótulos + ordem
    equipment.ts               ← equipamentos + rótulos
    movement.ts                ← padrões de movimento + dificuldade
  validation/exercise-schema.ts ← schema Zod, roda em teste
  data/
    catalogue/
      peito.json               ← catálogo, dividido por região
      costas.json
      ombros.json
      bracos.json
      pernas.json
      core.json
      cardio.json
    aliases.json               ← sinônimos, separados
    ids.lock.json              ← ids congelados
```

**Adicionar exercício = editar um `.json`.** Nenhum arquivo `.ts` muda.

### Por que a taxonomia fica em código e o catálogo em dado

Não é inconsistência, é frequência de mudança. Adicionar exercício é rotina;
adicionar grupo muscular é estrutural — muda filtro, rótulo, ordenação e o tipo
que o compilador usa para impedir erro de digitação. Taxonomia em `.ts` gera
o tipo literal e o rótulo em PT-BR de uma vez; em `.json` exigiria geração de
código para conseguir o mesmo.

O requisito é adicionar **exercícios** sem tocar em código. Esse é atendido.

### Por que o catálogo é dividido em sete arquivos

Um arquivo de 1.500 linhas torna revisão e merge dolorosos. A divisão é por
região, e **não é uma segunda fonte de verdade**: um teste verifica que todo
exercício em `peito.json` tem `chest` entre os primários. Se discordarem, o
build quebra.

### Por que aliases ficam separados

Alias nasce de busca que falhou — cadência de edição diferente da do catálogo,
e uma lista longa de sinônimos abafaria o diff da classificação. Um teste
garante que todo alias aponta para um id existente.

---

## 2. Modelo de dados

```jsonc
{
  "id": "supino-reto-barra",
  "name": "Supino Reto com Barra",
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["front-delts", "triceps"],
  "equipment": ["barbell"],
  "movementPattern": "horizontal-push",
  "difficulty": "beginner",
  "isUnilateral": false,
  "isCompound": true
}
```

**Campo desconhecido é omitido, não preenchido com um palpite.** Um exercício
sem `difficulty` aparece na busca e some do filtro de dificuldade. Um com
`difficulty` errada aparece no filtro errado — que é pior.

Obrigatórios: `id`, `name`, `primaryMuscles`, `equipment`.
Opcionais: todo o resto.

### Reversão que a mudança de abordagem permitiu

Eu havia proposto `sourceName` e `sourceCategory` no registro, para separar
dado importado de dado inferido. **Não são mais necessários.** Com catálogo
curado à mão não existe dado inferido a distinguir — tudo foi revisado. A única
procedência que sobra é curado versus criado pelo usuário, e `classification:
"mapping" | "user"` já cobre.

Manter campos que seriam `null` em todos os registros seria carregar uma
decisão antiga por comodidade.

---

## 3. Regra de granularidade

**Um registro por progressão que se registra separadamente.**

O teste é: você anotaria as cargas na mesma linha do histórico?

| Caso | Decisão |
| --- | --- |
| Supino com barra × Supino com halteres | **Dois registros.** Cargas não são comparáveis |
| Supino reto × Supino inclinado | **Dois registros.** Estímulo e carga diferentes |
| Rosca direta com barra W × barra reta | **Um registro**, `equipment: ["barbell"]` |
| Agachamento livre × no Smith | **Dois registros.** Carga não transfere |
| Puxada pronada × supinada | **Dois registros.** Ênfase muscular diferente |

Sem essa regra o catálogo fica inconsistente — parte fundido, parte explodido —
e o histórico de carga perde sentido.

---

## 4. Taxonomias — o que mais precisa da sua revisão

Estas são as decisões caras. Mudar depois exige migrar registros.

### Grupos musculares (19)

Em ordem anatômica, não alfabética — é a ordem em que o filtro aparece.

| Chave | Rótulo | Nota |
| --- | --- | --- |
| `chest` | Peito | |
| `lats` | Dorsais | Separado de `upper-back`: puxada vertical × remada |
| `upper-back` | Costas superiores | Romboides, redondos |
| `traps` | Trapézio | |
| `front-delts` | Deltoide anterior | Deltoides separados porque se treina isolado |
| `side-delts` | Deltoide lateral | |
| `rear-delts` | Deltoide posterior | |
| `biceps` | Bíceps | |
| `triceps` | Tríceps | |
| `forearms` | Antebraços | |
| `abs` | Abdômen | |
| `obliques` | Oblíquos | |
| `lower-back` | Lombar | |
| `glutes` | Glúteos | |
| `quads` | Quadríceps | |
| `hamstrings` | Posterior de coxa | |
| `adductors` | Adutores | |
| `abductors` | Abdutores | |
| `calves` | Panturrilhas | |

**Descartei da V1:** `Pescoço` (4 registros, todos corrompidos, e ninguém
programa), e a categoria `Outro`.

### Equipamentos (11)

`barbell` Barra · `dumbbell` Halteres · `machine` Máquina · `cable` Polia ·
`smith` Smith · `kettlebell` Kettlebell · `band` Elástico ·
`bodyweight` Peso corporal · `plate` Anilha · `trx` TRX ·
`cardio-machine` Aparelho de cardio

### Padrões de movimento (11)

`horizontal-push` · `vertical-push` · `horizontal-pull` · `vertical-pull` ·
`squat` · `hinge` · `lunge` · `carry` · `isolation` · `core` · `cardio`

É o que permitiria, depois, dizer "sua semana tem quatro empurrões e nenhum
hinge". Sem isso, esse tipo de análise exigiria remodelar.

### Dificuldade (3)

`beginner` Iniciante · `intermediate` Intermediário · `advanced` Avançado

Critério: **quanto de técnica é preciso antes de carregar com segurança** — não
quão difícil é o esforço. Leg press é `beginner`, agachamento livre é
`intermediate`, pistol e nórdico são `advanced`.

---

## 5. Ids congelados

`ids.lock.json` lista todo id já publicado. Um teste falha se um id sumir do
catálogo sem sair do lock.

Existe porque um treino salvo referencia exercícios por id. Renomear um id
silenciosamente quebraria o histórico de quem já treinou. Com o lock, remover
ou renomear vira ato deliberado e visível no diff.

**Ids nunca são reaproveitados.** Se `rosca-direta-barra` for aposentado, o id
não volta a ser usado por outro exercício.

---

## 6. Garantias por teste

Todas rodam em `npm run verify`:

1. Todo registro valida contra o schema Zod.
2. Ids únicos entre todos os arquivos, no formato slug.
3. Nenhum id publicado desapareceu sem sair do lock.
4. Nomes únicos, comparados sem acento e sem caixa.
5. Nenhum alias duplicado entre exercícios — busca ambígua é bug.
6. Todo alias aponta para um id existente.
7. Exercício está no arquivo da sua região primária.
8. `isCompound: false` exige exatamente um músculo primário.
9. `movementPattern: "isolation"` é consistente com `isCompound: false`.

### Relatório de cobertura

Um script compara o vocabulário da V1 contra o catálogo curado e lista o que
ainda não tem correspondente — a lista da V1 vira checklist auditável, sem
nunca ser importada.

---

## 7. Escopo

Curadoria manual, um por um. A meta não é bater os 371 da V1: aquela lista tem
mais de cem nomes corrompidos e muita variação que ninguém registra
separadamente.

A meta é **cobertura completa do que se programa de verdade** — todo movimento
com nome consagrado em academia brasileira, com classificação em que dá para
confiar. Estimo 160 a 200 registros.

Depois da aprovação, entrego em lotes por região, para você revisar sem
precisar ler duzentos registros de uma vez.

---

## 8. Fotos dos exercícios

### Escolha da fonte

Quatro repositórios avaliados. O critério foi licença, não quantidade:

| Repositório | Licença das imagens | Decisão |
| --- | --- | --- |
| `hasaneyldrm/exercises-dataset` | © Gym visual, exige licença própria | ❌ recusado |
| `yuhonas/free-exercise-db` | Unlicense declarada; imagens são da Everkinetic, **CC BY-SA 4.0** | ✅ adotado |
| `joao-gugel/exercicios-bd-ptbr` | imagens removidas pelo próprio autor por direito autoral | ➖ nada a somar |
| `wger-project/wger` | licença por imagem, ~360 imagens | reserva |

O primeiro tem o melhor material — GIFs animados — e é justamente o que não
podemos usar. Estar redistribuído em outro repositório não muda os termos.

O adotado declara Unlicense, e essa declaração não se sustenta: as imagens vêm
da Everkinetic sob CC BY-SA 4.0, e ninguém relicencia obra de terceiro para
domínio público. Duas perguntas sobre isso no issue tracker seguem sem
resposta. Tratamos as imagens como o que elas são, o que permite uso comercial
e custa uma linha de crédito — renderizada a partir do mesmo registro que gera
a URL, em `taxonomy/media-sources.ts`, para que não exista um segundo lugar
onde a atribuição possa se perder.

### Cobertura: 105 de 183

O casamento automático propôs 75 pares. Revisando um a um, **cerca de metade
estava errada** de um jeito que só humano percebe:

- `supino-reto-barra` → "Barbell **Guillotine** Bench Press"
- `cadeira-flexora` → "**Ball** Leg Curl"
- `levantamento-terra` → "**Axle** Deadlift"
- `hiperextensao` → "**Reverse** Hyperextension" (que já é outro registro nosso)

O script foi descartado como fonte e mantido apenas como gerador de propostas.
Os 105 pares que valem estão escritos à mão em `scripts/build-exercise-media.mjs`;
os caminhos das imagens saem do próprio dataset, nunca digitados.

Os outros 78 exercícios ficam sem foto, o que o modelo já trata como estado
legítimo. É a mesma regra da classificação: **foto errada é pior que foto
nenhuma** — ela ensina o movimento errado para quem está aprendendo.

### Entrega

Via jsDelivr, sem copiar nada para este repositório. As imagens passam pelo
otimizador do Next porque o original tem 850×567 e desenhamos a 64 px de
largura; `<img>` direto enviaria cerca de duzentas vezes os pixels
necessários. De quebra, as URLs ficam same-origin, que é do que o service
worker vai precisar quando o offline entrar.

### Migração

Semear pula banco já populado, então quem usava o app antes disso nunca veria
foto alguma. `refreshExerciseMedia` preenche as linhas guardadas, uma vez por
revisão do mapeamento. Linhas escritas antes deste campo **não têm a chave
`media`** — `undefined`, não `null` — e essa distinção é o que a função precisa
enxergar para não pular exatamente as linhas que existe para corrigir.
