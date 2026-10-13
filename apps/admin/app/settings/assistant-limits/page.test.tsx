// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../../../test/render";
import userEvent from "@testing-library/user-event";
import AssistantLimitsPage from "./page";

const clerkMocks = vi.hoisted(() => ({ getToken: vi.fn(() => Promise.resolve(null)) }));
vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: clerkMocks.getToken })
}));

const fetchMock = vi.fn();
const deploymentDefaults = {
  messagesPerMinute: { mode: "deployment" },
  messagesPerHour: { mode: "deployment" },
  anonymousMessagesPerDay: { mode: "deployment" },
  dailyRequestBudget: { mode: "deployment" },
  maxConcurrentRequests: { mode: "deployment" }
};

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") throw new TypeError("Expected a JSON string body");
  const parsed: unknown = JSON.parse(body);
  return parsed;
}

describe("AssistantLimitsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/admin/assistant-limits") && init?.method === "PUT") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: parseBody(init.body) }) } as Response);
      }
      if (url.includes("/admin/assistant-limits")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: deploymentDefaults }) } as Response);
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ success: false }) } as Response);
    });
  });

  it("shows distinct limit controls and saves an environment-specific configuration", async () => {
    const user = userEvent.setup();
    render(<AssistantLimitsPage />);

    expect(await screen.findByText("These limits apply to the whole assistant deployment. Each environment stores its settings separately.")).toBeInTheDocument();
    const dailyLimitMode = screen.getByRole("combobox", { name: "Messages per day across the deployment" });
    await user.selectOptions(dailyLimitMode, "custom");
    const dailyLimit = screen.getByRole("spinbutton", { name: "Maximum count" });
    await user.clear(dailyLimit);
    await user.type(dailyLimit, "250");
    await user.click(screen.getByRole("button", { name: "Save limits" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/v1/admin/assistant-limits",
      expect.objectContaining({ method: "PUT" })
    ));
    const saveCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
    expect(parseBody((saveCall?.[1] as RequestInit).body)).toMatchObject({
      dailyRequestBudget: { mode: "custom", limit: 250 }
    });
    expect(await screen.findByText("Limits saved.")).toBeInTheDocument();
  });
});
