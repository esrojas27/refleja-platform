import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProgramActivityArea } from "@/components/programs/program-activity-area";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { listEnrollments } from "@/lib/participation/participation-api";
import { createProgramActivity, listProgramActivities, reviewActivityAssignment,
  type ProgramActivity } from "@/lib/participation/activity-api";
import { listProgramDimensions } from "@/lib/programs/program-content-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(), listEnrollments: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  createProgramActivity: vi.fn(), listProgramActivities: vi.fn(), reviewActivityAssignment: vi.fn(),
}));
vi.mock("@/lib/programs/program-content-api", async original => ({
  ...await original<typeof import("@/lib/programs/program-content-api")>(), listProgramDimensions: vi.fn(),
}));

const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const enrollment = { id: "enrollment-a", organizationId: "org-a", programId: "program-a", status: "ACTIVE" as const,
  participant: { userId: "user-a", membershipId: "membership-a", email: "ana@example.test", firstName: "Ana", lastName: "Prueba" }, invitation: null };
const activity: ProgramActivity = { id: "activity-a", organizationId: "org-a", programId: "program-a", moduleId: "module-a",
  sessionId: "session-a", dimensionName: "Fundamentos", dimensionPosition: 1,
  sessionName: "Sesión inicial", sessionPosition: 1,
  title: "Reflexión inicial", instructions: "Describe tu punto de partida.",
  youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", dueDate: "2026-10-08",
  position: 1, version: 0, assignees: [{ assignmentId: "assignment-a", enrollmentId: "enrollment-a",
    email: "ana@example.test", firstName: "Ana", lastName: "Prueba", status: "SUBMITTED", responseText: "Mi avance",
    submittedAt: "2026-10-07T12:00:00Z", reviewComment: null, reviewedAt: null,
    surveyStatus: "COMPLETED", completionPercentage: 100, version: 1 }] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramDimensions).mockResolvedValue({ items: [{ id: "module-a", organizationId: "org-a", programId: "program-a",
    name: "Fundamentos", description: null, position: 1, version: 0, sessions: [{ id: "session-a", organizationId: "org-a",
      programId: "program-a", dimensionId: "module-a", name: "Sesión inicial", objective: "Definir el punto de partida",
      scheduledDate: "2026-10-01", position: 1, version: 0 }] }] });
  vi.mocked(listEnrollments).mockResolvedValue({ items: [enrollment], page: 0, size: 100, totalElements: 1, totalPages: 1 });
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [activity] });
  vi.mocked(createProgramActivity).mockResolvedValue({ ...activity, id: "activity-new", position: 2 });
  vi.mocked(reviewActivityAssignment).mockResolvedValue({ ...activity.assignees[0], status: "COMPLETED" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders real sessions, assignments and existing activities", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(screen.getByText(/Fundamentos · Sesión inicial · Actividad 1/)).toBeTruthy();
  expect(screen.getByText("En revisión: 1")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Revisar actividades (1)" })).toBeTruthy();
  expect(screen.queryByRole("form", { name: "Crear actividad" })).toBeNull();
  expect(screen.getByRole("link", { name: "Ver video en YouTube" }).getAttribute("href")).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(listEnrollments).toHaveBeenCalledWith("org-a", "program-a", 0, expect.any(AbortSignal), 100);
});

it("assigns the next activity to every active enrollment by default", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Crear y asignar" }));
  const form = await screen.findByRole("form", { name: "Crear actividad" });
  expect(screen.getByRole("dialog", { name: "Crear y asignar" })).toBeTruthy();
  fireEvent.change(within(form).getByLabelText("Título"), { target: { value: "Práctica consciente" } });
  fireEvent.change(within(form).getByLabelText("Instrucciones"), { target: { value: "Registra tres hallazgos" } });
  fireEvent.change(within(form).getByLabelText("Video de YouTube (opcional)"), { target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } });
  fireEvent.change(within(form).getByLabelText("Fecha límite"), { target: { value: "2026-10-15" } });
  expect(within(form).queryByLabelText(/Ana Prueba/)).toBeNull();
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramActivity).toHaveBeenCalledWith("org-a", "program-a", {
    sessionId: "session-a", title: "Práctica consciente", instructions: "Registra tres hallazgos",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", dueDate: "2026-10-15",
    position: 2, assignToAll: true, enrollmentIds: [],
  }, expect.any(AbortSignal)));
});

