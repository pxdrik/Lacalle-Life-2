import { AuthApiError } from "@supabase/supabase-js";

/**
 * Turns a Supabase auth failure into something a person can act on.
 *
 * Mirrors `core/domain/describe-data-error.ts` — one message per cause the
 * app actually surfaces to a user, not a generic "algo deu errado" for
 * everything. `error.code` is Supabase's stable machine-readable identifier
 * (not the free-text `message`, which changes wording between SDK versions).
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof AuthApiError) {
    switch (error.code) {
      case "invalid_credentials":
        return "E-mail ou senha incorretos.";
      case "user_already_exists":
      case "email_exists":
        return "Já existe uma conta com este e-mail. Tente entrar em vez de cadastrar.";
      case "weak_password":
        return "Senha fraca demais. Use pelo menos 8 caracteres.";
      case "email_not_confirmed":
        return "Confirme seu e-mail antes de entrar — veja o link que enviamos.";
      case "over_email_send_rate_limit":
        return "Muitos e-mails pedidos em pouco tempo. Espere alguns minutos e tente de novo.";
      case "same_password":
        return "A nova senha precisa ser diferente da atual.";
      case "user_not_found":
        // Nunca dito ao pedir redefinição de senha — só chega aqui num
        // contexto onde a sessão já existe (ex.: atualizar senha).
        return "Não foi possível concluir. Faça login de novo e tente outra vez.";
    }
  }

  return "Algo deu errado. Tente novamente em instantes.";
}
