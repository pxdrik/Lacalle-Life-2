import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabela } from "./tabela";

describe("Tabela", () => {
  it("hides the column header from assistive tech — each row already reads as a full sentence", () => {
    render(
      <Tabela primaryLabel="100 g" columns={[{ key: "kcal", label: "kcal", width: "w-11" }]}>
        <li>Arroz branco, 128 kcal</li>
      </Tabela>,
    );

    expect(screen.getByText("100 g").closest("[aria-hidden]")).not.toBeNull();
    expect(screen.getByText("Arroz branco, 128 kcal")).toBeInTheDocument();
  });

  it("renders one spacer per trailing width, in order — the space the row reserves for its own actions", () => {
    render(
      <Tabela
        primaryLabel="Nome"
        columns={[]}
        trailingSpacers={["w-8", "w-16"]}
      >
        <li>linha</li>
      </Tabela>,
    );

    // Direct children of the header, in DOM order: the primary label, the
    // (here empty) group of numeric columns, then the two trailing spacers.
    const header = screen.getByText("Nome").parentElement;
    const children = header === null ? [] : Array.from(header.children);
    expect(children).toHaveLength(4);
    expect(children[2]).toHaveClass("w-8");
    expect(children[3]).toHaveClass("w-16");
  });

  it("renders the rows passed as children inside a list", () => {
    render(
      <Tabela primaryLabel="Nome" columns={[]}>
        <li>Primeira linha</li>
        <li>Segunda linha</li>
      </Tabela>,
    );

    expect(screen.getByRole("list").children).toHaveLength(2);
  });
});
