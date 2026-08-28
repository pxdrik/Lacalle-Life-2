import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { describeAuthError } from "./describe-auth-error";

function authError(code: string): AuthApiError {
  return new AuthApiError("mensagem original em inglês", 400, code);
}

describe("describeAuthError", () => {
  it("translates known Supabase auth error codes", () => {
    expect(describeAuthError(authError("invalid_credentials"))).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(describeAuthError(authError("user_already_exists"))).toContain(
      "Já existe uma conta",
    );
    expect(describeAuthError(authError("weak_password"))).toContain("fraca");
    expect(describeAuthError(authError("email_not_confirmed"))).toContain(
      "Confirme seu e-mail",
    );
    expect(describeAuthError(authError("captcha_failed"))).toContain(
      "robô",
    );
  });

  it("falls back to a generic message for unmapped codes and non-auth errors", () => {
    expect(describeAuthError(authError("some_future_code"))).toBe(
      "Algo deu errado. Tente novamente em instantes.",
    );
    expect(describeAuthError(new Error("network down"))).toBe(
      "Algo deu errado. Tente novamente em instantes.",
    );
    expect(describeAuthError("not even an Error")).toBe(
      "Algo deu errado. Tente novamente em instantes.",
    );
  });
});
