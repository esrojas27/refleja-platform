import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProgramActivityArea } from "@/components/programs/program-activity-area";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { listEnrollments } from "@/lib/participation/participation-api";
import { createProgramActivity, listProgramActivities, type ProgramActivity } from "@/lib/participation/activity-api";
import { listProgramModules } from "@/lib/programs/program-content-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(), listEnrollments: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  createProgramActivity: vi.fn(), listProgramActivities: vi.fn(),
}));
vi.mock("@/lib/programs/program-content-api", async original => ({
  ...await original<typeof import("@/lib/programs/program-content-api")>(), listProgramModules: vi.fn(),
}));

const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"] }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const enrollment = { id: "enrollment-a", organizationId: "org-a", programId: "program-a", status: "ACTIVE" as const,
  participant: { userId: "user-a", membershipId: "membership-a", email: "ana@example.test", firstName: "Ana", lastName: "Prueba" }, invitation: null };
const activity: ProgramActivity = { id: "activity-a", organizationId: "org-a", programId: "program-a", moduleId: "module-a",
  sessionId: "session-a", title: "Reflexión inicial", instructions: "Describe tu punto de partida.", dueDate: "2026-10-08",
  position: 1, version: 0, assignees: [{ enrollmentId: "enrollment-a", email: "ana@example.test", firstName: "Ana", lastName: "Prueba" }] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramModules).mockResolvedValue({ items: [{ id: "module-a", organizationId: "org-a", programId: "program-a",
    name: "Fundamentos", description: null, position: 1, version: 0, sessions: [{ id: "session-a", organizationId: "org-a",
      programId: "program-a", moduleId: "module-a", name: "Sesión inicial", description: null,
      scheduledDate: "2026-10-01", position: 1, version: 0 }] }] });
  vi.mocked(listEnrollments).mockResolvedValue({ items: [enrollment], page: 0, size: 100, totalElements: 1, totalPages: 1 });
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [activity] });
  vi.mocked(createProgramActivity).mockResolvedValue({ ...activity, id: "activity-new", position: 2 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders real sessions, assignments and existing activities", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(screen.getByText(/Fundamentos · Sesión inicial · Actividad 1/)).toBeTruthy();
  expect(screen.getByText(/Asignada a: Ana Prueba/)).toBeTruthy();
  expect(listEnrollments).toHaveBeenCalledWith("org-a", "program-a", 0, expect.any(AbortSignal), 100);
});

it("creates the next activity in a session for selected active enrollments", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  const form = await screen.findByRole("form", { name: "Crear actividad" });
  fireEvent.change(within(form).getByLabelText("Título"), { target: { value: "Práctica consciente" } });
  fireEvent.change(within(form).getByLabelText("Instrucciones"), { target: { value: "Registra tres hallazgos" } });
  fireEvent.change(within(form).getByLabelText("Fecha límite"), { target: { value: "2026-10-15" } });
  fireEvent.click(within(form).getByLabelText(/Ana Prueba/));
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramActivity).toHaveBeenCalledWith("org-a", "program-a", {
    sessionId: "session-a", title: "Práctica consciente", instructions: "Registra tres hallazgos",
    dueDate: "2026-10-15", position: 2, enrollmentIds: ["enrollment-a"],
  }, expect.any(AbortSignal)));
});

it("does not expose management data to a non-consultant", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  vi.mocked(listProgramActivities).mockClear();
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Sólo un consultor autorizado/);
  expect(listProgramActivities).not.toHaveBeenCalled();
  expect(screen.queryByRole("form")).toBeNull();
});
