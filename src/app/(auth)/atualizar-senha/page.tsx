import type { Metadata } from "next";
import { KeyRound } from "lucide-react";

import { PageHeader } from "@/design-system/components/page-header";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";

export const metadata: Metadata = {
  title: "Nova senha · LaCalle Life",
};

export default function UpdatePasswordPage() {
  return (
    <>
      <PageHeader icon={KeyRound} title="Nova senha" />
      <div className="mt-8">
        <UpdatePasswordForm />
      </div>
    </>
  );
}
