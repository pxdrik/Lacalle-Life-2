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

**31 exercícios sem imagem**, de 78 na primeira rodada. A segunda passagem no
`free-exercise-db` fechou 47.

O que sobrou não é preguiça de busca: são versões em máquina de exercícios que
o dataset só tem na forma livre, movimentos que ele simplesmente não cobre, e
casos onde a foto disponível apagaria uma distinção real (búlgaro × split
squat, romeno × stiff-legged). A lista completa e o motivo de cada um estão em
`docs/catalogo-exercicios.md`.

Próxima fonte: `wger`, licença por imagem e cerca de 360 fotos — mesma regra,
uma a uma, nunca por casamento automático.

### 3. Evolução corporal

Peso corporal, medidas, fotos, gráficos de tendência. Entidades novas e escopo
próprio.

### 4. PWA e offline completo

Service worker cacheando o shell. O dado já é local e funciona offline; falta
a aplicação abrir sem rede — e, agora, as fotos. Passar pelo otimizador do
Next deixou as URLs same-origin justamente pensando nisso.

### 5. Sincronização

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
