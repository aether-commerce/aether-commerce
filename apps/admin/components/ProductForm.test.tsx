// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../test/render";
import userEvent from "@testing-library/user-event";
import { ProductForm, emptyProductForm, type ProductFormValues } from "./ProductForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock })
}));

const getTokenMock = vi.fn(() => Promise.resolve("test-token"));
vi.mock("@clerk/react", () => ({
  useAuth: () => ({ getToken: getTokenMock })
}));

const fetchMock = vi.fn();

function productApiCalls() {
  return fetchMock.mock.calls.filter(([url]) => !String(url).includes("/runtime-config"));
}

function filledValues(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    ...emptyProductForm,
    name: "Auriculares QA",
    category: "audio",
    shortDescription: "Un producto de prueba.",
    description: "Descripcion larga de prueba para el formulario.",
    images: { main: "/products/qa-1.webp", gallery: [] },
    priceCents: 5000,
    stock: 10,
    ...overrides
  };
}

describe("ProductForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    getTokenMock.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("blocks submission when required fields are missing with inline validation", async () => {
    // The form owns its validation so browser-native bubbles do not bypass
    // the product's inline error experience.
    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={emptyProductForm} />);

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(productApiCalls()).toHaveLength(0);
  });

  it("blocks submission when the compare-at price is not higher than the price", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={filledValues({ compareAtPriceCents: 4000 })} />);

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByText(/compare-at price must be higher/i)).toBeInTheDocument();
    expect(productApiCalls()).toHaveLength(0);
  });

  it("uses the live store currency for the price fields", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { currency: "COP" } })
    } as Response);

    render(<ProductForm mode="create" initialValues={emptyProductForm} />);

    expect(await screen.findByText("Price (COP) *")).toBeInTheDocument();
    expect(screen.getAllByText("COP")).toHaveLength(2);
  });

  it("blocks submission when there is no main image yet", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={filledValues({ images: { main: "", gallery: [] } })} />);

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByText(/add at least a main image/i)).toBeInTheDocument();
  });

  it("submits a POST with the built payload and redirects to the edit page on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { currency: "USD" } })
    } as Response);
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: { id: "prd_new_1" } })
    } as Response);

    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={filledValues({ featured: true, featuredPosition: 2 })} />);
    await user.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(productApiCalls()).toHaveLength(1));
    const [url, init] = productApiCalls()[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/admin/products");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as { name: string; priceCents: number; featuredPosition: number | null };
    expect(body.name).toBe("Auriculares QA");
    expect(body.priceCents).toBe(5000);
    expect(body.featuredPosition).toBe(2);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/products/edit/?id=prd_new_1"));
  });

  it("shows the API's error message when the save fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { currency: "USD" } })
    } as Response);
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: { message: "Slug already in use." } })
    } as Response);

    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={filledValues()} />);
    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByText("Slug already in use.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("requires a second confirming click before deleting an existing product", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="edit" productId="prd_1" initialValues={filledValues()} />);

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(productApiCalls()).toHaveLength(0);
    expect(screen.getByText(/delete this product\?/i)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: { deleted: true, softDeleted: false } })
    } as Response);

    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/admin/products/prd_1"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/products/"));
  });

  it("cancelling the delete confirmation does not call the API", async () => {
    const user = userEvent.setup();
    render(<ProductForm mode="edit" productId="prd_1" initialValues={filledValues()} />);

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByText(/delete this product\?/i)).not.toBeInTheDocument();
    expect(productApiCalls()).toHaveLength(0);
  });

  it("closes the category menu after selecting an option", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { currency: "USD" } })
    } as Response);
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, data: [{ id: "cat_audio", slug: "audio", name: "Audio", isHidden: false }] })
    } as Response);

    const user = userEvent.setup();
    render(<ProductForm mode="create" initialValues={emptyProductForm} />);

    await user.click(screen.getByRole("button", { name: /category/i }));
    await user.click(await screen.findByRole("option", { name: /Audio audio/ }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
