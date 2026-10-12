import { describe, expect, it } from "vitest";
import { createOrderNumber } from "./orders";

describe("createOrderNumber", () => {
  it("uses the entire Wompi transaction ID instead of its shared merchant prefix", () => {
    const first = "12218690-1791798920-82343";
    const second = "12218690-1791806657-49578";

    expect(createOrderNumber(first, "AETH")).toMatch(/^AETH-[A-F0-9]{32}$/);
    expect(createOrderNumber(first, "AETH")).toBe(createOrderNumber(first, "AETH"));
    expect(createOrderNumber(first, "AETH")).not.toBe(createOrderNumber(second, "AETH"));
    expect(createOrderNumber(first, "AETH")).not.toContain(first);
  });

  it("distinguishes Stripe session IDs that share their first ten characters", () => {
    expect(createOrderNumber("cs_test_sameprefix-A", "AETH")).not.toBe(
      createOrderNumber("cs_test_sameprefix-B", "AETH")
    );
  });
});
