import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn().mockResolvedValue({}) }));

describe("Home page", () => {
  it("presents the product and its current user journey", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Refleja Tu Interior" }),
    ).toBeDefined();
    expect(screen.getByText("Una experiencia compartida")).toBeDefined();
    expect((await screen.findByRole("link", { name: "Entrar a la plataforma" })).getAttribute("href")).toBe("/login");
    expect(document.querySelector('img[src*="RP_LOGO_PNG.png"]')).not.toBeNull();
  });
});
