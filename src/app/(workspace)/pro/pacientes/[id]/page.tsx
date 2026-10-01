import { PatientPage } from "@/features/pro/components/pro/patient-page";

export default async function ProPatientPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientPage linkId={id} />;
}
