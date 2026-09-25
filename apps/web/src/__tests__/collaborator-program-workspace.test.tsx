import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CollaboratorProgramWorkspace } from "@/components/participation/collaborator-program-workspace";
import { listMyProgramActivities, type AssignedActivity } from "@/lib/participation/activity-api";

const { usePathname, listActivities } = vi.hoisted(() => ({ usePathname: vi.fn(), listActivities: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  listMyProgramActivities: listActivities,
}));

beforeEach(() => { vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [] }); });
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

it("shows how many assigned activities still require collaborator action", async () => {
  const pending: AssignedActivity = {
    id: "activity-a", organizationId: "org-a", programId: "program-a", moduleId: "dimension-a",
    sessionId: "session-a", dimensionName: "Interior", dimensionPosition: 1,
    sessionName: "Autoconocimiento", sessionPosition: 1, title: "Reflexión inicial",
    instructions: "Responde.", youtubeUrl: null, dueDate: "2026-10-01", position: 1, version: 0,
    assignmentId: "assignment-a", assignmentStatus: "ASSIGNED", responseText: null, submittedAt: null,
    reviewComment: null, reviewedAt: null, assignmentVersion: 0, survey: null, completionPercentage: 0,
  };
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [pending] });
  usePathname.mockReturnValue("/my-programs/program-a/activities");

  render(<CollaboratorProgramWorkspace programId="program-a"><p>Trabajo real</p></CollaboratorProgramWorkspace>);

  expect(await screen.findByLabelText("1 actividad pendiente")).toBeTruthy();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});
