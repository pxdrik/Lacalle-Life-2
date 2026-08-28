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

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm() {
  const repository = useAuthRepository();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    setPending(true);

    try {
      const { needsEmailConfirmation } = await repository.signUp(
        email,
        password,
      );

      if (needsEmailConfirmation) {
        setConfirmationSent(true);
        setPending(false);
        return;
      }

      hardNavigateTo("/hoje");
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    }
  }

  if (confirmationSent) {
    return (
      <Notice tone="success" title="Confira seu e-mail">
        Enviamos um link de confirmação para {email}. Abra-o para concluir o
        cadastro.
      </Notice>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      {error !== null && <Notice>{error}</Notice>}

      <Field label="E-mail" id="signup-email">
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

      <Field label="Senha" id="signup-password" hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <Field label="Confirme a senha" id="signup-confirm-password">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        )}
      </Field>

      <p className="text-sm text-ink-subtle">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-ink hover:underline">
          Entrar
        </Link>
      </p>

      <Button type="submit" pending={pending} className="w-full">
        Criar conta
      </Button>
    </form>
  );
}
