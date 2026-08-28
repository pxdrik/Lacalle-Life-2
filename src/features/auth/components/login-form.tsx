"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Notice } from "@/design-system/components/notice";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";

export function LoginForm() {
  const repository = useAuthRepository();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await repository.signInWithPassword(email, password);
      router.push("/hoje");
      router.refresh();
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {error !== null && <Notice>{error}</Notice>}

      <Field label="E-mail" id="login-email">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>

      <Field label="Senha" id="login-password">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <div className="flex items-center justify-between text-sm">
        <Link href="/cadastro" className="text-ink-subtle hover:text-ink">
          Criar conta
        </Link>
        <Link href="/recuperar-senha" className="text-ink-subtle hover:text-ink">
          Esqueci minha senha
        </Link>
      </div>

      <Button type="submit" pending={pending} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
