"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Notice } from "@/design-system/components/notice";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";

export function ForgotPasswordForm() {
  const repository = useAuthRepository();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await repository.resetPasswordForEmail(email);
      // Sempre mostra sucesso, exista ou não a conta — nunca revela se um
      // e-mail está cadastrado.
      setSent(true);
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <Notice tone="success" title="Verifique seu e-mail">
        Se houver uma conta com {email}, enviamos um link para redefinir a
        senha.
      </Notice>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {error !== null && <Notice>{error}</Notice>}

      <Field label="E-mail" id="forgot-password-email">
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

      <p className="text-sm text-ink-subtle">
        <Link href="/entrar" className="text-ink hover:underline">
          Voltar para o login
        </Link>
      </p>

      <Button type="submit" pending={pending} className="w-full">
        Enviar link de redefinição
      </Button>
    </form>
  );
}
