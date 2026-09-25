import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ProgramProgressArea } from "@/components/programs/program-progress-area";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { listProgramActivities, type ProgramActivity } from "@/lib/participation/activity-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(), listProgramActivities: vi.fn(),
}));

const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const activity: ProgramActivity = { id: "activity-a", organizationId: "org-a", programId: "program-a",
  moduleId: "dimension-a", sessionId: "session-a", dimensionName: "Interior", dimensionPosition: 1,
  sessionName: "Autoconocimiento", sessionPosition: 1,
  title: "Reflexión inicial", instructions: "Describe", youtubeUrl: null, dueDate: "2020-01-01",
  position: 1, version: 0, assignees: [
    { assignmentId: "assignment-a", enrollmentId: "enrollment-a", email: "ana@example.test", firstName: "Ana",
      lastName: "Prueba", status: "SUBMITTED", responseText: "Mi avance", submittedAt: null,
      reviewComment: null, reviewedAt: null, surveyStatus: "PENDING", completionPercentage: 50, version: 1 },
    { assignmentId: "assignment-b", enrollmentId: "enrollment-b", email: "bea@example.test", firstName: "Bea",
      lastName: "Prueba", status: "COMPLETED", responseText: "Listo", submittedAt: null,
      reviewComment: null, reviewedAt: null, surveyStatus: "COMPLETED", completionPercentage: 100, version: 1 },
  ] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [activity] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders the consultant operational view by participant, dimension and session", async () => {
  render(<ProgramProgressArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByRole("heading", { name: "Avance por colaborador" })).toBeTruthy();
  expect(screen.getByText("Ana Prueba")).toBeTruthy();
  expect(screen.getByText("Bea Prueba")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Progreso por dimensión y sesión" })).toBeTruthy();
  expect(screen.getByText("Interior")).toBeTruthy();
  expect(screen.getByText("Autoconocimiento")).toBeTruthy();
  expect(listProgramActivities).toHaveBeenCalledWith("org-a", "program-a", expect.any(AbortSignal));
});

it("does not load operational data for a non-consultant", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["LEADER"] });
  render(<ProgramProgressArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText(/Sólo un consultor autorizado/)).toBeTruthy();
  expect(listProgramActivities).not.toHaveBeenCalled();
});

it("shows a safe authentication error", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(401));
  render(<ProgramProgressArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText(/Tu sesión no está disponible/)).toBeTruthy();
  await waitFor(() => expect(screen.queryByText("Ana Prueba")).toBeNull());
});
