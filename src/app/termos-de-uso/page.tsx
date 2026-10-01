import type { Metadata } from "next";
import Link from "next/link";

import { ContactLine, LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata: Metadata = {
  title: "Termos de Uso · LaCalle Life",
  description: "As condições para usar o LaCalle Life.",
};

const SECTIONS: readonly LegalSection[] = [
  {
    heading: "1. Sobre estes Termos",
    body: [
      "Estes Termos de Uso estabelecem as condições para usar o LaCalle Life, aplicativo de organização e acompanhamento de alimentação, treino e evolução física. Ao criar uma conta ou usar o aplicativo, você declara que leu e compreendeu estes Termos.",
    ],
  },
  {
    heading: "2. Quem oferece o serviço",
    body: [
      "O LaCalle Life é desenvolvido e disponibilizado por Pedro Macedo Funes, pessoa física, responsável pelo projeto nesta versão. O projeto ainda não tem pessoa jurídica nem CNPJ próprio. Se isso mudar, estes Termos serão atualizados.",
    ],
  },
  {
    heading: "3. O que o aplicativo faz",
    body: [
      "O aplicativo oferece ferramentas para montar dietas e registrar alimentação, calorias, macronutrientes, água, treinos, cargas, repetições, percepção de esforço, peso, medidas e outros indicadores de evolução. A finalidade é organizar e acompanhar a sua rotina.",
    ],
  },
  {
    heading: "4. Não substitui profissionais",
    body: [
      <>
        O LaCalle Life não substitui médico, nutricionista, profissional de educação física,
        fisioterapeuta ou outro profissional habilitado. Cálculos, metas e indicadores não são
        diagnóstico, prescrição, tratamento nem avaliação profissional. Leia também o{" "}
        <Link href="/aviso-de-saude" className="text-ink underline underline-offset-4">
          Aviso de Saúde
        </Link>
        .
      </>,
    ],
  },
  {
    heading: "5. Uso com e sem conta",
    body: [
      "O aplicativo pode ser usado sem conta. Nesse caso, os seus registros ficam só no navegador ou aparelho em que foram feitos.",
      "Com uma conta, os registros também são sincronizados com o servidor, para aparecerem nos seus outros aparelhos. Você deve informar um e-mail verdadeiro, cuidar da sua senha e avisar se suspeitar de acesso indevido. O acesso pode ser limitado ou suspenso em caso de abuso, fraude, tentativa de comprometer a segurança ou violação destes Termos.",
    ],
  },
  {
    heading: "6. Os seus registros",
    body: [
      <>
        Você é responsável pelas informações que registra. Dados de alimentação, exercício, peso,
        medidas e evolução podem revelar informações sobre a sua saúde e recebem proteção especial
        pela lei. Como eles são tratados está na{" "}
        <Link href="/politica-de-privacidade" className="text-ink underline underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </>,
    ],
  },
  {
    heading: "7. Armazenamento no aparelho e backup",
    body: [
      "O aplicativo guarda dados no próprio aparelho (IndexedDB e cache do navegador) para funcionar mesmo com conexão ruim. Limpar os dados do navegador, desinstalar o aplicativo ou usar a opção \"Esquecer este dispositivo\" apaga o que estiver guardado só nesse aparelho. O aplicativo oferece exportação de backup no Perfil, e recomendamos usá-la.",
    ],
  },
  {
    heading: "8. Mudanças e disponibilidade",
    body: [
      "O aplicativo pode receber atualizações, correções, mudanças de tela, recursos novos ou a retirada de recursos. Pode haver interrupções para manutenção, segurança ou outros motivos técnicos.",
    ],
  },
  {
    heading: "9. Propriedade intelectual",
    body: [
      "Nome, identidade visual, código, telas, textos e demais elementos próprios do LaCalle Life pertencem ao seu titular ou são usados com autorização. Usar o aplicativo não transfere nenhum desses direitos a você. As fotos de exercícios de terceiros são usadas sob as licenças indicadas junto delas.",
    ],
  },
  {
    heading: "10. Uso proibido",
    body: [
      "Não é permitido usar o serviço para atividades ilegais, tentar acesso não autorizado, explorar falhas de segurança, interferir no funcionamento do aplicativo ou prejudicar outras pessoas.",
    ],
  },
  {
    heading: "11. Serviços de terceiros",
    body: [
      "Alguns recursos dependem de fornecedores de autenticação, banco de dados, hospedagem e segurança. Eles estão listados na Política de Privacidade.",
    ],
  },
  {
    heading: "12. Life Pro, a área para profissionais",
    body: [
      "Treinadores, com registro no CREF ou no CRN, podem pedir acesso ao Life Pro, com a mesma conta, para montar planos alimentares e treinos e acompanhar pacientes. O acesso só é liberado depois que a administração do LaCalle Life confere cada registro no conselho, e pode ser recusado ou suspenso, por exemplo se o registro não for confirmado ou se houver uso indevido.",
      "Quem usa o Life Pro se compromete a informar dados profissionais verdadeiros, a usar os dados dos pacientes só para o acompanhamento que eles autorizaram, a respeitar o sigilo e as normas do seu conselho profissional e a responder pelos planos que prescreve. O LaCalle Life é a ferramenta: não presta atendimento de saúde, não confere o conteúdo dos planos e não faz parte da relação entre o profissional e o paciente.",
      <>
        O paciente decide se aceita o acompanhamento, o que libera e quando encerra. Como isso
        funciona com os dados está na{" "}
        <Link href="/politica-de-privacidade" className="text-ink underline underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </>,
    ],
  },
  {
    heading: "13. Recursos futuros",
    body: [
      "O LaCalle Life poderá oferecer no futuro recursos para outros profissionais, como treinadores, além de pagamentos, notificações ou outras integrações. Nada disso existe nesta versão. Quando existir, estes Termos e a Política de Privacidade serão atualizados antes.",
    ],
  },
  {
    heading: "14. Limitação de responsabilidade",
    body: [
      "Na medida permitida pela lei, o LaCalle Life não garante funcionamento sempre livre de falhas ou interrupções. Nada nestes Termos afasta direitos ou responsabilidades que a lei não permite afastar, incluindo os direitos do consumidor. O aplicativo não deve ser usado em situações de emergência nem no lugar de atendimento profissional.",
    ],
  },
  {
    heading: "15. Encerramento da conta",
    body: [
      "Nesta versão, o aplicativo ainda não tem um botão para excluir a conta. Você pode pedir o encerramento da conta e a exclusão dos dados pelo canal de contato abaixo. A exclusão segue a Política de Privacidade e as hipóteses em que a lei exige guardar algum dado.",
    ],
  },
  {
    heading: "16. Atualizações destes Termos",
    body: [
      "Estes Termos podem ser atualizados quando o aplicativo, a lei ou a forma de tratar os dados mudar. A versão vigente fica sempre nesta página, com a data da última atualização.",
    ],
  },
  {
    heading: "17. Contato",
    body: [<ContactLine key="contato" subject="dúvidas sobre estes Termos" />],
  },
  {
    heading: "18. Lei aplicável",
    body: [
      "Estes Termos seguem a lei brasileira, respeitados os direitos do consumidor e dos titulares de dados pessoais.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Termos de Uso"
      intro="As condições para usar o LaCalle Life, em linguagem direta."
      sections={SECTIONS}
    />
  );
}
