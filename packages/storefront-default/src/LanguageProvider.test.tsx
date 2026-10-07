// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

function LanguageContent() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <>
      <h1>{locale}</h1>
      <p>{t.categories}</p>
      <button onClick={() => setLocale("en")}>English</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("storefront language", () => {
  it("renders the configured Spanish content before any browser effect", () => {
    expect(
      renderToString(
        <LanguageProvider initialLocale="es">
          <LanguageContent />
        </LanguageProvider>
      )
    ).toContain("Categorías");
    expect(
      renderToString(
        <LanguageProvider>
          <LanguageContent />
        </LanguageProvider>
      )
    ).toContain("Categories");
  });
  it("keeps the merchant default instead of replacing it with the browser language", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
    render(
      <LanguageProvider initialLocale="es">
        <LanguageContent />
      </LanguageProvider>
    );
    expect(screen.getByRole("heading").textContent).toBe("es");
    expect(document.documentElement.lang).toBe("es");
  });
  it("honors an explicit saved visitor selection", () => {
    localStorage.setItem("aether.locale", "en");
    render(
      <LanguageProvider initialLocale="es">
        <LanguageContent />
      </LanguageProvider>
    );
    expect(screen.getByRole("heading").textContent).toBe("en");
  });
  it("still switches language when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Denied");
    });
    render(
      <LanguageProvider initialLocale="es">
        <LanguageContent />
      </LanguageProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading").textContent).toBe("en");
  });
});
