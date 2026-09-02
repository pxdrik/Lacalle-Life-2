import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { DateField } from "./date-field";

/**
 * Achado de auditoria de design (02/09/2026): o `<input type="date">` do
 * Diário renderizava no locale do navegador (MM/DD/AAAA em Windows com
 * região em inglês) enquanto o resto da tela escrevia a mesma data em
 * DD/MM/AAAA — "09/02/2026" ao lado de "Nada registrado em 02/09/2026" para
 * o mesmo dia. Este campo substitui o nativo, do mesmo jeito que `TimeField`
 * já substitui `<input type="time">` pelo motivo análogo.
 */
function Controlled({ initial = "2026-09-02" }: { readonly initial?: string }) {
  const [value, setValue] = useState(initial);
  return <DateField value={value} onChange={setValue} label="Dia" />;
}

describe("DateField", () => {
  it("displays the committed value as DD/MM/AAAA, never the ISO shape", () => {
    render(<Controlled />);
    expect(screen.getByLabelText("Dia")).toHaveValue("02/09/2026");
  });

  it("commits YYYY-MM-DD only once a real calendar date has been typed", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("Dia");

    fireEvent.change(input, { target: { value: "0" } });
    expect(input).toHaveValue("0");

    fireEvent.change(input, { target: { value: "06082026" } });
    // Typed as digits, the component inserts the slashes itself.
    expect(input).toHaveValue("06/08/2026");
  });

  it("rejects a date the calendar does not have, instead of silently rolling it forward", () => {
    render(<Controlled />);
    const input = screen.getByLabelText("Dia");

    fireEvent.change(input, { target: { value: "31022026" } });
    expect(input).toHaveValue("31/02/2026");
    fireEvent.blur(input);

    // Reverted to the last valid, committed value — not repaired into 3 de
    // março, and not left showing a day that does not exist.
    expect(input).toHaveValue("02/09/2026");
  });

  it("reflects a value changed from elsewhere (the 'Dia anterior' / 'Próximo dia' buttons)", () => {
    const { rerender } = render(
      <DateField value="2026-09-02" onChange={() => {}} label="Dia" />,
    );
    expect(screen.getByLabelText("Dia")).toHaveValue("02/09/2026");

    rerender(<DateField value="2026-09-01" onChange={() => {}} label="Dia" />);
    expect(screen.getByLabelText("Dia")).toHaveValue("01/09/2026");
  });
});
