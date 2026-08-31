import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyInput } from "./money";

describe("money formatting", () => {
  it("formats Colombian pesos with dot grouping and no cents", () => {
    expect(formatMoneyInput(1_000_000, "COP", "es-CO")).toBe("10.000");
    expect(formatMoney(1_000_000, "COP", "es-CO")).toContain("10.000");
    expect(formatMoney(1_000_050, "COP", "es-CO")).toContain("10.001");
  });

  it("formats US dollars with dot grouping and two cents in Spanish", () => {
    expect(formatMoneyInput(1_000_050, "USD", "es-CO")).toBe("10.000,50");
    expect(formatMoney(1_000_050, "USD", "es-CO")).toContain("10.000,50");
  });

  it("keeps the English locale convention when English is active", () => {
    expect(formatMoneyInput(1_000_050, "USD", "en-US")).toBe("10,000.50");
  });
});
