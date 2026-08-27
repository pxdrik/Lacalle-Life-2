"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { noticeClasses } from "@/design-system/components/notice";
import { useToast } from "@/design-system/components/toast";

import { useBackupRepository } from "../data/backup-repository-context";

/**
 * What the chosen file's own row shows, distinct from the `error` banner
 * above it. Three explicit states rather than "`null` means still reading,
 * unless it also failed" — that collapsed shape is what let a failed read
 * keep showing "Lendo arquivo…" forever (external audit, 27/08/2026): the
 * label had no way to tell "still working" apart from "already stopped, and
 * did not work".
 */
type Preview =
  | { readonly status: "reading" }
  | {
      readonly status: "ready";
      readonly recordCount: number;
      readonly sanitizedCount: number;
      readonly discardedCount: number;
    }
  | { readonly status: "failed" };

/**
 * The only durability mechanism this app has that survives clearing the
 * browser, uninstalling the PWA, or losing the phone.
 * `navigator.storage.persist()`, requested silently at startup, is hardening
 * against eviction under disk pressure — it does not cover any of those, so
 * this exists regardless of whether that request was granted.
 */
export function BackupPanel() {
  const repository = useBackupRepository();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  /** `null` while no file has been chosen at all. */
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("storage" in navigator)) return;
    void navigator.storage.persisted().then(setPersisted);
  }, []);

  async function handleExport() {
    setError(null);
    setExporting(true);
    try {
      const backup = await (await repository).exportAll();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const day = new Date().toISOString().slice(0, 10);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lacalle-life-backup-${day}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast("Backup exportado.");
    } catch {
      setError("Não foi possível gerar o backup. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setPreview(file === null ? null : { status: "reading" });
    setPendingFile(file);
    // Clears the input's own memory of the file, so choosing the exact same
    // file a second time still fires `onChange` instead of being a no-op.
    event.target.value = "";

    if (file === null) return;
    void previewFile(file);
  }

  /**
   * Reads and validates the file the moment it's chosen, so the confirmation
   * step below can say what it actually contains — including "0 registros"
   * for a file that is technically valid but empty — instead of only finding
   * out after the data it replaces is already gone.
   */
  async function previewFile(file: File) {
    try {
      const text = await file.text();
      const result = await (await repository).previewImport(text);

      if (result.ok) {
        setPreview({
          status: "ready",
          recordCount: result.recordCount,
          sanitizedCount: result.sanitizedCount,
          discardedCount: result.discardedCount,
        });
        return;
      }

      setPreview({ status: "failed" });
      setError(
        result.reason === "incompatible"
          ? "Este arquivo é de uma versão do backup que este app não sabe ler. Verifique se há uma atualização do app."
          : "Este arquivo não é um backup válido do LaCalle Life, ou está corrompido.",
      );
    } catch {
      setPreview({ status: "failed" });
      setError("Não foi possível ler o arquivo selecionado.");
    }
  }

  async function handleImportConfirmed() {
    if (pendingFile === null) return;

    setImporting(true);
    setError(null);
    try {
      const text = await pendingFile.text();
      const result = await (await repository).importAll(text);

      if (result.ok) {
        toast(importedToastMessage(result));
        setPendingFile(null);
        setPreview(null);
        return;
      }

      setError(
        result.reason === "incompatible"
          ? "Este arquivo é de uma versão do backup que este app não sabe ler. Verifique se há uma atualização do app."
          : "Este arquivo não é um backup válido do LaCalle Life, ou está corrompido.",
      );
    } catch {
      setError("Não foi possível ler o arquivo selecionado.");
    } finally {
      setImporting(false);
    }
  }

  /**
   * Reloads the page once everything is cleared, rather than resetting each
   * screen's own state by hand. Every hook in the app assumes its repository
   * connection is still pointed at data that exists; a reload is what a fresh
   * install already does correctly, so this reaches the same state through
   * the same path instead of a second one that has to agree with it.
   *
   * On failure, the message depends on `partiallyCompleted`: `forgetDevice`
   * clears five independent mechanisms with no rollback for any of them, so
   * "não foi possível apagar" is only true when nothing happened at all. If
   * something did — see `composition/forget-device.ts` — the honest message
   * says so and still offers a reload, since whatever is left of this
   * device's data is now in an unknown state relative to what the app
   * expects, and a fresh read is safer than continuing on stale in-memory
   * state either way.
   */
  async function handleForgetConfirmed() {
    setForgetting(true);
    setError(null);
    try {
      const result = await (await repository).forgetDevice();
      if (result.ok) {
        window.location.reload();
        return;
      }

      if (result.partiallyCompleted) {
        setError(
          "Não foi possível concluir a limpeza deste dispositivo, mas parte dos dados já foi apagada. Recarregue a página para conferir o que restou.",
        );
      } else {
        setError(
          "Não foi possível apagar os dados deste dispositivo. Nada foi alterado.",
        );
      }
      setForgetting(false);
    } catch {
      setError(
        "Não foi possível apagar os dados deste dispositivo. Recarregue a página para conferir o que restou.",
      );
      setForgetting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Backup</h2>
      <p className="text-xs text-ink-subtle">
        Exporta dietas, treinos, diário, evolução e perfil num arquivo que
        você guarda. Importar substitui completamente os dados atuais pelo
        conteúdo do arquivo. Não soma, não mescla.
      </p>

      {persisted !== null && (
        <p className="text-xs text-ink-subtle">
          {persisted
            ? "O navegador protegeu este armazenamento contra despejo automático."
            : "O navegador pode apagar este armazenamento sob pouco espaço em disco. O backup é a proteção que realmente importa."}
        </p>
      )}

      {error !== null && (
        <p role="alert" className={noticeClasses()}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          size="sm"
          pending={exporting}
          onClick={() => {
            void handleExport();
          }}
        >
          <Download aria-hidden className="size-4" />
          Exportar dados
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            fileInputRef.current?.click();
          }}
        >
          <Upload aria-hidden className="size-4" />
          Escolher arquivo de backup
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="sr-only"
          onChange={handleFileChosen}
        />
      </div>

      {pendingFile !== null && preview !== null && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-strong bg-muted px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm text-ink">{pendingFile.name}</p>
            {/* Three distinct states, not "still `null`, or already failed
                and stayed `null` anyway" — a failed read used to leave this
                permanently saying "Lendo arquivo…" even after the error
                banner above already explained what went wrong (external
                audit, 27/08/2026). */}
            {preview.status === "reading" && (
              <p className="text-xs text-ink-subtle">Lendo arquivo…</p>
            )}
            {preview.status === "failed" && (
              <p className="text-xs text-ink-subtle">
                Não foi possível ler o arquivo.
              </p>
            )}
            {preview.status === "ready" && (
              <>
                {/* The number that has to be seen before the confirming tap,
                    not after — a file with 0 registros is technically valid
                    and would otherwise sail through the same confirmation as
                    any other. */}
                <p className="text-xs text-ink-subtle">
                  {recordCountLabel(preview)}
                </p>
                {(preview.sanitizedCount > 0 || preview.discardedCount > 0) && (
                  <p className="text-xs text-ink-subtle">
                    {legacyRecordsLabel(preview)}
                  </p>
                )}
              </>
            )}
          </div>
          {preview.status === "ready" && (
            <ConfirmButton
              onConfirm={() => {
                void handleImportConfirmed();
              }}
              label={`Importar ${pendingFile.name} e substituir todos os dados`}
              confirmLabel="Substituir tudo?"
              className="h-(--control-h-sm) px-3 text-xs"
            >
              {importing ? "Importando…" : "Importar e substituir tudo"}
            </ConfirmButton>
          )}
        </div>
      )}

      {/* Distinct from "Apagar dados" on the profile card above: that clears
          only the profile and its targets. This clears every domain store,
          both browser storages the app uses, every Service Worker cache, and
          the Service Worker registration itself — see
          `composition/forget-device.ts` for the exact list. A hard divider
          rather than sitting inside the export/import group: this is not a
          third backup operation, it stands apart from the two that come
          before it. */}
      <div className="space-y-2 border-t border-line pt-3">
        <h3 className="text-xs font-semibold text-ink">Esquecer este dispositivo</h3>
        <p className="text-xs text-ink-subtle">
          Apaga todos os dados do LaCalle Life salvos neste navegador: dietas,
          treinos, diário, evolução, perfil e preferências. Sem volta, a não
          ser que você tenha um backup.
        </p>
        <ConfirmButton
          onConfirm={() => {
            void handleForgetConfirmed();
          }}
          label="Esquecer este dispositivo e apagar todos os dados"
          confirmLabel="Apagar tudo, sem volta?"
          className="h-(--control-h-sm) px-3 text-xs"
        >
          <Trash2 aria-hidden className="size-4" />
          {forgetting ? "Apagando…" : "Esquecer este dispositivo"}
        </ConfirmButton>
      </div>
    </div>
  );
}

function recordCountLabel(preview: {
  readonly recordCount: number;
}): string {
  return `Este arquivo contém ${String(preview.recordCount)} ${
    preview.recordCount === 1 ? "registro" : "registros"
  }.`;
}

/**
 * What a legacy value in the file becomes on import — see `repairRecord` in
 * `composition/backup.ts` for the rule itself. Said here, before the
 * confirming tap, not only in the toast after: someone who exported this
 * file expects it back exactly as it was, and a set that predates a bound
 * this app enforces today either loses that one field or, if it cannot be
 * recovered safely, the whole record — both worth knowing before "Substituir
 * tudo?", not as a surprise afterwards.
 */
function legacyRecordsLabel(preview: {
  readonly sanitizedCount: number;
  readonly discardedCount: number;
}): string {
  const parts: string[] = [];

  if (preview.sanitizedCount > 0) {
    parts.push(
      `${String(preview.sanitizedCount)} ${
        preview.sanitizedCount === 1
          ? "registro antigo será ajustado"
          : "registros antigos serão ajustados"
      } (um valor que não é mais aceito vira "não informado")`,
    );
  }
  if (preview.discardedCount > 0) {
    parts.push(
      `${String(preview.discardedCount)} ${
        preview.discardedCount === 1
          ? "registro não pôde ser recuperado e será descartado"
          : "registros não puderam ser recuperados e serão descartados"
      }`,
    );
  }

  return `${parts.join("; ")}.`;
}

function importedToastMessage(result: {
  readonly recordCount: number;
  readonly sanitizedCount: number;
  readonly discardedCount: number;
}): string {
  const base = `Backup restaurado, ${String(result.recordCount)} registros.`;
  if (result.sanitizedCount === 0 && result.discardedCount === 0) return base;

  const notes: string[] = [];
  if (result.sanitizedCount > 0) {
    notes.push(`${String(result.sanitizedCount)} ajustados`);
  }
  if (result.discardedCount > 0) {
    notes.push(`${String(result.discardedCount)} descartados`);
  }
  return `${base} (${notes.join(", ")})`;
}
