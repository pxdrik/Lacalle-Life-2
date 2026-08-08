# Prompt de auditoria — rodada 3 (regressão)

As duas primeiras rodadas foram auditorias gerais e estão em `docs/auditoria.md`
e `docs/auditoria-v1.md`. Esta é diferente: o produto mudou desde então, e o que
interessa agora é **se as correções funcionam e o que elas quebraram**.

Duas mudanças de processo, e o motivo de cada uma está no fim do arquivo.

---

## O prompt

> Você vai auditar o **Lacalle Life V2**, um app local-first de dieta e treino,
> em português do Brasil, rodando em `npm run dev`. Esta é a terceira rodada:
> as duas anteriores foram auditorias gerais, e boa parte do que apontaram já
> foi corrigido. **Sua missão agora é verificar as correções e caçar o que elas
> quebraram.** Regressão vale mais que descoberta nova aqui.
>
> Atue como QA sênior e Dev Full Stack, com um Designer olhando por cima do
> ombro. Não elogie. O objetivo é encontrar o que está errado.
>
> ### Antes de tudo: como entregar
>
> **Comece pela lista de bugs.** Nas duas rodadas anteriores o relatório chegou
> cortado antes dela — toda a análise se perdeu porque o que valia estava no
> fim. Inverta: bugs primeiro, contexto depois.
>
> Entregue em partes numeradas, **uma mensagem por parte**, parando ao fim de
> cada uma:
>
> - **Parte 1 — Bugs.** Se só couber uma coisa, que seja esta.
> - **Parte 2 — Verificação das correções** (a tabela da seção seguinte).
> - **Parte 3 — Falsos positivos descartados.**
> - **Parte 4 — Telas novas: UX, design e produto.**
> - **Parte 5 — Notas e o que faria a seguir.**
>
> Se uma parte ficar longa, quebre em 3a, 3b. Nunca comprima para caber.
>
> ### Restrições fundadoras — não recomende contra elas
>
> Decisões de produto já tomadas, registradas em `AGENTS.md`. Recomendar o
> contrário é erro de auditoria, não insight:
>
> 1. **Nada de IA.** Sem chat, geração automática, prompts, embeddings, LLM.
> 2. **O produto faz três coisas:** montar dieta, montar treino, acompanhar
>    evolução. O que não serve a uma delas é escopo indevido.
> 3. **Local-first.** IndexedDB é a única fonte de verdade. Sem backend, sem
>    login, sem sincronização nesta versão.
> 4. **Perfil é opcional.** Montar dieta funciona sem responder nada sobre
>    idade, peso ou sexo.
> 5. **Menos é mais.** Se não ajuda a montar dieta ou treino, corte.
>
> ### O que mudou desde a última auditoria
>
> Commit `013850a`. Sete frentes, e cada uma tem um jeito específico de quebrar:
>
> **1. Separador decimal em todo o app.** Existe agora um `formatDecimal` em
> `src/core/format/decimal.ts` aplicado em dieta, alimentos, perfil e treino.
> Regra: vírgula decimal, ponto de milhar, **e nunca alterar o dígito** —
> `62,75` tem de continuar `62,75`, não virar `62,8`. Entrada não finita vira
> travessão (`—`).
>
> Ataque: procure qualquer número na tela ainda com ponto decimal. Procure
> qualquer número que tenha sido **arredondado** pela formatação. Confira se
> `aria-label` e texto visível dizem o mesmo número.
>
> **2. Barra de meta em duas colunas no celular.** `MacroProgress` passou a ser
> 2 colunas abaixo de `sm` e 4 acima, porque `1.256/2.220` não cabia em quatro
> colunas num telefone. Ataque: metas de 4 e 5 dígitos, teste em 320px.
>
> **3. Linha de alimento quebra em duas no celular.** `MealItemRow` agora põe
> nome + porção na primeira linha e os números na segunda abaixo de `sm`.
> Ataque: **nome de alimento muito longo** (crie um com 120 caracteres),
> larguras 320 / 360 / 375 / 414 / 640 / 641, e arrastar para reordenar
> enquanto está quebrado. O item não pode transbordar o cartão em nenhuma.
>
> **4. Finalizar treino pede dois toques.** Com série pendente, o primeiro
> toque arma o botão ("Encerrar assim?", vermelho) e o segundo encerra. Com
> tudo concluído, um toque só. Desarma sozinho em 4 segundos e ao perder o
> foco.
>
> Ataque: teclado (Tab e Enter), armar e esperar 5 s, armar e clicar noutro
> lugar, armar e completar a última série sem desarmar, treino com zero
> exercícios, treino com uma série só. Confira que o rótulo cabe na barra fixa
> a 320px sem empurrar nada.
>
> **5. Fibra passou a se declarar referência**, não meta acompanhada, em
> `/perfil`. Ataque: o texto explica de fato por que o número existe? Alguém
> ainda pode achar que o app soma fibra?
>
> **6. Diário alimentar (`/diario`), com data.** Registra o que foi comido num
> dia, opcionalmente partindo de uma dieta. **Invariante mais importante do
> app:** o diário é uma *fotografia* da dieta — copia tudo e não compartilha
> nenhum id, em nenhuma profundidade. Editar o diário **não pode** alterar a
> dieta de origem, e editar a dieta depois **não pode** alterar o diário.
>
> Ataque: monte um diário a partir de uma dieta, mude gramas nos dois lados,
> renomeie refeição, remova item, e confira no IndexedDB que nenhum id se
> repete entre os dois registros. Isso vale mais que qualquer achado visual.
>
> **7. Data retroativa em pesagem e sessão**, e edição de alimento
> personalizado. Ataque: data futura, data absurda (1900, 2200), fuso —
> registre às 23h e confira que o dia gravado é o de hoje, não o de amanhã.
>
> ### Semeie dados antes de olhar qualquer tela
>
> App vazio só revela tela de estado vazio. Crie: um perfil, duas dietas com
> refeições e itens, três a cinco sessões concluídas em datas diferentes, seis
> pesagens ao longo de semanas, uma rotina montada, e **dois ou três dias de
> diário alimentar**.
>
> Use a UI onde der e o IndexedDB onde for mais rápido — mas confira as formas
> em `src/features/*/types/` antes, para não gravar registro malformado e
> depois reportá-lo como bug.
>
> **Cuidado com `BodyEntry` e `FoodLog`: a chave primária é o dia
> (`YYYY-MM-DD`).** Um registro por dia é desenho, não defeito.
>
> ### Rotas
>
> ```
> /                     início
> /diario               diário alimentar (novo)
> /treinos              lista de rotinas
> /treinos/[id]         editor de rotina
> /sessao/[id]          execução e resumo do treino
> /dietas               lista de dietas
> /dietas/[id]          editor de dieta
> /alimentos            banco de alimentos
> /alimentos/novo       criar alimento
> /alimentos/[id]/editar  editar alimento personalizado (novo)
> /exercicios           catálogo de exercícios
> /evolucao             evolução corporal e de treino
> /perfil               perfil e metas
> ```
>
> Não existe Dashboard nem Chat. Audite `/` pelo que ela é.
>
> ### Verifique antes de reportar
>
> Esta parte separa auditoria de palpite. Nas duas rodadas anteriores três
> achados eram falsos:
>
> - **Formato de data e hora vem do locale do navegador.** Esta máquina roda
>   `en-US`, então relógio de 12h e `input[type=date]` em MM/DD **não são bugs
>   do app** — o valor guardado está correto e `lang="pt-BR"` está certo. Já
>   foi reportado duas vezes; não reporte uma terceira.
> - **Número errado pode ser dado que você semeou errado.** Confira o tipo.
> - **Erro no console pode ser overlay retido** de edição anterior. Cheque o
>   timestamp, e se `npm run verify` e `npm run build` passam.
>
> Para cada bug, diga **como você verificou** que é do app.
>
> ### Formato de cada bug
>
> ```
> ### B{n} — {título curto} [Crítico|Alta|Média|Baixa]
> Sintoma:    o que se vê
> Reproduzir: passos exatos, com largura de tela e tema
> Verifiquei: como você descartou que fosse locale, dado semeado ou overlay
> Causa:      onde e por quê, com nome de arquivo
> Correção:   o que fazer, concretamente
> Arquivos:   caminhos afetados
> ```
>
> ### Tabela de verificação das correções (Parte 2)
>
> Uma linha por frente das sete acima: **Funciona / Funciona em parte / Não
> funciona / Quebrou outra coisa**, com a evidência que sustenta o veredito.
>
> ### Sobre quantidade
>
> **Não preencha cota.** Prefiro 15 bugs reais a 80 onde 65 são "adicionar
> tooltip". Quando a substância acabar, diga que acabou — isso é informação, e
> item que existe para bater número custa triagem e não vale nada.
>
> Teste nos dois temas, em teclado, e nas larguras 320, 360, 768 e 1920.

