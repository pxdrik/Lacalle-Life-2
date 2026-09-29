# LACALLE LIFE — IMPLEMENTAÇÃO DA VISÃO ADM (PROFISSIONAL)

> Especificação registrada em 28/09/2026. Ainda não iniciada: a Etapa 1
> (auditoria) vem antes de qualquer código. Entrada correspondente em
> `docs/roadmap.md`, item 6 da seção "Roadmap".

## 1. CONTEXTO DO PROJETO

Estamos desenvolvendo o LaCalle Life, um aplicativo de saúde e evolução física que reúne:

* Dieta e acompanhamento nutricional.
* Diário alimentar.
* Treinos e registro de exercícios.
* Evolução física.
* Metas e acompanhamento de resultados.

O projeto utiliza React, TypeScript, Supabase e uma arquitetura de aplicação já existente.

O aplicativo atual foi desenvolvido principalmente para o usuário final (B2C), que pode gerenciar sua própria alimentação, seus treinos e sua evolução.

Agora queremos expandir o produto para um modelo híbrido:

**B2C:** o usuário utiliza o aplicativo de forma independente.

**B2B:** nutricionistas e treinadores utilizam uma área profissional para gerenciar pacientes, montar dietas e prescrever treinos.

**B2B2C:** o profissional prescreve os planos, enquanto o paciente utiliza o aplicativo para executar e acompanhar o que foi prescrito.

A proposta é manter o mesmo ecossistema, com experiências diferentes para cada perfil.

---

# 2. OBJETIVO DESTA IMPLEMENTAÇÃO

Nesta primeira etapa, quero implementar a **VISÃO ADM**, que será a interface profissional do LaCalle Life.

Essa área será utilizada inicialmente por nutricionistas e, futuramente, por treinadores.

O profissional deverá conseguir:

1. Acessar um painel próprio.
2. Cadastrar e gerenciar pacientes.
3. Criar e editar planos alimentares.
4. Associar planos aos pacientes.
5. Visualizar o diário alimentar dos pacientes.
6. Acompanhar informações de evolução física autorizadas.
7. Preparar a estrutura para adicionar fichas de treino em uma próxima etapa.

O objetivo é construir uma primeira versão funcional da área profissional, sem tentar desenvolver todas as funcionalidades futuras de uma vez.

**IMPORTANTE: não transforme o aplicativo inteiro em um sistema exclusivo para profissionais. O B2C deve continuar funcionando normalmente.**

---

# 3. PRIMEIRA ETAPA: AUDITORIA OBRIGATÓRIA

Antes de alterar qualquer arquivo, faça uma auditoria da arquitetura atual.

Analise principalmente:

* Estrutura de pastas e componentes.
* Rotas e navegação.
* Sistema de autenticação.
* Estrutura atual do Supabase.
* Tabelas, relacionamentos e políticas RLS.
* Modelo atual de armazenamento dos dados dos usuários.
* Estrutura de dietas, refeições e alimentos.
* Diário alimentar e registros de consumo.
* Sistema de treinos e exercícios.
* Evolução física e histórico.
* Componentes visuais reutilizáveis.
* Sistema de design e identidade visual.
* Testes existentes.
* Funcionalidades que dependem diretamente do usuário autenticado.

O aplicativo possui dados associados ao usuário autenticado e utiliza estruturas JSONB em algumas áreas.

Verifique cuidadosamente se essa arquitetura pode suportar o compartilhamento controlado de dados entre profissionais e pacientes.

Não presuma que o modelo atual já permite isso.

### Ao finalizar a auditoria, apresente:

1. Como o aplicativo funciona atualmente.
2. Quais componentes podem ser reutilizados.
3. Quais estruturas precisam ser modificadas.
4. Quais tabelas novas seriam necessárias.
5. Quais riscos existem para os dados dos usuários atuais.
6. Como implementar a visão profissional sem quebrar o B2C.
7. Um plano de execução dividido em etapas pequenas e verificáveis.

Não faça uma migração estrutural ampla antes de entender as consequências para os usuários existentes.

---

# 4. ARQUITETURA DE PRODUTO

O LaCalle Life deverá suportar três situações:

### A. Usuário independente

O usuário utiliza o aplicativo normalmente.

