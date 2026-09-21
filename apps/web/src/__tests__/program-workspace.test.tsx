import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgramWorkspace } from "@/components/programs/program-workspace";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/lib/auth/authenticated-api", () => ({ fetchCurrentIdentity: vi.fn() }));

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({
    cognitoSubject: "subject", user: { id: "user", email: "consultant@example.com", firstName: null, lastName: null },
    organizations: [], activeOrganizationId: "org-a", roles: ["CONSULTANT"],
  });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("offers only implemented program destinations and marks the overview as active", () => {
  usePathname.mockReturnValue("/organizations/org-a/programs/program-a");

  render(
    <ProgramWorkspace organizationId="org-a" programId="program-a">
      <p>Contenido real</p>
    </ProgramWorkspace>,
  );

  expect(screen.getByRole("navigation", { name: "Secciones del programa" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a");
  expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Colaboradores" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a/enrollments");
  expect(screen.getByRole("link", { name: "Contenido" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a/content");
  expect(screen.getByRole("link", { name: "Actividades" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a/activities");
  expect(screen.getByRole("link", { name: "Progreso" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a/progress");
  expect(screen.getByText("Contenido real")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /evaluaciones/i })).toBeNull();
});

it("marks progress as active", () => {
  usePathname.mockReturnValue("/organizations/org-a/programs/program-a/progress");
  render(<ProgramWorkspace organizationId="org-a" programId="program-a"><p>Progreso real</p></ProgramWorkspace>);
  expect(screen.getByRole("link", { name: "Progreso" }).getAttribute("aria-current")).toBe("page");
});

it("marks program content as active", () => {
  usePathname.mockReturnValue("/organizations/org-a/programs/program-a/content");
  render(<ProgramWorkspace organizationId="org-a" programId="program-a"><p>Contenido real</p></ProgramWorkspace>);
  expect(screen.getByRole("link", { name: "Contenido" }).getAttribute("aria-current")).toBe("page");
});

it("shows DISC only to authorized consultants and leaders", async () => {
  usePathname.mockReturnValue("/organizations/org-a/programs/program-a/disc");
  render(<ProgramWorkspace organizationId="org-a" programId="program-a"><p>Ficha</p></ProgramWorkspace>);
  expect((await screen.findByRole("link", { name: "DISC" })).getAttribute("aria-current")).toBe("page");

  cleanup();
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({
    cognitoSubject: "subject", user: { id: "user", email: "hr@example.com", firstName: null, lastName: null },
    organizations: [], activeOrganizationId: "org-a", roles: ["COMPANY_ADMIN"],
  });
  render(<ProgramWorkspace organizationId="org-a" programId="program-a"><p>Ficha</p></ProgramWorkspace>);
  await Promise.resolve();
  expect(screen.queryByRole("link", { name: "DISC" })).toBeNull();
});

it("marks collaborators as active and preserves encoded route segments", () => {
  usePathname.mockReturnValue("/organizations/org%20a/programs/program%2Fa/enrollments");

  render(
    <ProgramWorkspace organizationId="org a" programId="program/a">
      <p>Colaboradores</p>
    </ProgramWorkspace>,
  );

  expect(screen.getByRole("link", { name: "Colaboradores" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Todos los programas" }).getAttribute("href")).toBe("/organizations/org%20a/programs");
});