it("highlights every missing required field and focuses the first one", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Crear y asignar" }));
  const form = await screen.findByRole("form", { name: "Crear actividad" });
  fireEvent.submit(form);

  expect(await within(form).findByText("Escribe el título de la actividad.")).toBeTruthy();
  expect(within(form).getByText("Escribe las instrucciones que debe seguir el colaborador.")).toBeTruthy();
  expect(within(form).getByText("Selecciona la fecha límite.")).toBeTruthy();
  expect(within(form).getByLabelText("Título").getAttribute("aria-invalid")).toBe("true");
  expect(within(form).getByLabelText("Instrucciones").getAttribute("aria-invalid")).toBe("true");
  expect(within(form).getByLabelText("Fecha límite").getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(within(form).getByLabelText("Título")));
  expect(createProgramActivity).not.toHaveBeenCalled();

  fireEvent.change(within(form).getByLabelText("Instrucciones"), { target: { value: "Registra tus hallazgos" } });
  expect(within(form).queryByText("Escribe las instrucciones que debe seguir el colaborador.")).toBeNull();
  expect(within(form).getByLabelText("Instrucciones").getAttribute("aria-invalid")).toBeNull();
});

it("reveals individual collaborators when assigning to everyone is disabled", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Crear y asignar" }));
  const form = await screen.findByRole("form", { name: "Crear actividad" });
  fireEvent.click(within(form).getByRole("checkbox", { name: /^Asignar a todos los colaboradores activos/ }));
  fireEvent.change(within(form).getByLabelText("Título"), { target: { value: "Práctica individual" } });
  fireEvent.change(within(form).getByLabelText("Instrucciones"), { target: { value: "Describe tu caso" } });
  fireEvent.change(within(form).getByLabelText("Fecha límite"), { target: { value: "2026-10-15" } });
  fireEvent.click(within(form).getByLabelText(/Ana Prueba/));
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramActivity).toHaveBeenCalledWith("org-a", "program-a",
    expect.objectContaining({ assignToAll: false, enrollmentIds: ["enrollment-a"] }), expect.any(AbortSignal)));
});

it("creates program content even when there are no active enrollments", async () => {
  vi.mocked(listEnrollments).mockResolvedValue({ items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
  vi.mocked(createProgramActivity).mockResolvedValue({ ...activity, id: "activity-template", assignees: [] });
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Crear actividad" }));
  const form = await screen.findByRole("form", { name: "Crear actividad" });
  expect(within(form).getByText(/Puedes preparar esta actividad sin participantes/)).toBeTruthy();
  expect(within(form).queryByRole("group", { name: "Destinatarios" })).toBeNull();
  fireEvent.change(within(form).getByLabelText("Título"), { target: { value: "Actividad de plantilla" } });
  fireEvent.change(within(form).getByLabelText("Instrucciones"), { target: { value: "Contenido predefinido" } });
  fireEvent.change(within(form).getByLabelText("Fecha límite"), { target: { value: "2026-10-15" } });
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramActivity).toHaveBeenCalledWith("org-a", "program-a",
    expect.objectContaining({ assignToAll: true, enrollmentIds: [] }), expect.any(AbortSignal)));
});

it("lets the consultant approve a submitted response", async () => {
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar actividades (1)" }));
  expect(await screen.findByText("Mi avance")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Comentario de revisión"), { target: { value: "Buen trabajo" } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar actividad" }));
  await waitFor(() => expect(reviewActivityAssignment).toHaveBeenCalledWith("org-a", "program-a", "activity-a",
    "assignment-a", { decision: "APPROVE", comment: "Buen trabajo" }));
});

it("states clearly when the review queue is empty", async () => {
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [{
    ...activity, assignees: [{ ...activity.assignees[0], status: "ASSIGNED", responseText: null }],
  }] });
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText("No hay actividades pendientes por revisar.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Revisar actividades \(/ })).toBeNull();
});

it("keeps a submitted activity out of review until its survey is complete", async () => {
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [{ ...activity, assignees: [{
    ...activity.assignees[0], surveyStatus: "PENDING", completionPercentage: 50,
  }] }] });
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText(/1 entrega espera que se complete la encuesta/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Revisar actividades \(/ })).toBeNull();
  expect(screen.getByText("Encuestas pendientes: 1")).toBeTruthy();
});

it("does not expose management data to a non-consultant", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  vi.mocked(listProgramActivities).mockClear();
  render(<ProgramActivityArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Sólo un consultor autorizado/);
  expect(listProgramActivities).not.toHaveBeenCalled();
  expect(screen.queryByRole("form")).toBeNull();
});