Ele pode criar suas próprias dietas, organizar seus treinos, registrar refeições e acompanhar sua evolução.

Esse comportamento deve continuar funcionando como atualmente.

### B. Usuário acompanhado

O usuário possui uma conta pessoal e está vinculado a um ou mais profissionais.

Ele recebe planos prescritos e pode registrar suas atividades normalmente.

O paciente continua sendo o proprietário de seus dados pessoais.

### C. Profissional

O profissional possui acesso a uma área administrativa própria.

Ele pode gerenciar pacientes e criar planos dentro das permissões concedidas.

O sistema deverá permitir futuramente que um mesmo usuário tenha um nutricionista e um treinador diferentes.

Não implemente uma arquitetura que obrigue o paciente a criar uma conta separada para cada profissional.

---

# 5. NOVA ÁREA: LACALLE LIFE PRO

Crie uma área profissional com identidade visual consistente com o LaCalle Life.

O painel deve funcionar bem em desktop e tablet, com uma experiência responsiva.

Não quero uma interface genérica de dashboard administrativo.

Quero que o painel pareça uma extensão natural do produto, preservando a identidade visual existente.

Respeite o design system atual, incluindo:

* Tipografia.
* Cores.
* Espaçamentos.
* Componentes.
* Bordas.
* Contrastes.
* Padrões de interação.
* Estilo minimalista.

Evite adicionar bibliotecas visuais desnecessárias.

Não introduza uma nova identidade visual sem necessidade.

## Navegação principal

Estruture a área profissional com as seguintes seções:

1. Visão geral.
2. Pacientes.
3. Dietas.
4. Biblioteca.
5. Evolução.
6. Configurações.

A estrutura deve permitir adicionar futuramente uma seção de treinos e uma área específica para treinadores.

Não implemente funcionalidades fictícias apenas para preencher o menu.

Se uma seção ainda não estiver funcional, mantenha-a fora da navegação principal ou sinalize claramente que está em desenvolvimento.

---

# 6. VISÃO GERAL DO PROFISSIONAL

Crie uma página inicial que apresente um resumo da atividade profissional.

Ela deve incluir:

### Indicadores

* Total de pacientes ativos.
* Pacientes que registraram atividades recentemente.
* Planos alimentares ativos.
* Pacientes que precisam de revisão, caso exista uma regra real para identificar essa situação.

### Lista de pacientes recentes

Apresente informações como:

* Nome do paciente.
* Situação do acompanhamento.
* Última atividade registrada.
* Plano alimentar ativo.

### Atividades recentes

Exemplos:

* Paciente registrou refeições.
* Plano alimentar foi atualizado.
* Paciente registrou uma nova avaliação física.

Todos os indicadores devem utilizar dados reais.

Não invente números, pacientes, atividades ou métricas.

Se ainda não houver dados, apresente um estado vazio bem desenvolvido, explicando como começar.

---

# 7. GESTÃO DE PACIENTES

Esta é uma das funcionalidades centrais do MVP.

Crie uma área para o profissional visualizar e gerenciar seus pacientes.

## Lista de pacientes

Cada paciente deverá apresentar:

* Nome.
* Identificação da situação do vínculo.
* Plano alimentar atual.
* Data da última atividade, quando disponível.

Adicione busca e filtros apenas quando forem úteis e viáveis.

## Cadastro de paciente

O profissional deverá conseguir iniciar o vínculo com um paciente.

Fluxo desejado:

1. O profissional clica em "Adicionar paciente".
2. Informa os dados necessários para enviar um convite.
3. O sistema cria um convite seguro.
4. O paciente recebe o convite.
5. O paciente aceita o vínculo.
6. O paciente passa a aparecer na lista de pacientes ativos.

O profissional não deve criar uma senha para o paciente nem ter acesso às credenciais dele.

Se a infraestrutura atual não permitir o envio de convites de forma segura, implemente o fluxo de convite apenas até o ponto suportado pela arquitetura e documente o que falta.

Não simule um vínculo real usando apenas dados locais.

## Perfil do paciente

Ao clicar em um paciente, o profissional deverá acessar uma página individual com:

* Informações básicas autorizadas.
* Situação do vínculo.
* Plano alimentar atual.
* Histórico de planos.
* Diário alimentar.
* Evolução física autorizada.
* Histórico de alterações relevantes.

