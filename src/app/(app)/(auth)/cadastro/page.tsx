import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { safeNextPath } from "@/core/auth/safe-next-path";
import { PageHeader } from "@/design-system/components/page-header";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = {
  title: "Criar conta · LaCalle Life",
};

/** `?next=`: como em `/entrar`. */
export default async function SignupPage({ searchParams }: { readonly searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next ?? null);
  return (
    <>
      <PageHeader icon={UserPlus} title="Criar conta" />
      <div className="mt-8">
        <SignupForm next={target === "/" ? "/hoje" : target} />
      </div>
    </>
  );
}
