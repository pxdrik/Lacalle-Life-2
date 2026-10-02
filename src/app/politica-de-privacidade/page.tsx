import type { Metadata } from "next";

import { ContactLine, LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata: Metadata = {
  title: "Política de Privacidade · LaCalle Life",
  description: "Quais dados o LaCalle Life trata, para quê, onde ficam e quais são os seus direitos.",
};

const SECTIONS: readonly LegalSection[] = [
  {
    heading: "1. Objetivo",
    body: [
      "Esta Política explica quais dados o LaCalle Life trata, para quais finalidades, onde eles ficam, com quem podem ser compartilhados e quais são os seus direitos. Ela descreve o que o aplicativo faz hoje e será atualizada antes de qualquer recurso novo que mude isso.",
    ],
  },
  {
    heading: "2. Responsável",
    body: [
      "O responsável pelo tratamento é Pedro Macedo Funes, pessoa física, responsável pelo projeto. O projeto ainda não tem CNPJ próprio.",
    ],
  },
  {
    heading: "3. Dados tratados",
    body: [
      "Cadastro e acesso: e-mail e senha. A senha é processada pelo fornecedor de autenticação e não fica disponível ao responsável em forma legível.",
      "O que você registra: perfil (sexo, idade, altura, peso, nível de atividade, objetivo e, se informar, percentual de gordura e ritmo semanal), dietas e refeições, diário alimentar, água, alimentos e exercícios personalizados, rotinas, treinos com cargas, repetições e percepção de esforço, dias de descanso, peso, medidas e anotações de evolução.",
      "Dados técnicos: informações necessárias à segurança e ao funcionamento, como endereço IP e dados do navegador, tratados pelos fornecedores de hospedagem e de proteção contra robôs.",
      "Se você pede acesso ao Life Pro, a área para profissionais: profissão, nome profissional, conselho e número de registro, e a situação do pedido (em análise, aprovado, recusado ou suspenso).",
      "Se você acompanha ou é acompanhado pelo Life Pro: o vínculo (quem acompanha quem, desde quando e o que foi liberado) e os planos alimentares que o profissional publicou para o paciente, com as versões anteriores.",
    ],
  },
  {
    heading: "4. Dados de saúde",
    body: [
      "Informações de alimentação, peso, medidas, exercício e evolução podem revelar aspectos da sua saúde. A Lei Geral de Proteção de Dados (LGPD) trata dados de saúde como dados pessoais sensíveis, com proteção especial. O LaCalle Life usa esses dados só para as finalidades desta Política, e não os vende nem os usa para publicidade. Eles só chegam a um profissional quando você aceita o convite dele e escolhe o que liberar, como explica a seção 5. Nunca são compartilhados com empresas de saúde.",
    ],
  },
  {
    heading: "5. Compartilhamento com profissionais (Life Pro)",
    body: [
      "Um treinador que usa o Life Pro (profissional com registro no CREF ou no CRN) pode convidar você para acompanhamento, por um link, e montar o seu plano alimentar e o seu treino. Nada é compartilhado antes de você aceitar o convite com a sua conta. Ao aceitar, você escolhe o que o profissional pode ver: o diário alimentar, a evolução física (peso e medidas) e os dados do perfil (idade, altura e objetivo). Ele identifica você pelo nome que deu ao convite; o seu e-mail e os dados da sua conta não aparecem para ele. Treinos e senha não são compartilhados.",
      "Você pode mudar o que libera ou encerrar o acompanhamento quando quiser, no Perfil. Encerrar corta o acesso do profissional na hora e não apaga nada: os seus registros continuam seus, e o plano que ele publicou continua com você, só para leitura.",
      "O profissional vê só o que você liberou e só enquanto o vínculo está ativo. Essa regra fica no banco de dados, não só na tela. Esse compartilhamento acontece com o seu consentimento, que você dá ao aceitar o convite e pode retirar a qualquer momento.",
      "Os planos que o profissional publica ficam guardados na sua conta e no seu aparelho. O conteúdo do plano é responsabilidade do profissional que o prescreveu.",
      "Quem pede acesso como profissional informa o registro no conselho. A administração do LaCalle Life confere esse registro antes de liberar o acesso e vê os pedidos e os vínculos de cada profissional (quem acompanha quem), mas não o conteúdo do diário, da evolução nem dos planos. O paciente vê o nome e o registro do profissional que o acompanha.",
    ],
  },
  {
    heading: "6. Para que os dados são usados",
    body: [
      "Para criar e manter a conta, autenticar o acesso, mostrar e organizar os seus registros, calcular metas e evolução, sincronizar os dados entre os seus aparelhos, permitir o acompanhamento por um profissional quando você o autoriza, conferir o registro de quem pede acesso como profissional, manter a segurança, prevenir abuso e fraude, responder aos seus pedidos e cumprir obrigações legais.",
    ],
  },
  {
    heading: "7. Onde os dados ficam",
    body: [
      "Sem conta, os seus registros ficam só no navegador ou aparelho em que foram feitos, no armazenamento local (IndexedDB). Nada disso é enviado ao servidor.",
      "Com conta, os registros também são guardados no banco de dados do fornecedor de infraestrutura, em servidores na região de São Paulo, Brasil, para sincronizar entre os seus aparelhos. Cada conta só consegue ler os próprios dados e, no Life Pro, o que outra conta liberou para ela por um vínculo ativo.",
      "O aplicativo também guarda no aparelho as suas preferências (como tema e densidade da tela) e, com o service worker, uma cópia da interface para abrir sem conexão. Essa cópia não contém os seus registros.",
    ],
  },
  {
    heading: "8. Cookies e tecnologias semelhantes",
    body: [
      "O aplicativo usa cookies de sessão necessários para manter você conectado à sua conta. Não usa cookies de publicidade, pixels de rastreamento nem ferramentas de análise de uso (analytics). Por isso não há uma política de cookies separada.",
    ],
  },
  {
    heading: "9. Fornecedores",
    body: [
      "Supabase: autenticação e banco de dados, com os dados da conta em servidores na região de São Paulo, Brasil.",
      "Vercel: hospedagem do aplicativo. Ao acessar o site, dados técnicos da conexão, como o endereço IP, são processados por essa empresa, inclusive fora do Brasil.",
      "Cloudflare Turnstile: verificação contra robôs no cadastro e no acesso. Processa dados técnicos do navegador, inclusive fora do Brasil.",
      "Cada fornecedor recebe só o necessário para a sua função e trata os dados conforme os próprios contratos e políticas.",
    ],
  },
  {
    heading: "10. Recursos futuros",
    body: [
      "Se o LaCalle Life passar a usar análise de uso, publicidade, compartilhamento com outros profissionais além dos treinadores do Life Pro, ou qualquer tecnologia que mude o que está descrito aqui, esta Política será atualizada antes, dizendo quais dados, para quê, com quem e, quando for o caso, como dar ou retirar o consentimento.",
    ],
  },
  {
    heading: "11. Por quanto tempo",
    body: [
      "Os dados da conta ficam guardados enquanto a conta existir e forem necessários às finalidades desta Política, ou enquanto a lei exigir. Os dados guardados só no aparelho ficam até você apagá-los, por exemplo com \"Esquecer este dispositivo\" no Perfil ou limpando os dados do navegador.",
    ],
  },
  {
    heading: "12. Segurança",
    body: [
      "O acesso é protegido por senha e por regras no banco de dados que impedem uma conta de ler os dados de outra, e toda comunicação usa conexão criptografada. Nenhum sistema na internet nem aparelho é totalmente imune a incidentes; se houver um que possa causar risco relevante, você será avisado.",
    ],
  },
  {
    heading: "13. Os seus direitos",
    body: [
      "Pela LGPD, você pode pedir a confirmação de que os seus dados são tratados, acesso a eles, correção, informações sobre uso e compartilhamento, exclusão, e os demais direitos previstos em lei. Boa parte você já faz no próprio aplicativo: ver e corrigir os registros, exportar um backup no Perfil e apagar os dados do aparelho. Para a exclusão da conta e dos dados no servidor, use o canal de contato abaixo.",
    ],
  },
  {
    heading: "14. Atualizações",
    body: [
      "Esta Política pode mudar quando o aplicativo, os fornecedores, as finalidades ou a lei mudarem. A versão vigente fica sempre nesta página, com a data da última atualização.",
    ],
  },
  {
    heading: "15. Contato",
    body: [<ContactLine key="contato" subject="assuntos de privacidade e pedidos sobre os seus dados" />],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      intro="Quais dados o LaCalle Life trata, para quê, onde eles ficam e quais são os seus direitos."
      sections={SECTIONS}
    />
  );
}
