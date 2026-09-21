import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";

const { fetchCurrentIdentity } = vi.hoisted(() => ({ fetchCurrentIdentity: vi.fn() }));

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(),
  fetchCurrentIdentity,
}));

describe("Authenticated app shell", () => {
  beforeEach(() => {
    fetchCurrentIdentity.mockReset();
    fetchCurrentIdentity.mockResolvedValue({
      cognitoSubject: "subject",
      user: { id: "user", email: "consultant@example.test", firstName: "Ana", lastName: "Prueba" },
      organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" }],
      activeOrganizationId: "org-a",
      roles: ["CONSULTANT"],
    });
  });
  afterEach(cleanup);

  it("keeps shared product areas reachable and hides collaborator programs from a consultant", async () => {
    render(<AppShell><h1>Contenido de prueba</h1></AppShell>);

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Cuenta" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: "Invitaciones" }).getAttribute("href")).toBe("/invitations");
    expect(screen.getByRole("main").getAttribute("id")).toBe("contenido-principal");
    await waitFor(() => expect(fetchCurrentIdentity).toHaveBeenCalledOnce());
    expect(screen.queryByRole("link", { name: "Mis programas" })).toBeNull();
  });

  it("offers Mis programas when the user has a collaborator membership", async () => {
    fetchCurrentIdentity.mockResolvedValue({
      cognitoSubject: "subject",
      user: { id: "user", email: "collaborator@example.test", firstName: "Ana", lastName: "Prueba" },
      organizations: [{ id: "org-a", name: "Empresa A", roles: ["COLLABORATOR"], profileStatus: "COMPLETE" }],
      activeOrganizationId: "org-a",
      roles: ["COLLABORATOR"],
    });

    render(<AppShell><h1>Contenido de prueba</h1></AppShell>);

    expect((await screen.findByRole("link", { name: "Mis programas" })).getAttribute("href")).toBe("/my-programs");
  });
});
