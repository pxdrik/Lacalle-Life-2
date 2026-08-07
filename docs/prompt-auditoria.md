# Prompt de auditoria — Lacalle Life V2

Versão corrigida do prompt original, ajustada ao produto real. As mudanças e o
motivo de cada uma estão no fim do arquivo.

---

## O prompt

> Você vai auditar o **Lacalle Life V2**, um app local-first de dieta e treino,
> em português do Brasil. Atue como um time: Product Manager de SaaS, UX/UI
> Designer sênior, Dev Full Stack sênior, QA, Nutricionista, Personal Trainer,
> especialista em retenção e fundador de Health Tech.
>
> **Sua missão não é elogiar. É encontrar tudo que está errado, incompleto ou
> mal resolvido**, com o rigor de quem decide se coloca dinheiro no produto.
>
> ### Restrições fundadoras — não recomende contra elas
>
> Estas são decisões de produto já tomadas e registradas em `AGENTS.md`.
> Recomendar o contrário é erro de auditoria, não insight:
>
> 1. **Nada de IA.** Sem chat, geração automática, prompts, embeddings ou
>    LLM. Não trate a ausência disso como lacuna.
> 2. **O produto faz três coisas:** montar dieta, montar treino, acompanhar
>    evolução. Funcionalidade que não serve a uma delas é escopo indevido.
> 3. **Local-first.** IndexedDB é a única fonte de verdade. Sem backend, sem
>    login, sem sincronização nesta versão.
> 4. **Perfil é opcional.** Montar dieta tem de funcionar sem responder nada
>    sobre idade, peso ou sexo. Não proponha onboarding obrigatório.
> 5. **Menos é mais.** Antes de sugerir algo, responda: isso ajuda a montar
>    dieta ou treino? Se não, corte.
>
> ### Método — obrigatório, nesta ordem
>
> **1. Semeie dados reais antes de olhar qualquer tela.** Um app vazio só
> revela a tela de estado vazio. Crie: um perfil, duas dietas com refeições e
> itens, três a cinco sessões de treino concluídas em datas diferentes, seis
> pesagens ao longo de semanas, e uma rotina montada. Use a UI onde der e o
> IndexedDB onde for mais rápido — mas confira as formas dos tipos em
> `src/features/*/types/` antes, para não gravar registro malformado.
>
> **2. Navegue por todas as rotas.** São estas, e só estas:
>
> ```
> /                     início
> /treinos              lista de rotinas
> /treinos/[id]         editor de rotina
> /sessao/[id]          execução e resumo do treino
> /dietas               lista de dietas
> /dietas/[id]          editor de dieta
> /alimentos            banco de alimentos
> /alimentos/novo       criar alimento
> /exercicios           catálogo de exercícios
> /evolucao             evolução corporal e de treino
> /perfil               perfil e metas
> ```
>
> Não existe Dashboard nem Chat. Se achar que `/` deveria ser um dashboard,
> argumente — mas audite o que ela é hoje.
>
> **3. Teste de verdade.** Clique em todo botão, envie todo formulário, use os
> dois temas, teste em largura de celular e de desktop, navegue por teclado.
>
> **4. Verifique antes de reportar.** Esta parte é a que separa auditoria de
> palpite:
>
> - Um número errado na tela pode ser dado que **você** semeou errado. Confira
>   o tipo antes de chamar de bug.
> - Erros no console do Next podem ser de edições anteriores retidas no
>   overlay. **Confira o timestamp** e se `npm run verify` e `npm run build`
>   passam.
> - Formato de data, hora e moeda pode vir do locale do **navegador**, não do
>   app. Cheque `navigator.language` e `document.documentElement.lang`.
>
> Ao final, inclua uma seção **"Falsos positivos descartados"** com o que você
> investigou e concluiu que não era defeito. Isso vale tanto quanto os bugs.
>
> ### Para cada tela
>
> Nome · objetivo · o que faz · o que está bom · o que está ruim · o que confunde
> · o que falta · o que pode ser removido · o que pode ser simplificado · o que
> pode ser automatizado · **Nota UX (0-10) · Design (0-10) · Produto (0-10)**.
>
> Se uma decisão de design parecer ruim, explique o porquê. Se algo for
> excelente, explique por que é excelente — mas não invente elogio para
> equilibrar.
>
> ### Avaliação visual
>
> Paleta, espaçamento, tipografia, hierarquia, contraste, legibilidade, dark
> mode, consistência, responsividade, ícones, cards, tabelas, gráficos, botões,
> inputs, animações, loading, estados vazios, mensagens de erro, feedback.
>
> ### Comparação
>
> MyFitnessPal, Hevy, Strong, MacroFactor, Cronometer, Fitbod, Apple Health.
> Para cada um: **o que faz melhor e por quê** — não o que tem a mais, o que
> resolve melhor.
>
> ### Fluxo do usuário novo
>
> **Conte os cliques** da abertura até o primeiro treino executado e até a
> primeira refeição registrada. Onde há atrito, onde abandona, quais telas
> passam pouca confiança, quais parecem inacabadas.
>
> ### Nutrição e treino
>
> Nutrição: plano, registro, macros, calorias, substituições, equivalências,
> relatórios. O que um nutricionista esperaria e não encontra?
>
> Treino: cadastro, execução, histórico, progressão, carga, volume, descanso,
> PRs. Compare com Hevy e Strong.
>
> ### No lugar da seção de IA
>
> Liste o que usuários pedem a uma IA em apps concorrentes e responda: **como
> resolver cada um deles aqui de forma determinística**, com dado curado, regra
> ou cálculo. Se algo genuinamente só se resolve com IA, diga — e diga que fica
> fora por decisão de produto.
>
> ### Formato da entrega
>
> Gere **`docs/auditoria.md`**. Cada problema como tarefa técnica pronta para
> virar backlog:
>
> ```
> ### B{n} — {título curto} [Crítico|Alta|Média|Baixa]
> Sintoma:   o que se vê
> Como reproduzir: passos exatos
> Causa:     onde e por quê, com nome de arquivo
> Correção:  o que fazer, concretamente
> Arquivos:  caminhos afetados
> ```
>
> Feche com roadmap em quatro faixas (Crítico, Alta, Média, Baixa),
> monetização (o que é grátis, o que é Premium, e por quê), e uma tabela de
> notas finais por eixo.
>
> ### Sobre quantidade
>
> **Não preencha cota.** Prefiro 40 itens com substância a 200 onde 150 são
> "adicionar tooltip". Entregue tudo que for real, e quando a substância
> acabar, diga que acabou. Se um item só existe para bater número, ele custa
> triagem e não vale nada.

