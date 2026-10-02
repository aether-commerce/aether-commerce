// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductImage } from "./ProductImage";

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} data-next-image="true" /> }));
afterEach(cleanup);
const src = "https://res.cloudinary.com/demo/image/upload/v1/ring.jpg";

describe("ProductImage", () => {
  it("renders responsive CDN candidates independently of Next image configuration", () => {
    render(<ProductImage src={src} alt="Ring" fill sizes="50vw" />);
    const image = screen.getByAltText("Ring");
    expect(image.getAttribute("src")).toContain("w_640,q_auto,f_auto");
    expect(image.getAttribute("srcset")).toContain("w_480,q_auto,f_auto/v1/ring.jpg 480w");
    expect(image.getAttribute("sizes")).toBe("50vw");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.style.position).toBe("absolute");
  });
  it("prioritizes the visible image and reserves explicit dimensions", () => {
    render(<ProductImage src={src} alt="Ring" width={64} height={64} priority />);
    const image = screen.getByAltText("Ring");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("fetchpriority")).toBe("high");
    expect(image.getAttribute("sizes")).toBe("64px");
    expect(image.getAttribute("width")).toBe("64");
  });
  it("keeps the existing Next path for another provider", () => {
    render(<ProductImage src="/ring.webp" alt="Ring" width={64} height={64} />);
    expect(screen.getByAltText("Ring").getAttribute("data-next-image")).toBe("true");
  });
});
