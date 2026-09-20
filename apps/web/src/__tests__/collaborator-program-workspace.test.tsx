import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CollaboratorProgramWorkspace } from "@/components/participation/collaborator-program-workspace";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("offers a compact collaborator workspace and marks the summary as active", () => {
  usePathname.mockReturnValue("/my-programs/program-a");
  render(<CollaboratorProgramWorkspace programId="program-a"><p>Resumen real</p></CollaboratorProgramWorkspace>);
  expect(screen.getByRole("navigation", { name: "Secciones de tu programa" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Actividades" }).getAttribute("href")).toBe("/my-programs/program-a/activities");
  expect(screen.getByRole("link", { name: "Mis programas" }).getAttribute("href")).toBe("/my-programs");
  expect(screen.getByText("Resumen real")).toBeTruthy();
});

it("marks activities as active and preserves encoded identifiers", () => {
  usePathname.mockReturnValue("/my-programs/program%2Fa/activities");
  render(<CollaboratorProgramWorkspace programId="program/a"><p>Trabajo real</p></CollaboratorProgramWorkspace>);
  expect(screen.getByRole("link", { name: "Actividades" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("href")).toBe("/my-programs/program%2Fa");
});