Organize a página em seções ou abas, mantendo a interface clara.

Não exponha informações pessoais que não sejam necessárias para o acompanhamento.

---

# 8. CRIAÇÃO E EDIÇÃO DE DIETAS

Essa é a principal funcionalidade de prescrição desta primeira etapa.

O nutricionista deverá conseguir criar uma dieta para um paciente usando a estrutura de alimentação já existente no LaCalle Life.

## Fluxo de criação

1. O profissional acessa a página de um paciente.
2. Clica em "Criar plano alimentar".
3. Define o nome do plano.
4. Adiciona refeições.
5. Adiciona alimentos utilizando a base existente.
6. Define as quantidades.
7. Visualiza calorias e macronutrientes.
8. Salva como rascunho.
9. Revisa o plano.
10. Publica o plano para o paciente.

## Requisitos

Reutilize os componentes existentes de alimentação sempre que possível.

Não crie uma segunda base de alimentos.

Não duplique desnecessariamente a lógica de cálculo nutricional.

O profissional deve conseguir:

* Adicionar e remover refeições.
* Adicionar e remover alimentos.
* Alterar quantidades.
* Visualizar os totais nutricionais.
* Salvar alterações.
* Editar um plano existente.
* Publicar uma nova versão.

Se a estrutura atual permitir, preserve o histórico de versões dos planos.

Não sobrescreva silenciosamente um plano que já foi publicado.

## Relação com o aplicativo do paciente

Quando o profissional publicar a dieta, ela deverá ficar disponível na conta do paciente.

O paciente deverá conseguir visualizar:

* Refeições.
* Alimentos.
* Quantidades.
* Calorias e macronutrientes disponíveis.
* Orientações do profissional, se houver.

A dieta prescrita deve ser identificada claramente como um plano profissional.

O usuário deve continuar conseguindo registrar refeições fora do plano.

Não misture automaticamente o plano prescrito com o histórico de consumo.

**IMPORTANTE:** antes de implementar esse fluxo, verifique como a dieta é armazenada atualmente e proponha uma solução que preserve os dados pessoais existentes.

---

# 9. ACOMPANHAMENTO DO DIÁRIO ALIMENTAR

O profissional deverá conseguir visualizar o diário alimentar dos pacientes vinculados.

Reutilize a estrutura atual do Diário.

O painel deve permitir consultar:

* Data do registro.
* Refeições registradas.
* Alimentos consumidos.
* Quantidades informadas.
* Calorias e macronutrientes calculados, quando disponíveis.
* Refeições planejadas que foram marcadas como concluídas.

Não apresente dados não registrados como se fossem informações confirmadas.

Diferencie claramente:

* Refeições planejadas.
* Refeições registradas.
* Refeições concluídas.
* Refeições sem registro.

Se o sistema calcular indicadores de adesão, documente a fórmula e deixe claro que eles representam os registros do paciente, não uma confirmação independente do consumo real.

O profissional não deve conseguir modificar silenciosamente o diário pessoal do paciente.

---

# 10. EVOLUÇÃO FÍSICA

Crie uma seção para o profissional consultar os dados de evolução física autorizados pelo paciente.

Reutilize os componentes e a lógica de evolução existentes.

Considere apresentar:

* Histórico de peso.
* Medidas corporais disponíveis.
* Registros de evolução.
* Gráficos existentes, se forem compatíveis.
* Histórico de avaliações.

Não crie métricas sem fundamento.

Não altere os cálculos atuais sem necessidade.

O profissional deve visualizar apenas os dados aos quais recebeu autorização.

---

# 11. BIBLIOTECA DE PLANOS

Prepare uma estrutura para o profissional reutilizar modelos de planos alimentares.

A biblioteca poderá permitir:

* Criar modelos de dieta.
* Visualizar modelos existentes.
* Duplicar um modelo para iniciar uma nova prescrição.
* Organizar modelos pessoais.

Não implemente compartilhamento público de modelos nesta etapa.

Os modelos devem ser independentes das dietas efetivamente prescritas aos pacientes.

Alterar um modelo não pode modificar automaticamente planos já publicados.

Se a estrutura atual não permitir isso com segurança, apresente a proposta de arquitetura antes de implementar.