---

## O que mudou em relação ao prompt anterior, e por quê

**A lista de bugs foi para o começo, e a entrega virou por partes.** É a
mudança mais importante. As duas auditorias anteriores chegaram truncadas — a
#1 na linha 186, a #2 na 162 — e nas duas o corte caiu antes da lista `B1–B15`,
do roadmap e das notas. Toda a análise foi feita e se perdeu no transporte.
Ordenar por valor-se-cortado resolve isso sem depender de o relatório caber.

**O foco saiu de "audite tudo" para "verifique estas sete frentes".** Auditoria
geral já foi feita duas vezes; a terceira repetiria os mesmos achados. O que
não se sabe agora é se as correções funcionam e o que elas quebraram.

**Cada frente vem com um vetor de ataque concreto.** "Teste a linha de
alimento" produz "parece ok". "Crie um nome de 120 caracteres e meça a 320px"
produz um veredito. O auditor não conhece o código; dizer onde é frágil é o que
transforma tempo dele em achado.

**O falso positivo de locale entrou nomeado.** Relógio de 12h e data em MM/DD
foram reportados nas duas rodadas, e nas duas eram o `en-US` do navegador desta
máquina. Pedir genericamente "verifique antes de reportar" não impediu; dizer
qual é o erro específico, sim.

**Entrou o invariante da fotografia do diário.** É a regra mais profunda do
app e a que, se quebrar, corrompe dado de verdade em vez de só desalinhar
pixel. Vale mais checagem que qualquer tela.
