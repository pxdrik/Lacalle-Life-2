import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { PageHeader } from "@/design-system/components/page-header";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = {
  title: "Criar conta · LaCalle Life",
};

export default function SignupPage() {
  return (
    <>
      <PageHeader icon={UserPlus} title="Criar conta" />
      <div className="mt-8">
        <SignupForm />
      </div>
    </>
  );
}
