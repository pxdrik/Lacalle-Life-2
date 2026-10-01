import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";

import type { AdminState } from "../../hooks/use-admin";

/** Carregando ou com erro: o mesmo para as três telas da administração. */
export function AdminLoadState({ state }: { readonly state: Exclude<AdminState, { status: "ready" }> }) {
  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return (
    <div role="alert" className={noticeClasses("danger", "block")}>
      <p className="text-ink">Não foi possível carregar a administração.</p>
      <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e recarregue a página.</p>
    </div>
  );
}
