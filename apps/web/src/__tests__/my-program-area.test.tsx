import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MyProgramArea } from "@/components/participation/my-program-area";
import { getMyProgram, listMyPrograms, ParticipationRequestError, type MyProgram } from "@/lib/participation/participation-api";
import { listMyProgramActivities, submitMyActivity, submitMyActivitySurvey,
  type AssignedActivity } from "@/lib/participation/activity-api";

vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(),
  getMyProgram: vi.fn(), listMyPrograms: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  listMyProgramActivities: vi.fn(), submitMyActivity: vi.fn(), submitMyActivitySurvey: vi.fn(),
}));

const program: MyProgram = {
  id: "program-a", organizationId: "org-a", organizationName: "Empresa A",
  name: "Tu historia, tu mayor diferencial", description: "Programa asignado", status: "DRAFT",
  startDate: "2026-09-01", endDate: "2026-12-01", version: 0,
};
const page = { items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 };
const assignedActivity: AssignedActivity = { id: "activity-a", organizationId: "org-a",
  programId: "program-a", moduleId: "module-a", sessionId: "session-a",
  dimensionName: "Interior", sessionName: "Autoconocimiento", title: "Reflexión inicial",
  instructions: "Describe tu punto de partida.", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
  dueDate: "2026-10-08", position: 1, version: 0,
  assignmentId: "assignment-a", assignmentStatus: "ASSIGNED", responseText: null, submittedAt: null,
  reviewComment: null, reviewedAt: null, assignmentVersion: 0, completionPercentage: 0,
  survey: { id: "survey-a", title: "Encuesta de cierre", instructions: "Cuéntanos tu experiencia.",
    status: "LOCKED", completedAt: null, questions: [
      { id: "question-1", prompt: "¿Qué tan de acuerdo estás?", type: "AGREEMENT_SCALE", position: 1 },
      { id: "question-2", prompt: "¿Qué tan probable es que lo apliques?", type: "LIKELIHOOD_SCALE", position: 2 },
      { id: "question-3", prompt: "¿Qué aprendiste?", type: "OPEN_TEXT", position: 3 },
      { id: "question-4", prompt: "¿Cómo te sentiste?", type: "EMOTION_MULTI_SELECT", position: 4 },
    ] } };

