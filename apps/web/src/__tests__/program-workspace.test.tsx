import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgramWorkspace } from "@/components/programs/program-workspace";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

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
  expect(screen.getByText("Contenido real")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /actividades/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /progreso/i })).toBeNull();
  expect(screen.queryByRole("link", { name: /evaluaciones/i })).toBeNull();
});

it("marks program content as active", () => {
  usePathname.mockReturnValue("/organizations/org-a/programs/program-a/content");
  render(<ProgramWorkspace organizationId="org-a" programId="program-a"><p>Contenido real</p></ProgramWorkspace>);
  expect(screen.getByRole("link", { name: "Contenido" }).getAttribute("aria-current")).toBe("page");
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
