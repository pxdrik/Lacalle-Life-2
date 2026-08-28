"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Notice } from "@/design-system/components/notice";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";
import { hardNavigateTo } from "../data/hard-navigate";
import { TurnstileWidget } from "./turnstile-widget";
import { useTurnstile } from "../hooks/use-turnstile";

export function LoginForm() {
  const repository = useAuthRepository();
  const captcha = useTurnstile();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (captcha.siteKey !== undefined && captcha.token === "") {
      setError("Confirme que você não é um robô antes de continuar.");
      return;
    }

    setPending(true);

    try {
      await repository.signInWithPassword(
        email,
        password,
        captcha.token || undefined,
      );
      hardNavigateTo("/hoje");
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    } finally {
      captcha.reset();
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

      <TurnstileWidget captcha={captcha} />

      <Button
        type="submit"
        pending={pending}
        disabled={captcha.siteKey !== undefined && captcha.token === ""}
        className="w-full"
      >
        Entrar
      </Button>
    </form>
  );
}
