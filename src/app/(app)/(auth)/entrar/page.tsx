import type { Metadata } from "next";
import { LogIn } from "lucide-react";

import { safeNextPath } from "@/core/auth/safe-next-path";
import { PageHeader } from "@/design-system/components/page-header";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Entrar · LaCalle Life",
};

/**
 * `?next=`: volta para onde a pessoa estava (o convite do Life Pro). Só
 * caminho do próprio site, pela mesma regra do retorno do e-mail.
 */
export default async function LoginPage({ searchParams }: { readonly searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next ?? null);
  return (
    <>
      <PageHeader icon={LogIn} title="Entrar" />
      <div className="mt-8">
        <LoginForm next={target === "/" ? "/hoje" : target} />
      </div>
    </>
  );
}
