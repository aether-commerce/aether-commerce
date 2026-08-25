import { describe, expect, it } from "vitest";
import { getStoreId } from "./store-categories";

describe("store category ownership", () => {
  it("uses an explicit store binding and keeps the legacy default", () => {
    expect(getStoreId({} as never)).toBe("store_default");
    expect(getStoreId({ STORE_ID: "liminal" } as never)).toBe("liminal");
  });
});
