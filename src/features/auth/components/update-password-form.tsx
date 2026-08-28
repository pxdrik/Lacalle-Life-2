"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/design-system/components/button";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Notice } from "@/design-system/components/notice";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Só alcançável a partir do link do e-mail de redefinição — nesse ponto o
 * Supabase já trocou o código da URL por uma sessão válida (o
 * `exchangeCodeForSession` roda em `/auth/callback`, antes de chegar aqui).
 * `updatePassword` do repositório grava em cima dessa sessão, não pede a
 * senha antiga.
 */
export function UpdatePasswordForm() {
  const repository = useAuthRepository();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await repository.updatePassword(password);
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

      <Field label="Nova senha" id="update-password" hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
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

      <Field label="Confirme a nova senha" id="update-password-confirm">
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

      <Button type="submit" pending={pending} className="w-full">
        Salvar nova senha
      </Button>
    </form>
  );
}