beforeEach(() => {
  vi.mocked(listMyPrograms).mockResolvedValue(page);
  vi.mocked(getMyProgram).mockResolvedValue(program);
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [assignedActivity] });
  vi.mocked(submitMyActivity).mockResolvedValue({ ...assignedActivity, assignmentStatus: "SUBMITTED",
    responseText: "Mi reflexión", submittedAt: "2026-10-07T12:00:00Z", assignmentVersion: 1,
    completionPercentage: 50, survey: { ...assignedActivity.survey!, status: "PENDING" } });
  vi.mocked(submitMyActivitySurvey).mockResolvedValue({ evaluationId: "survey-a", status: "COMPLETED",
    completedAt: "2026-10-07T12:05:00Z" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

async function openAssignedActivity() {
  await screen.findByText("Interior", { exact: true });
  for (const label of ["Interior", "Autoconocimiento", "Reflexión inicial"]) {
    const summary = screen.getByText(label, { exact: true }).closest("summary");
    expect(summary).not.toBeNull();
    fireEvent.click(summary!);
    expect((summary!.parentElement as HTMLDetailsElement).open).toBe(true);
  }
}

it("renders only the collaborator's returned programs with basic metadata", async () => {
  render(<MyProgramArea mode="list" />);
  expect((await screen.findByRole("link", { name: program.name })).getAttribute("href")).toBe("/my-programs/program-a");
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(screen.getByText("2026-09-01 — 2026-12-01")).toBeTruthy();
  expect(screen.getByText("DRAFT")).toBeTruthy();
  expect(listMyPrograms).toHaveBeenCalledWith(0, expect.any(AbortSignal));
  expect(screen.queryByText(/progreso/i)).toBeNull();
});

it("opens the program summary with progress without requesting participant identifiers", async () => {
  render(<MyProgramArea mode="summary" programId="program-a" />);
  expect(await screen.findByText("Programa asignado")).toBeTruthy();
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(getMyProgram).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
  expect(await screen.findByRole("heading", { name: "Progreso del programa" })).toBeTruthy();
  expect(screen.queryByText("Reflexión inicial")).toBeNull();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it("shows assigned work only in the activities section", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(screen.getByText("Interior", { exact: true }).closest("details")?.open).toBe(false);
  expect(screen.getByText("Autoconocimiento", { exact: true }).closest("details")?.open).toBe(false);
  await openAssignedActivity();
  expect(screen.getByRole("link", { name: "Ver video en YouTube" }).getAttribute("href")).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(screen.queryByRole("heading", { name: "Progreso del programa" })).toBeNull();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it("shows overdue as a visual activity label without replacing its workflow state", async () => {
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{
    ...assignedActivity,
    dueDate: "2020-01-01", assignmentStatus: "CHANGES_REQUESTED",
  }] });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await openAssignedActivity();
  expect(await screen.findByText("Requiere cambios")).toBeTruthy();
  expect(screen.getByText("Vencida")).toBeTruthy();
});

it("lets the collaborator complete an assigned activity with a textual response", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await openAssignedActivity();
  fireEvent.change(await screen.findByLabelText("Tu respuesta"), { target: { value: " Mi reflexión " } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar actividad (50%)" }));
  await waitFor(() => expect(submitMyActivity).toHaveBeenCalledWith("program-a", "activity-a", "Mi reflexión"));
  expect(within(screen.getByLabelText("Estado de la actividad")).getByText("En revisión")).toBeTruthy();
  expect(screen.getByText("Encuesta pendiente")).toBeTruthy();
  expect(await screen.findByRole("form", { name: "Completar encuesta de Encuesta de cierre" })).toBeTruthy();
});

it("completes the remaining 50% when the collaborator answers the survey", async () => {
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{ ...assignedActivity,
    assignmentStatus: "SUBMITTED", responseText: "Mi reflexión", submittedAt: "2026-10-07T12:00:00Z",
    completionPercentage: 50, survey: { ...assignedActivity.survey!, status: "PENDING" } }] });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await openAssignedActivity();
  const form = await screen.findByRole("form", { name: "Completar encuesta de Encuesta de cierre" });
  const radios = within(form).getAllByRole("radio");
  fireEvent.click(radios[3]);
  fireEvent.click(radios[7]);
  fireEvent.change(within(form).getByLabelText("Respuesta a ¿Qué aprendiste?"),
    { target: { value: "Aprendí a reconocer mis fortalezas." } });
  fireEvent.click(within(form).getByRole("checkbox", { name: "Inspirado(a)" }));
  fireEvent.click(within(form).getByRole("button", { name: "Enviar encuesta" }));
  await waitFor(() => expect(submitMyActivitySurvey).toHaveBeenCalledWith("program-a", "activity-a", [
    { questionId: "question-1", values: ["4"] },
    { questionId: "question-2", values: ["3"] },
    { questionId: "question-3", values: ["Aprendí a reconocer mis fortalezas."] },
    { questionId: "question-4", values: ["Inspirado(a)"] },
  ]));
  expect(screen.getByText("Encuesta completada. Cumpliste los dos pasos de la actividad.")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Avance de Reflexión inicial: 100%" })).toBeTruthy();
});

it.each([
  [401, "Tu sesión no está disponible"],
  [403, "No tienes acceso activo como colaborador"],
  [404, "El programa no está disponible para esta cuenta"],
])("shows the safe state for HTTP %s", async (status, message) => {
  vi.mocked(listMyPrograms).mockRejectedValue(new ParticipationRequestError(status));
  render(<MyProgramArea mode="list" />);
  expect(await screen.findByText(new RegExp(message))).toBeTruthy();
  expect(screen.queryByText(program.name)).toBeNull();
});

it("paginates only through the self-service API", async () => {
  vi.mocked(listMyPrograms).mockResolvedValueOnce({ ...page, totalElements: 21, totalPages: 2 });
  render(<MyProgramArea mode="list" />);
  fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(listMyPrograms).toHaveBeenLastCalledWith(1, expect.any(AbortSignal)));
});

it("aborts and discards delayed list data after unmount", async () => {
  let resolve!: (value: typeof page) => void;
  vi.mocked(listMyPrograms).mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<MyProgramArea mode="list" />);
  await waitFor(() => expect(listMyPrograms).toHaveBeenCalledOnce());
  const signal = vi.mocked(listMyPrograms).mock.calls[0][1]!;
  view.unmount();
  await act(async () => resolve(page));
  expect(signal.aborted).toBe(true);
});
