import type { Metadata } from "next";
import { LogIn } from "lucide-react";

import { PageHeader } from "@/design-system/components/page-header";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Entrar · LaCalle Life",
};

export default function LoginPage() {
  return (
    <>
      <PageHeader icon={LogIn} title="Entrar" />
      <div className="mt-8">
        <LoginForm />
      </div>
    </>
  );
}
