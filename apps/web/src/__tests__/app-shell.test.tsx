import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/app-shell";

describe("Authenticated app shell", () => {
  it("keeps the current product areas reachable with accessible navigation", () => {
    render(<AppShell><h1>Contenido de prueba</h1></AppShell>);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Cuenta" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: "Mis programas" }).getAttribute("href")).toBe("/my-programs");
    expect(screen.getByRole("link", { name: "Invitaciones" }).getAttribute("href")).toBe("/invitations");
    expect(screen.getByRole("main").getAttribute("id")).toBe("contenido-principal");
  });
});
