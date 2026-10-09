import { describe, expect, it } from "vitest";
import { ADMIN_CHAT_SYSTEM_PROMPT } from "./admin-chat-system-prompt";

describe("admin product image guidance", () => {
  it("keeps image management in Products and explains public delivery without promising custom page changes", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Product image uploads and replacements belong to the Products module");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("administration retains the original URLs");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("do not claim an Aether package update changes a client's custom introduction animation");
  });
});

describe("admin Wompi environment guidance", () => {
  it("keeps sandbox Wompi in production and checks store currency before recommending it", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("development deployment has no Wompi credentials");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("production deployment uses Wompi sandbox");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Wompi accepts COP only");
  });
});

describe("admin currency guidance", () => {
  it("points to Store settings and explains saved USD prices", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Settings > Store section switches catalog prices");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("switching back restores saved USD prices");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("changing the currency alone activates Wompi");
  });
});