---

# 12. AUTENTICAÇÃO E PERMISSÕES

Essa parte é crítica.

O sistema deverá distinguir os perfis de usuário:

* Usuário independente.
* Profissional.
* Usuário acompanhado.

Não presuma que esconder um botão na interface seja suficiente para proteger os dados.

As permissões devem ser aplicadas no backend e no Supabase, utilizando políticas RLS adequadas.

## Requisitos de segurança

1. Um profissional só pode acessar pacientes com vínculo ativo e autorização correspondente.
2. Um profissional não pode acessar dados de pacientes de outros profissionais.
3. Um paciente não pode acessar informações administrativas de outros usuários.
4. O paciente continua sendo o proprietário dos próprios dados pessoais.
5. O profissional só pode modificar os planos que está autorizado a administrar.
6. O encerramento do vínculo deve revogar o acesso do profissional aos dados protegidos.
7. O sistema deve impedir que um usuário altere seu próprio perfil para obter permissões profissionais.
8. Operações privilegiadas devem ocorrer exclusivamente em ambientes seguros.
9. Não exponha chaves administrativas do Supabase no cliente.
10. Não utilize verificações exclusivamente no frontend como mecanismo de autorização.

Considere o uso de tabelas de relacionamento entre profissionais e pacientes.

Antes de implementar, analise a compatibilidade com a estrutura atual e proponha a migração mais segura.

---

# 13. MODELO DE DADOS

Não crie tabelas ou relacionamentos sem analisar primeiro o banco atual.

Avalie a necessidade de estruturas para:

* Perfil profissional.
* Vínculos entre profissionais e pacientes.
* Convites.
* Planos alimentares prescritos.
* Histórico de versões.
* Biblioteca de modelos.

O modelo deve permitir que:

* Um profissional acompanhe vários pacientes.
* Um paciente tenha mais de um profissional.
* Um paciente mantenha seus dados pessoais.
* Um plano seja associado a um profissional e a um paciente.
* O histórico seja preservado quando necessário.
* O encerramento de um vínculo não apague automaticamente os dados pessoais do paciente.

Se a arquitetura atual utiliza JSONB, avalie cuidadosamente se é possível manter essa abordagem em algumas áreas e introduzir tabelas relacionais apenas onde forem necessárias.

Não faça uma migração geral de JSONB para tabelas relacionais sem justificativa técnica.

---

# 14. PRESERVAÇÃO DO B2C

Esta é uma exigência fundamental.

O aplicativo atual deve continuar funcionando normalmente para quem utiliza o LaCalle Life de forma independente.

Não remova funcionalidades existentes.

Não altere a experiência do usuário independente sem necessidade.

Não obrigue usuários atuais a se vincularem a um profissional.

Não exija que o usuário tenha um plano profissional ativo para acessar as funcionalidades atuais.

Não modifique a lógica de metas, dieta, diário, treino ou evolução sem antes identificar as dependências.

Se uma funcionalidade precisar ser adaptada para suportar os dois modelos, faça isso de maneira compatível com os dados existentes.

---

# 15. IDENTIDADE VISUAL E EXPERIÊNCIA

Preserve a identidade visual do LaCalle Life.

Utilize os componentes e padrões já existentes.

A área profissional deve ser visualmente consistente com o aplicativo atual, mas otimizada para o trabalho do nutricionista.

Priorize:

* Hierarquia visual clara.
* Navegação simples.
* Tabelas e listas bem organizadas.
* Formulários objetivos.
* Estados vazios bem desenhados.
* Feedback claro após salvar ou publicar.
* Responsividade.
* Acessibilidade.
* Desempenho.

Evite:

* Dashboards genéricos.
* Gráficos sem utilidade.
* Cards excessivos.
* Elementos decorativos desnecessários.
* Duplicação de componentes.
* Novas dependências sem justificativa.

---

# 16. ESCOPO DESTA PRIMEIRA VERSÃO

### Implementar

* Área profissional.
* Navegação administrativa.
* Visão geral.
* Gestão de pacientes.
* Estrutura de convites.
* Criação e edição de dietas.
* Publicação de planos.
* Visualização do diário alimentar.
* Visualização de evolução física autorizada.
* Estrutura inicial de biblioteca.
* Controle de acesso e permissões.
* Integração com o aplicativo atual.

