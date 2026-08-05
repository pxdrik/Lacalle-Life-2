import { DataError } from "@/core/domain/data-error";

/**
 * Turns a failure code into something a person can act on.
 *
 * Each message names the cause and the next step, because "erro ao salvar"
 * tells someone nothing they can do about it. The blocked-storage and
 * quota cases are the two that actually happen in a browser-only app.
 */
export function describeDataError(error: unknown): string {
  if (error instanceof DataError) {
    switch (error.code) {
      case "UNAVAILABLE":
        return "Seu navegador está bloqueando o armazenamento local. Verifique se a navegação anônima ou alguma extensão está impedindo o acesso.";
      case "QUOTA_EXCEEDED":
        return "O armazenamento do navegador está cheio. Libere espaço para continuar.";
      case "BLOCKED":
        return "Outra aba do Lacalle Life está aberta com uma versão anterior. Feche-a e recarregue esta página.";
      case "FAILED":
        return "A operação não pôde ser concluída. Tente novamente.";
    }
  }

  return "Algo deu errado. Recarregue a página e tente de novo.";
}
