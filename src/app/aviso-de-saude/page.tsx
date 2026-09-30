import type { Metadata } from "next";

import { LegalDocument, type LegalSection } from "../_components/legal/legal-document";

export const metadata: Metadata = {
  title: "Aviso de Saúde · LaCalle Life",
  description: "O LaCalle Life organiza a sua rotina; não substitui profissionais de saúde.",
};

const SECTIONS: readonly LegalSection[] = [
  {
    heading: "1. Para que serve o aplicativo",
    body: [
      "O LaCalle Life é uma ferramenta de organização e acompanhamento pessoal de alimentação, treino e evolução física. Ele não substitui atendimento, diagnóstico ou acompanhamento de profissionais habilitados.",
    ],
  },
  {
    heading: "2. Cálculos e metas",
    body: [
      "Calorias, macronutrientes, água, metas e estimativas são calculados por fórmulas gerais e podem não corresponder às suas necessidades individuais. Não são prescrição nutricional nem médica.",
    ],
  },
  {
    heading: "3. Treino e exercício",
    body: [
      "Os registros de exercícios, cargas, repetições, percepção de esforço, descanso e evolução servem para acompanhar a rotina. O aplicativo não faz avaliação física individual e não substitui a orientação de um profissional de educação física ou fisioterapeuta.",
    ],
  },
  {
    heading: "4. O seu contexto",
    body: [
      "Considere o seu histórico, as suas limitações e as orientações que você já recebe. Em caso de dúvida sobre alimentação, exercício, sintomas, lesões, medicamentos ou condições de saúde, procure um profissional habilitado.",
    ],
  },
  {
    heading: "5. Não é serviço de emergência",
    body: [
      "O LaCalle Life não deve ser usado para decisões urgentes. Em uma emergência, ligue para o SAMU (192) ou procure atendimento médico.",
    ],
  },
];

export default function HealthNoticePage() {
  return (
    <LegalDocument
      title="Aviso de Saúde"
      intro="O LaCalle Life organiza a sua rotina de alimentação e treino. Ele não substitui profissionais de saúde."
      sections={SECTIONS}
    />
  );
}
