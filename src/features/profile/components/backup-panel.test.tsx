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
 * the pending file, does an error say why.
 */
function mount(overrides: Partial<BackupRepository> = {}) {
  const repository: BackupRepository = {
    exportAll: vi.fn().mockResolvedValue({ some: "backup" }),
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

describe("import", () => {
  function chooseFile(contents: string, name = "backup.json") {
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error("file input not found");

    const file = new File([contents], name, { type: "application/json" });
    // jsdom's file input accepts a real FileList only through this path.
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("does not call importAll until the confirmation step is completed", async () => {
    const repository = mount();

    chooseFile("{}");
    await screen.findByText("backup.json");

    expect(repository.importAll).not.toHaveBeenCalled();
  });

  it("imports on confirmation and reports the record count, clearing the pending file", async () => {
    const repository = mount({
      importAll: vi.fn().mockResolvedValue({ ok: true, recordCount: 42 }),
    });

    chooseFile('{"schemaVersion":1}');
    await screen.findByText("backup.json");

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

  it("keeps the pending file and shows a specific message for an incompatible version", async () => {
    mount({
      importAll: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: "incompatible" }),
    });

    chooseFile('{"schemaVersion":999}');
    await screen.findByText("backup.json");

    await userEvent.click(
      screen.getByRole("button", { name: /Importar backup\.json/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Substituir tudo\?/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "versão do backup que este app não sabe ler",
      );
    });
    // The file stays chosen — a wrong-version file is not a reason to make
    // the person browse for it again.
    expect(screen.getByText("backup.json")).toBeInTheDocument();
  });

  it("shows a generic message for a corrupted or unrecognised file", async () => {
    mount({
      importAll: vi.fn().mockResolvedValue({ ok: false, reason: "invalid" }),
    });

    chooseFile("not json");
    await screen.findByText("backup.json");

    await userEvent.click(
      screen.getByRole("button", { name: /Importar backup\.json/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Substituir tudo\?/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "não é um backup válido",
      );
    });
  });
});
