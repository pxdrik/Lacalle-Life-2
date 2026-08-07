# Roadmap

O que foi entregue, o que está em andamento e o que ficou registrado para
não depender da memória de nenhuma conversa.

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
| Treinos | Criar rotina, montar, configurar séries/reps/peso/descanso/RPE |
| Execução | Marcar série, cronômetro, edição inline, finalizar, resumo |

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar.

---

## Em andamento

### 1. Retomar e histórico

Fecha um furo real: hoje uma sessão iniciada e abandonada fica órfã, e uma
sessão concluída nunca mais é vista. O dado está gravado corretamente e
apenas inalcançável.

- Treino em andamento no topo de `/treinos`, com "Continuar"
- `/historico` listando sessões concluídas
- Abrir o resumo de qualquer sessão passada

### 2. "Última vez"

Durante a execução, cada exercício mostra o que foi feito da última vez. É a
diferença entre um registrador e uma ferramenta de treino: sem isso a carga é
adivinhada a cada sessão.

Exige índice por `exerciseId` nas sessões — migração v6.

### 3. PRs e volume

Recorde por exercício, volume semanal e mensal, carga por exercício ao longo
do tempo.

---

## Roadmap

### 4. Evolução corporal

Peso corporal, medidas, fotos, gráficos de tendência. Entidades novas e
escopo próprio — deliberadamente separado de 1–3, que só tornam visível o que
já existe.

### 5. Drag and drop

Reordenar refeições, itens de refeição e exercícios da rotina arrastando.

**Entra como acelerador, nunca como único caminho.** As setas de reordenar já
funcionam com teclado, leitor de tela e um polegar, e permanecem. `@dnd-kit`
pelo sensor de teclado.

### 6. Duplicar e copiar

- Duplicar refeição
- Copiar e mover alimento entre refeições
- Duplicar exercício dentro da rotina
- Duplicar rotina inteira

### 7. Refinamentos de UX em `/exercicios`

Levantados na auditoria de UX e adiados de propósito:

- Detalhe do exercício ao tocar na linha — músculos secundários,
  estabilizadores, padrão e plano estão curados e invisíveis hoje
- Navegação por grupo muscular na primeira dobra
- Agrupar os 19 chips de músculo em 6 regiões
- Reduzir o ruído da linha (três tags por linha)
- Recentes e mais usados
- Ilustrações — investimento de conteúdo, registrado como lacuna conhecida

### 8. PWA e offline completo

Service worker cacheando o shell. O dado já é local e funciona offline; falta
a aplicação abrir sem rede.

### 9. Sincronização

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

**O repositório é local.** `git init` sem remote, 15 commits, nenhum backup
remoto. Configurar o GitHub está pendente de decisão do dono do projeto.
