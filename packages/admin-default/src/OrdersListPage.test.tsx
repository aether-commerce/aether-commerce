// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "./test-render";
import { OrdersListPage } from "./OrdersListPage";

const { getToken } = vi.hoisted(() => ({ getToken: vi.fn(() => Promise.resolve("admin-test-token")) }));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken, isLoaded: true, isSignedIn: true })
}));

const order = {
  id: "ord_wompi_test",
  number: "AETH-WOMPI-TEST",
  email: "sandbox@example.com",
  state: "paid",
  channel: "wompi",
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
  total: 49000,
  currency: "COP",
  created_at: "2026-10-12T15:39:56.000Z"
};

describe("OrdersListPage Wompi channel", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.setItem("aether.admin.locale.v1", "en");
    fetchMock.mockReset().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: { data: [order], pagination: { page: 1, pageSize: 25, total: 1, pageCount: 1 } }
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    getToken.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("labels Wompi orders correctly and filters them through the Wompi channel", async () => {
    const user = userEvent.setup();
    render(<OrdersListPage />);

    expect(await screen.findByText("AETH-WOMPI-TEST")).toBeInTheDocument();
    const orderRow = screen.getByRole("row", { name: /AETH-WOMPI-TEST/ });
    expect(within(orderRow).getByText("Wompi")).toBeInTheDocument();

    const channelFilter = screen.getByRole("combobox", { name: "Filter by channel" });
    expect(within(channelFilter).getByRole("option", { name: "Wompi" })).toBeInTheDocument();
    await user.selectOptions(channelFilter, "wompi");

    expect(await screen.findByText("Channel: Wompi")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("channel=wompi");
  });
});
