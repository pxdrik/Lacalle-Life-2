"use client";

import { ChevronDown } from "lucide-react";
import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { useToast } from "@/design-system/components/toast";
import { DensityToggle } from "@/design-system/density/density-toggle";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { useProfile } from "../hooks/use-profile";
import { BackupPanel } from "./backup-panel";
import { PlanSummary } from "./plan-summary";
import { ProfileForm } from "./profile-form";
import { StaleWeightNotice } from "./stale-weight-notice";

export function ProfileScreen() {
  const { state, writeError, hasConflict, save, clear, reload } = useProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  if (state.status === "loading") {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (state.status === "error") {
    return (
      <div role="alert" className={noticeClasses("danger", "block")}>
        <p className="text-ink">Não foi possível carregar seu perfil.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const showForm = editing || state.status === "empty";

  return (
    <div className="space-y-6">
      {writeError !== null && (
        <div role="alert" className={noticeClasses()}>
          <p>{writeError}</p>
          {/* The one way out of a conflict: reload discards this tab's
              unsaved edit and shows what is actually stored, rather than
              this screen silently re-submitting the same rejected version
              forever. See `useProfile`'s doc comment on `reload`. */}
          {hasConflict && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
              Recarregar dados
            </Button>
          )}
        </div>
      )}

      {/* Independent of the nutrition profile below — a display preference
          applies whether or not the person has ever filled out a goal. */}
      <div>
        <h2 className="text-sm font-medium text-ink">Aparência</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tema</p>
            <ThemeToggle />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-ink-subtle">Tamanho dos botões</p>
            <DensityToggle />
          </div>
        </div>
      </div>

      {showForm ? (
        <ProfileForm
          // Forces a remount whenever the stored version changes — a
          // successful save of course, but critically also `reload()` after
          // a conflict. `ProfileForm` seeds its draft from `initial` only
          // once, in a lazy `useState` initializer; without a `key` tied to
          // the version, a conflict-then-reload left the form showing the
          // same stale draft it had before, and a second "Salvar" would
          // then silently succeed and overwrite whatever the other tab had
          // just saved — the 2026-08-24 pre-deploy review caught this
          // exact sequence. See `useProfile`'s doc comment on `reload`.
          key={state.status === "ready" ? state.profile.updatedAt : "empty"}
          initial={state.status === "ready" ? state.profile.nutrition : null}
          pending={saving}
          onSubmit={(nutrition) => {
            setSaving(true);
            void save(nutrition).then((ok) => {
              setSaving(false);
              if (!ok) return;
              setEditing(false);
              toast("Metas recalculadas.");
            });
          }}
        />
      ) : (
        <>
          {/* Above the targets, because it is the reason to doubt them. */}
          {state.status === "ready" && (
            <StaleWeightNotice
              profile={state.profile.nutrition}
              pending={saving}
              onApply={(weightKg) => {
                setSaving(true);
                void save({ ...state.profile.nutrition, weightKg }).then(
                  (ok) => {
                    setSaving(false);
                    if (ok) toast("Peso atualizado e metas recalculadas.");
                  },
                );
              }}
            />
          )}

          <PlanSummary
            result={state.result}
            goal={state.profile.nutrition.goal}
          />

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
              }}
            >
              Editar dados
            </Button>
            {/* Two taps, and the word says what happens.
                "Desativar" promised a switch and delivered a delete: one
                click erased sex, age, height, weight, activity and goal with
                no confirmation and no undo, from a ghost button sitting
                beside "Editar dados". Every other destructive action in the
                app already went through `ConfirmButton`; the one that
                destroyed the most did not. */}
            <ConfirmButton
              onConfirm={() => {
                void clear();
              }}
              label="Apagar dados do perfil"
              confirmLabel="Apagar tudo?"
              className="h-(--control-h) px-4 text-sm"
            >
              Apagar dados
            </ConfirmButton>
          </div>

          <p className="text-xs text-ink-subtle">
            Apagar remove seus dados e as metas junto. Montar dieta continua
            funcionando igual.
          </p>
        </>
      )}

      {/* Independent of the nutrition form and of `state`: a backup exists
          whether or not a profile does, and covers every domain, not just
          this one. Moved to a secondary, collapsed area (H.1): it used to
          be the first card on the screen, ahead of the profile fields
          someone actually came here to fill in. Collapsed, not hidden —
          reachable to a screen reader and to find-in-page either way.
          `open` is controlled, not the native uncontrolled default: an
          external audit (27/08/2026) found this section closing itself
          partway through choosing a backup file to import, right when
          seeing the preview/confirmation/error that follows matters most.
          No re-render anywhere in this file's own state should ever be able
          to close `<details>` out from under the person reading it — an
          explicit `open`, only ever changed by the person's own click on
          `<summary>` (`onToggle`, the native event for exactly that),
          removes the possibility regardless of what triggered the
          re-render. */}
      <details
        className="group rounded-lg border border-line"
        open={backupOpen}
        onToggle={(event) => {
          setBackupOpen(event.currentTarget.open);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          Dados e segurança
          <ChevronDown
            aria-hidden
            className="size-4 text-ink-subtle transition-transform duration-150 ease-out group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line p-4">
          <BackupPanel />
        </div>
      </details>
    </div>
  );
}
