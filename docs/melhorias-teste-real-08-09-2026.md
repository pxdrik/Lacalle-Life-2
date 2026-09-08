# Melhorias encontradas em teste manual real — 08/09/2026

Pedido do Pedro, ainda **não implementado**. Registrado aqui na íntegra para
não depender da memória de nenhuma conversa — a versão resumida em
`docs/roadmap.md` aponta para este arquivo.

Regra geral do pedido: investigar a arquitetura atual antes de qualquer
mudança, não fazer refatoração desnecessária, não quebrar o que já funciona,
migrar dado existente com segurança, e não transformar isto numa reescrita —
"melhorias cirúrgicas". Se um problema arquitetural real impedir uma
implementação correta, parar e explicar antes de improvisar.

---

## 1. Criar alimento diretamente dentro da dieta

Hoje, adicionar um alimento inexistente à dieta exige sair do fluxo, ir para
Alimentos, criar lá, voltar e procurar de novo. Quer uma ação **"+ Criar
alimento"** dentro do próprio fluxo de adicionar alimento à refeição, que
abre o mesmo formulário/serviço de criação já usado em Alimentos (sem
duplicar lógica), salva, volta para a dieta e deixa o alimento novo já
selecionável — se fizer sentido, já selecionado na refeição em andamento.

## 2. Corrigir a mensagem de calorias e fibras

A mensagem atual ao informar macros (algo como "daria aproximadamente 34
calorias, mas a fibra derruba esse número") é confusa e deve ser removida —
substituída por uma estimativa clara. Mas não é só texto: **investigar se o
cálculo em si está correto**, conferindo carboidratos, proteínas, gorduras,
fibra, álcool (se existir no modelo) e os fatores energéticos usados,
coerente com o resto do motor nutricional (`core/nutrition`).

## 3. Trocar/editar exercício diretamente no slot

Hoje, substituir um exercício exige apagar e adicionar outro. Quer uma ação
**"Editar/Trocar exercício"** em cada slot, que abre o seletor, substitui o
exercício no slot e preserva a configuração do slot que não depende do
exercício em si (quando fizer sentido). Antes de implementar: mapear com
precisão o que pertence ao exercício, ao slot, à série e à configuração do
treino — não sobrescrever o que deveria persistir.

## 4. Feedback visual ao adicionar exercício

Hoje o exercício só aparece na lista, sem confirmação. Quer um feedback
pequeno e discreto (animação curta, highlight temporário, check, entrada
animada do card) — só para comunicar "foi adicionado", seguindo o princípio
de motion do LaCalle (existe para feedback/compreensão, não para
demonstração). Ver `docs/roadmap.md` → pesquisa de Motion System v1 para o
vocabulário de duração/curva já adotado.

## 5. Corrigir confusão entre placeholder e valor real nas unidades

O número da porção (ex.: "1 fatia", "50 g") aparece em cinza, o que faz
parecer placeholder mesmo sendo valor real. Precisa de hierarquia visual que
deixe claro se é placeholder, valor padrão ou valor preenchido — e se for
valor padrão editável, digitar deve substituir naturalmente o valor anterior
(sem exigir apagar manualmente). Resolver semântica + interação + hierarquia
visual, não só trocar a cor para branco.

## 6. Investigar duplicidade de alimentos

Achado real: dois registros de "Queijo Mussarela". Investigar a causa antes
de qualquer exclusão — são alimentos diferentes (marca/fonte diferente) ou
duplicata de verdade? Como os IDs são definidos? Existem outros casos
parecidos na base (581 alimentos: 216 curados da V1 + 365 da TACO)? Se houver
duplicata real, propor deduplicação seguindo referências existentes em
dietas/refeições/histórico — nunca apagar direto.

## 7. Evoluir o sistema de porções/unidades

A mudança mais importante do pedido. Gramas continuam sendo a referência
nutricional-base; a unidade (1 pão ≈ 50g, 2 fatias ≈ 50g, 1 ovo ≈ 50g) é uma
camada de usabilidade por cima, nunca uma unidade nutricional independente.
Importante: um alimento não tem peso fixo por unidade (um pão francês pode
pesar 40g, 50g ou 60g) — a unidade representa uma **porção de referência**,
não uma afirmação de peso exato da categoria. Investigar como o modelo atual
(`core/nutrition`, catálogo de alimentos) pode representar isso sem quebrar
compatibilidade com os 581 alimentos existentes.

## 8. Melhorar a experiência de busca de alimentos

Referência de UX (não visual) é o app "Macros": cada item da lista mostra
nome, marca/fonte + porção, calorias, e carboidrato/proteína/gordura numa
hierarquia clara — ex. "Pão Francês · Generic, 60g (1 pão) · 171 kcal ·
C:34.4 P:5.6 F:1.2". Adaptar a **clareza da estrutura de informação**, não a
identidade visual — tipografia, espaçamento, cor e componente continuam do
Brandbook/design system do LaCalle Life.

## 9. Pesquisar o fluxo atual antes de mudar a UI

Pré-requisito dos itens acima, não uma entrega própria: mapear o modelo de
`Food` (fonte, marca, porção, unidade, gramas, macros, calorias, IDs,
persistência, busca, personalizados vs. biblioteca), como a dieta referencia
o alimento (quantidade, unidade, o que acontece se o alimento for editado
depois) e a estrutura de `Workout` (slots, exercícios, séries, substituição,
persistência).

## 10. UX e motion

As mudanças acima devem seguir o mesmo princípio já registrado na pesquisa
de Motion System v1 (ver `docs/roadmap.md` e `docs/brandbook.md`): clareza,
velocidade, previsibilidade, feedback, consistência, acessibilidade,
estética — nessa ordem de prioridade, principalmente no mobile, sem atrasar
a interação durante treino/refeição, respeitando touch target e uso com uma
mão.

## 11. Não quebrar o que já funciona

Antes de concluir: `typecheck`, `lint`, testes, `build`, com atenção especial
aos testes de alimentos, dietas e treinos. Onde a cobertura for insuficiente
para um comportamento crítico (criação de alimento dentro da dieta, cálculo
de calorias, conversão unidade↔grama, substituição de exercício,
persistência, deduplicação, edição de alimento existente), adicionar teste
novo.

## 12. Teste manual — fluxos a validar

- **A** — Criar dieta → adicionar alimento inexistente → criar alimento →
  voltar para a dieta → adicionar o alimento.
- **B** — Criar alimento → informar macros → conferir calorias calculadas.
- **C** — Criar treino → adicionar exercício → conferir feedback visual.
- **D** — Criar treino → adicionar exercício → trocar exercício direto pelo
  slot.
- **E** — Criar dieta → adicionar pão francês → conferir grama + unidade.
- **F** — Criar dieta → adicionar pão de forma → conferir fatias + gramas.
- **G** — Buscar alimentos → conferir clareza de nome, marca, porção, kcal e
  macros.
- **H** — Criar/editar alimento personalizado → conferir se aparece
  corretamente na busca.

## 13. Critério de aceitação, quando implementado

Relatório final deve trazer: o que foi implementado, decisões de arquitetura
(unidade/porção, gramas, calorias, alimentos personalizados, troca de
exercício), testes executados (quantidade passando, typecheck, lint, build)
e riscos conhecidos — comportamento que não foi alterado por risco de
regressão, com o motivo.
