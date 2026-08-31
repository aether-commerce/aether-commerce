// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "./MoneyInput";

describe("MoneyInput", () => {
  it("shows COP with dot grouping and no cents, and parses grouped input as whole pesos", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();

    render(<MoneyInput value={1_000_000} currency="COP" locale="es-CO" className="input" onValueChange={onValueChange} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("10.000");
    await user.clear(input);
    await user.type(input, "25.000");

    expect(onValueChange).toHaveBeenLastCalledWith(2_500_000);
  });

  it("shows USD with dot grouping and two cents in Spanish", () => {
    render(<MoneyInput value={1_000_050} currency="USD" locale="es-CO" className="input" onValueChange={vi.fn()} />);

    expect(screen.getByRole("textbox")).toHaveValue("10.000,50");
  });
});
