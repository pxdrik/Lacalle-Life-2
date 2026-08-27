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
    previewImport: vi.fn().mockResolvedValue({
      ok: true,
      recordCount: 3,
      sanitizedCount: 0,
      discardedCount: 0,
    }),
    importAll: vi.fn().mockResolvedValue({
      ok: true,
      recordCount: 3,
      sanitizedCount: 0,
      discardedCount: 0,
    }),
    forgetDevice: vi.fn().mockResolvedValue({ ok: true }),
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
      previewImport: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 42,
        sanitizedCount: 0,
        discardedCount: 0,
      }),
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
      previewImport: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 0,
        sanitizedCount: 0,
        discardedCount: 0,
      }),
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
    let resolvePreview!: (value: {
      ok: true;
      recordCount: number;
      sanitizedCount: number;
      discardedCount: number;
    }) => void;
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

    resolvePreview({
      ok: true,
      recordCount: 5,
      sanitizedCount: 0,
      discardedCount: 0,
    });
    expect(
      await screen.findByRole("button", { name: /Importar backup\.json/ }),
    ).toBeInTheDocument();
  });

  /**
   * External audit (27/08/2026): a failed preview left "Lendo arquivo…"
   * showing forever, on top of the error banner that correctly explained
   * what went wrong — the two together read as the app being stuck, not as
   * an error already handled. `preview` now has an explicit `"failed"`
   * state instead of staying `null` on both "still reading" and "gave up".
   */
  it("stops saying 'Lendo arquivo…' once the preview fails, and says so plainly instead", async () => {
    mount({
      previewImport: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "invalid" }),
    });

    chooseFile("not json");

    expect(
      await screen.findByText("Não foi possível ler o arquivo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Lendo arquivo…")).not.toBeInTheDocument();
  });

  it("stops saying 'Lendo arquivo…' when reading the file itself throws", async () => {
    mount({
      previewImport: vi.fn().mockRejectedValue(new Error("boom")),
    });

    chooseFile('{"schemaVersion":1}');

    expect(
      await screen.findByText("Não foi possível ler o arquivo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Lendo arquivo…")).not.toBeInTheDocument();
  });

  it("names how many legacy records will be adjusted or discarded, before the confirming tap", async () => {
    mount({
      previewImport: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 10,
        sanitizedCount: 1,
        discardedCount: 2,
      }),
    });

    chooseFile('{"schemaVersion":1}');

    expect(
      await screen.findByText("Este arquivo contém 10 registros."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 registro antigo será ajustado/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 registros não puderam ser recuperados/),
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
      previewImport: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 42,
        sanitizedCount: 0,
        discardedCount: 0,
      }),
      importAll: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 42,
        sanitizedCount: 0,
        discardedCount: 0,
      }),
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
      previewImport: vi.fn().mockResolvedValue({
        ok: true,
        recordCount: 5,
        sanitizedCount: 0,
        discardedCount: 0,
      }),
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

/**
 * `forgetDevice` clears five independent mechanisms with no rollback for
 * any of them — the 2026-08-24 pre-deploy review found the panel showing
 * "não foi possível apagar" even when part of the device's data was, in
 * fact, already gone. These tests are the three states that message has to
 * tell apart: full success, full failure (nothing touched), and partial
 * failure (something was, and the message has to say so).
 */
describe("esquecer este dispositivo", () => {
  async function confirm() {
    const button = screen.getByRole("button", {
      name: "Esquecer este dispositivo e apagar todos os dados",
    });
    await userEvent.click(button);
    await userEvent.click(
      screen.getByRole("button", { name: /Apagar tudo, sem volta\?/ }),
    );
  }

  it("reloads the page on success, without an error banner", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    const repository = mount({
      forgetDevice: vi.fn().mockResolvedValue({ ok: true }),
    });

    await confirm();

    await waitFor(() => {
      expect(repository.forgetDevice).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(reload).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("says nothing was altered when nothing completed, and does not reload", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    mount({
      forgetDevice: vi
        .fn()
        .mockResolvedValue({ ok: false, partiallyCompleted: false }),
    });

    await confirm();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nada foi alterado.",
      );
    });
    expect(reload).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("says data was already erased when the failure was partial, distinctly from a total failure", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    mount({
      forgetDevice: vi
        .fn()
        .mockResolvedValue({ ok: false, partiallyCompleted: true }),
    });

    await confirm();

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("parte dos dados já foi apagada");
      expect(alert).not.toHaveTextContent("Nada foi alterado.");
    });
    expect(reload).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("shows a message and offers no false reassurance when forgetDevice itself throws", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    mount({
      forgetDevice: vi.fn().mockRejectedValue(new Error("unexpected")),
    });

    await confirm();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível apagar os dados deste dispositivo.",
      );
    });
    expect(reload).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
