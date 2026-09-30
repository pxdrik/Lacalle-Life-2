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

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm() {
  const repository = useAuthRepository();
  const captcha = useTurnstile();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Roadmap 8.4: sem aceite dos Termos e da Política, não há conta.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

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
    // Também aqui, não só no `disabled` do botão: um envio que não passa
    // pelo botão (Enter num campo, um evento disparado por fora) não cria
    // conta sem aceite.
    if (!acceptedTerms) {
      setError("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    // Só uma conveniência de UX — poupa uma volta ao servidor quando o
    // widget claramente ainda não resolveu. Quem valida de verdade é o
    // Supabase, que rejeita a chamada de qualquer jeito sem um token real.
    if (captcha.siteKey !== undefined && captcha.token === "") {
      setError("Confirme que você não é um robô antes de continuar.");
      return;
    }

    setPending(true);

    try {
      const { status } = await repository.signUp(
        email,
        password,
        captcha.token || undefined,
      );

      if (status === "already-registered") {
        setAlreadyRegistered(true);
        setPending(false);
        return;
      }

      if (status === "check-email") {
        setConfirmationSent(true);
        setPending(false);
        return;
      }

      hardNavigateTo("/hoje");
    } catch (cause) {
      setError(describeAuthError(cause));
      setPending(false);
    } finally {
      captcha.reset();
    }
  }

  if (alreadyRegistered) {
    return (
      <Notice tone="warning" title="Este e-mail já tem conta">
        {email} já está cadastrado. Você pode{" "}
        <Link href="/entrar" className="underline">
          entrar
        </Link>{" "}
        ou{" "}
        <Link href="/recuperar-senha" className="underline">
          recuperar sua senha
        </Link>
        , se não lembra dela.
      </Notice>
    );
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

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-(--accent)"
        />
        <span>
          Li e aceito os{" "}
          {/* Outra aba: abrir o documento não pode custar o formulário preenchido. */}
          <Link href="/termos-de-uso" target="_blank" rel="noopener" className="text-ink underline underline-offset-4">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/politica-de-privacidade" target="_blank" rel="noopener" className="text-ink underline underline-offset-4">
            Política de Privacidade
          </Link>{" "}
          do LaCalle Life.
        </span>
      </label>

      <TurnstileWidget captcha={captcha} />

      <Button
        type="submit"
        pending={pending}
        disabled={!acceptedTerms || (captcha.siteKey !== undefined && captcha.token === "")}
        className="w-full"
      >
        Criar conta
      </Button>
    </form>
  );
}
