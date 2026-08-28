"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Notice } from "@/design-system/components/notice";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";
import { TurnstileWidget } from "./turnstile-widget";
import { useTurnstile } from "../hooks/use-turnstile";

export function ForgotPasswordForm() {
  const repository = useAuthRepository();
  const captcha = useTurnstile();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (captcha.siteKey !== undefined && captcha.token === "") {
      setError("Confirme que você não é um robô antes de continuar.");
      return;
    }

    setPending(true);

    try {
      await repository.resetPasswordForEmail(email, captcha.token || undefined);
      // Sempre mostra sucesso, exista ou não a conta — nunca revela se um
      // e-mail está cadastrado.
      setSent(true);
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setPending(false);
      captcha.reset();
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

      <TurnstileWidget captcha={captcha} />

      <Button
        type="submit"
        pending={pending}
        disabled={captcha.siteKey !== undefined && captcha.token === ""}
        className="w-full"
      >
        Enviar link de redefinição
      </Button>
    </form>
  );
}
