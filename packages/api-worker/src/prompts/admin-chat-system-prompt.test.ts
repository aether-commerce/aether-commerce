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

  it("distinguishes a failed order save from a rejected payment", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain('"Payment not confirmed" return can also mean an approved payment failed to save an order');
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("check webhook activity and system health before advising a retry");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("older orders can have shorter numbers");
  });

  it("keeps Wompi orders distinct in the Orders channel filter", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("the channel filter distinguishes Stripe, Wompi, and WhatsApp");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("labeled and filtered as Wompi, not Stripe");
  });
});

describe("admin currency guidance", () => {
  it("points to Store settings and explains saved USD prices", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Settings > Store section switches catalog prices");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("switching back restores saved USD prices");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("changing the currency alone activates Wompi");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Online payment uses whichever provider is active in Integrations");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Checkout method options and provider credentials are saved independently");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("pending, declined or unverifiable payment must never be described as confirmed");
  });
});

describe("admin assistant limits guidance", () => {
  it("directs limit changes to their own section and explains deployment scope", () => {
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Settings > Assistant limits");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("daily deployment message budget");
    expect(ADMIN_CHAT_SYSTEM_PROMPT.text).toContain("Navigate with assistant_limits");
  });
});
