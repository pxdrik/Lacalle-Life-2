import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BackupRepositoryProvider } from "../data/backup-repository-context";
import type { BackupRepository } from "../data/backup-repository";
import { BackupPanel } from "./backup-panel";

/**
 * A fake `BackupRepository`, not the real IndexedDB-backed one — that one has
 * its own thorough test in `composition/backup.test.ts`. This is the UI's own
 * logic: does it call through correctly, does a failure ever silently clear
 * the pending file, does an error say why, and — the H.2 fix — does the
 * confirmation step always show what the file actually contains before the
 * destructive tap.
 */
function mount(overrides: Partial<BackupRepository> = {}) {
  const repository: BackupRepository = {
    exportAll: vi.fn().mockResolvedValue({ some: "backup" }),
    previewImport: vi.fn().mockResolvedValue({ ok: true, recordCount: 3 }),
    importAll: vi.fn().mockResolvedValue({ ok: true, recordCount: 3 }),
    ...overrides,
  };

  // jsdom has no object URL support; the export path only needs it to not
  // throw, not to produce a real blob URL.
  URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
  URL.revokeObjectURL = vi.fn();

  render(
    <BackupRepositoryProvider repository={Promise.resolve(repository)}>
      <BackupPanel />
    </BackupRepositoryProvider>,
  );

  return repository;
}

function chooseFile(contents: string, name = "backup.json") {
  const input = document.querySelector('input[type="file"]');
  if (input === null) throw new Error("file input not found");

  const file = new File([contents], name, { type: "application/json" });
  // jsdom's file input accepts a real FileList only through this path.
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("export", () => {
  it("calls exportAll and reports success, without an error banner", async () => {
    const repository = mount();

    await userEvent.click(
      screen.getByRole("button", { name: "Exportar dados" }),
    );

    await waitFor(() => {
      expect(repository.exportAll).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error banner when exporting fails, without throwing", async () => {
    mount({ exportAll: vi.fn().mockRejectedValue(new Error("disk full")) });

    await userEvent.click(
      screen.getByRole("button", { name: "Exportar dados" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível gerar o backup",
      );
    });
  });
});

describe("import preview", () => {
  it("previews the file as soon as it's chosen, before any confirmation tap", async () => {
    const repository = mount({
      previewImport: vi.fn().mockResolvedValue({ ok: true, recordCount: 42 }),
    });

    chooseFile('{"schemaVersion":1}');

    await waitFor(() => {
      expect(repository.previewImport).toHaveBeenCalledWith(
        '{"schemaVersion":1}',
      );
    });
    expect(repository.importAll).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Este arquivo contém 42 registros."),
    ).toBeInTheDocument();
  });

  it("names a genuinely empty file rather than treating it like any other", async () => {
    mount({
      previewImport: vi.fn().mockResolvedValue({ ok: true, recordCount: 0 }),
    });

    chooseFile('{"schemaVersion":1}');

    expect(
      await screen.findByText("Este arquivo contém 0 registros."),
    ).toBeInTheDocument();
    // An empty backup is not blocked — it's a legitimate, if unusual, choice
    // — so the confirmation control still appears.
    expect(
      screen.getByRole("button", { name: /Importar backup\.json/ }),
    ).toBeInTheDocument();
  });

  it("does not offer to confirm until the preview resolves", async () => {
    let resolvePreview!: (value: { ok: true; recordCount: number }) => void;
    mount({
      previewImport: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
      ),
    });

    chooseFile('{"schemaVersion":1}');
    await screen.findByText("Lendo arquivo…");

    expect(
      screen.queryByRole("button", { name: /Importar backup\.json/ }),
    ).not.toBeInTheDocument();

    resolvePreview({ ok: true, recordCount: 5 });
    expect(
      await screen.findByRole("button", { name: /Importar backup\.json/ }),
    ).toBeInTheDocument();
  });

  it("shows a specific error for an incompatible version, without offering to confirm", async () => {
    mount({
      previewImport: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "incompatible" }),
    });

    chooseFile('{"schemaVersion":999}');

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "versão do backup que este app não sabe ler",
      );
    });
    expect(
      screen.queryByRole("button", { name: /Importar backup\.json/ }),
    ).not.toBeInTheDocument();
  });

  it("shows a generic error for a corrupted or unrecognised file", async () => {
    mount({
      previewImport: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "invalid" }),
    });

    chooseFile("not json");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "não é um backup válido",
      );
    });
  });
});

describe("import confirmation", () => {
  it("imports on confirmation and reports the record count, clearing the pending file", async () => {
    const repository = mount({
      previewImport: vi.fn().mockResolvedValue({ ok: true, recordCount: 42 }),
      importAll: vi.fn().mockResolvedValue({ ok: true, recordCount: 42 }),
    });

    chooseFile('{"schemaVersion":1}');
    await screen.findByText("Este arquivo contém 42 registros.");

    const confirm = screen.getByRole("button", {
      name: /Importar backup\.json e substituir todos os dados/,
    });
    await userEvent.click(confirm);
    await userEvent.click(
      screen.getByRole("button", { name: /Substituir tudo\?/ }),
    );

    await waitFor(() => {
      expect(repository.importAll).toHaveBeenCalledWith('{"schemaVersion":1}');
    });
    await waitFor(() => {
      expect(screen.queryByText("backup.json")).not.toBeInTheDocument();
    });
  });

  it("keeps the pending file and shows an error if the write itself fails", async () => {
    mount({
      previewImport: vi.fn().mockResolvedValue({ ok: true, recordCount: 5 }),
      importAll: vi.fn().mockRejectedValue(new Error("quota exceeded")),
    });

    chooseFile('{"schemaVersion":1}');
    await screen.findByText("Este arquivo contém 5 registros.");

    await userEvent.click(
      screen.getByRole("button", { name: /Importar backup\.json/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Substituir tudo\?/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível ler o arquivo selecionado.",
      );
    });
    expect(screen.getByText("backup.json")).toBeInTheDocument();
  });
});
