import type { Metadata } from "next";
import { KeyRound } from "lucide-react";

import { PageHeader } from "@/design-system/components/page-header";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar senha · LaCalle Life",
};

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader icon={KeyRound} title="Recuperar senha" />
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </>
  );
}