### Não implementar agora

* Sistema completo de treinadores.
* Cobrança recorrente.
* Marketplace de profissionais.
* Chat em tempo real.
* Inteligência artificial para prescrição.
* Personalização de marca para clínicas.
* Aplicativo separado para profissionais.
* Funcionalidades que não sejam necessárias para validar o fluxo principal.

Não implemente funcionalidades adicionais apenas porque parecem interessantes.

---

# 17. TESTES E VALIDAÇÃO

O projeto já possui uma estrutura de testes.

Analise os testes existentes e amplie a cobertura de acordo com a arquitetura atual.

Não substitua testes existentes sem justificativa.

Crie testes para os seguintes cenários:

### B2C

* Usuário independente continua acessando suas funcionalidades.
* Dietas e registros existentes continuam preservados.
* Nenhum usuário perde acesso aos próprios dados.

### Profissional

* Profissional consegue acessar o painel.
* Profissional consegue criar um paciente por meio do fluxo autorizado.
* Profissional consegue criar e publicar uma dieta.
* Profissional consegue consultar o diário alimentar de um paciente vinculado.
* Profissional consegue visualizar os dados de evolução autorizados.

### Segurança

* Profissional não consegue acessar paciente sem vínculo.
* Profissional não consegue acessar dados de outro profissional.
* Usuário não consegue obter privilégios profissionais alterando dados no cliente.
* Paciente não consegue acessar dados de terceiros.
* Encerramento do vínculo revoga o acesso.
* RLS impede acessos indevidos.

### Integração

* Dieta publicada aparece corretamente no aplicativo do paciente.
* Alterações de planos não apagam registros alimentares.
* Histórico de consumo permanece separado do planejamento.
* Dados existentes continuam funcionando.

Execute os testes relevantes e apresente os resultados reais.

Não afirme que uma funcionalidade está validada se ela não foi testada.

---

# 18. MÉTODO DE EXECUÇÃO

Quero que você trabalhe em etapas pequenas, com foco em segurança e preservação do produto atual.

### Etapa 1: Auditoria

Analise a arquitetura e apresente o diagnóstico.

### Etapa 2: Planejamento técnico

Proponha:

* Estrutura de rotas.
* Componentes reutilizáveis.
* Modelo de dados.
* Estratégia de autenticação.
* Políticas RLS.
* Fluxo de convites.
* Estratégia de publicação de dietas.
* Plano de testes.

### Etapa 3: Implementação estrutural

Implemente a base da área profissional e as alterações necessárias no banco.

### Etapa 4: Implementação funcional

Implemente gestão de pacientes, criação de dietas e acompanhamento.

### Etapa 5: Integração

Conecte a área profissional ao aplicativo do paciente.

### Etapa 6: Validação

Execute testes, revise permissões e corrija regressões.

Não avance para uma etapa estruturalmente arriscada sem verificar os impactos sobre os dados existentes.

Se houver uma decisão de arquitetura que possa comprometer a segurança ou a integridade dos dados, interrompa e apresente as alternativas.

---

# 19. RELATÓRIO FINAL

Ao concluir, apresente um relatório contendo:

1. Funcionalidades implementadas.
2. Arquivos criados e modificados.
3. Alterações realizadas no Supabase.
4. Novas tabelas e políticas RLS.
5. Fluxos que estão funcionando.
6. Testes executados e resultados.
7. Problemas encontrados.
8. Limitações atuais.
9. Funcionalidades que ainda dependem de configuração externa.
10. Próximas etapas recomendadas.

Diferencie claramente o que foi implementado, o que foi testado e o que ainda está pendente.

---

# DIRETRIZ FINAL

O objetivo é transformar o LaCalle Life em uma plataforma integrada para usuários independentes e profissionais.

A visão ADM é o primeiro passo dessa expansão.

**Priorize uma arquitetura segura, reutilização do código existente, preservação do B2C e uma experiência profissional realmente funcional.**

Não quero uma implementação superficial, com dados fictícios ou funcionalidades que só funcionem visualmente.

Quero uma base técnica sólida, que permita evoluir o produto para um SaaS sem precisar reconstruir toda a aplicação posteriormente.
