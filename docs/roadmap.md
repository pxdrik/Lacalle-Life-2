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
| Identidade visual | Esmeralda da V1, neutros tingidos, contraste asserido nos dois temas |
| Densidade por contexto | Cartão no celular, Compacto no desktop — um conjunto de tokens, dois valores |
| Números em pt-BR | `formatDecimal` em toda superfície: 2,7 e 2.220, e travessão no lugar de `NaN` |

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar → rever no histórico.

---

## Roadmap

### 1. Tela de "hoje" (o Dashboard que falta)

A `/` diz uma frase e nada mais. O comentário em `src/app/page.tsx` explica o
porquê: *"a dashboard appears when there is data to summarise; scaffolding one
now would be decoration."*

**Essa condição expirou.** Hoje existem dieta, diário, sessões, pesagens e
metas — há o que resumir. O item mais à esquerda do menu é "Diário", que
responde só pela metade alimentar: quem abre o app de manhã não tem em tela
nenhuma a resposta para "como estou indo hoje, no geral".

Foi o único achado da análise comparativa com a V1 (agosto de 2026) que
apontou algo que o V2 não tem e deveria ter. O resto das críticas de lá partia
de premissa errada — a de que a interface inteira é monoespaçada (são 30
elementos sans para 9 mono numa tela típica, e todos os mono são números) e a
de que o catálogo tem dado de teste (as 216 entradas versionadas estão limpas;
o lixo estava no IndexedDB do navegador de quem auditou).

O que a V1 faz e vale copiar: anel de calorias como única métrica em destaque
máximo, macros ao lado, treino e refeições do dia em cards paralelos, alertas
contextuais. O que **não** vale copiar de lá: estimar caloria gasta a partir de
"Leve/Moderado/Pesado" — é número inventado com cara de medição.

### 2. Refinamentos restantes de `/exercicios`

Levantados na auditoria de UX. O detalhe do exercício saiu daqui e foi
entregue; o resto continua adiado:

- Navegação por grupo muscular na primeira dobra
- Agrupar os 19 chips de músculo em 6 regiões
- Reduzir o ruído da linha (três tags por linha)
- Recentes e mais usados

### 3. Cobertura de fotos

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

### 4. Fotos de progresso

A metade da evolução corporal que ficou de fora. Exige infraestrutura que
ainda não existe: redimensionar a imagem antes de guardar (uma foto de celular
tem 4 MB, e uma por semana enche o IndexedDB em um ano) e um store separado,
para que ler um peso não arraste blobs junto.

### 5. Sugerir atualizar o peso do perfil

Hoje o registro corporal e o perfil são independentes de propósito: o peso do
perfil é **entrada** do cálculo de metas, e o registro é a **história**. Mas um
perfil parado em 84 kg enquanto a última pesagem diz 80 kg calcula metas
erradas em silêncio.

O passo certo é oferecer, não sincronizar: "seu perfil usa 84 kg, sua última
medição é 80 kg — atualizar?". Mantém a dieta sem depender de nada opcional.

### 6. Fibra rastreável

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

### 7. PWA e offline completo

Service worker cacheando o shell. O dado já é local e funciona offline; falta
a aplicação abrir sem rede — e, agora, as fotos. Passar pelo otimizador do
Next deixou as URLs same-origin justamente pensando nisso.

### 8. Sincronização

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