---

## O que mudou em relação ao prompt original, e por quê

**Saiu a seção de IA.** O original pedia auditoria do "Chat com IA". Ele existe
na V1, não aqui — e "nada de IA" é a regra fundadora deste projeto. Auditar a
ausência dela como defeito gera recomendações que contradizem a decisão do dono
do produto. No lugar entrou a pergunta que de fato ajuda: o que as pessoas
resolvem com IA por lá, e como resolver aqui sem ela.

**Saiu o Dashboard como premissa.** Não existe. A rota `/` é outra coisa e
precisa ser auditada pelo que é.

**Entraram as restrições fundadoras.** Sem elas, uma auditoria honesta sugere
onboarding obrigatório, login e sincronização — todos já recusados por decisão
registrada. Listá-las evita gastar análise em recomendação morta.

**Entrou "semeie dados primeiro".** Foi a mudança de método com maior efeito.
Metade dos achados reais só aparece com dieta cheia, histórico de treino e
série de pesagens. Sem isso a auditoria vira crítica de estado vazio.

**Entrou "verifique antes de reportar" e a seção de falsos positivos.** Na
primeira rodada eu quase reportei três coisas que não eram bugs: um `NaN` que
veio de dado que eu mesmo gravei errado, erros de console que eram de edições
minhas retidas no overlay, e um relógio de 12 horas que vinha do locale do
navegador. Uma auditoria que não separa isso perde credibilidade inteira.

**Entrou a lista real de rotas.** Sem ela o auditor procura telas que não
existem e reporta ausência de coisas que nunca foram escopo.

**Saíram as cotas numéricas.** 260 itens forçam preenchimento. A regra virou
substância, com permissão explícita de parar.

**Entrou "conte os cliques".** "Existe atrito?" é respondível com opinião;
"quantos cliques até o primeiro treino executado" não é.
