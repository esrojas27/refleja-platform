import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page", () => {
  it("renders the web bootstrap content", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Refleja Tu Interior" }),
    ).toBeDefined();
    expect(screen.getByText("Frontend preparado")).toBeDefined();
  });
});
