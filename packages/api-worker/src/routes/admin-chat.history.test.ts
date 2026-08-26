import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { buildAdminChatHistory } from "./admin-chat";

describe("buildAdminChatHistory", () => {
  it("closes a tool-only turn before replaying the next operator request", () => {
    const history = buildAdminChatHistory([
      { role: "user", content: "Que pedidos se estan en estado procesando?", tool_calls_json: null },
      { role: "tool", content: "3 pedido(s) estan en estado processing.", tool_calls_json: JSON.stringify({ toolName: "get_orders_by_status" }) },
      { role: "user", content: "que productos tienen low stock?", tool_calls_json: null }
    ]);

    expect(history).toHaveLength(3);
    expect(history[0]).toBeInstanceOf(HumanMessage);
    expect(history[1]).toBeInstanceOf(AIMessage);
    expect(history[2]).toBeInstanceOf(HumanMessage);
    expect(history[1]?.content).toContain("preceding request was completed");
    expect(history[1]?.content).toContain("3 pedido(s)");
    expect(history[2]?.content).toBe("que productos tienen low stock?");
  });

  it("does not duplicate tool data when the turn already has an assistant reply", () => {
    const history = buildAdminChatHistory([
      { role: "user", content: "Show low stock", tool_calls_json: null },
      { role: "tool", content: "3 products are low on stock.", tool_calls_json: JSON.stringify({ toolName: "get_low_stock_products" }) },
      { role: "assistant", content: "The results are above.", tool_calls_json: null }
    ]);

    expect(history).toHaveLength(2);
    expect(history[1]?.content).toBe("The results are above.");
  });
});
