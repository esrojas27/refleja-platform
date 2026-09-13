import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page", () => {
  it("presents the product and its current user journey", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Refleja Tu Interior" }),
    ).toBeDefined();
    expect(screen.getByText("Una experiencia compartida")).toBeDefined();
    expect(screen.getByRole("link", { name: "Entrar a la plataforma" }).getAttribute("href")).toBe("/login");
  });
});
