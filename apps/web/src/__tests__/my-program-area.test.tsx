import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MyProgramArea } from "@/components/participation/my-program-area";
import { listMySessionClosures } from "@/lib/participation/session-closure-api";
import { getMyProgram, listMyPrograms, ParticipationRequestError, type MyProgram } from "@/lib/participation/participation-api";
import { listMyProgramActivities, submitMyActivitySurvey,
  type AssignedActivity } from "@/lib/participation/activity-api";

vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(),
  getMyProgram: vi.fn(), listMyPrograms: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  listMyProgramActivities: vi.fn(), submitMyActivity: vi.fn(), submitMyActivitySurvey: vi.fn(),
}));

vi.mock("@/lib/participation/session-closure-api", () => ({ listMySessionClosures: vi.fn().mockResolvedValue({ items: [] }) }));

const program: MyProgram = {
  id: "program-a", organizationId: "org-a", organizationName: "Empresa A",
  name: "Tu historia, tu mayor diferencial", description: "Programa asignado", status: "ACTIVE",
  startDate: "2026-09-01", endDate: "2026-12-01", version: 0,
};
const page = { items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 };
const assignedActivity: AssignedActivity = { id: "activity-a", organizationId: "org-a",
  programId: "program-a", moduleId: "module-a", sessionId: "session-a",
  dimensionName: "Interior", dimensionPosition: 1, sessionName: "Autoconocimiento", sessionPosition: 1,
  title: "Reflexión inicial",
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
  vi.mocked(listMySessionClosures).mockResolvedValue({ items: [] });
  vi.mocked(listMyPrograms).mockResolvedValue(page);
  vi.mocked(getMyProgram).mockResolvedValue(program);
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [assignedActivity] });
  vi.mocked(submitMyActivitySurvey).mockResolvedValue({ evaluationId: "survey-a", status: "COMPLETED",
    completedAt: "2026-10-07T12:05:00Z" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); window.history.replaceState({}, "", "/"); });

async function openAssignedActivity() {
  const titles = await screen.findAllByText("Reflexión inicial", { exact: true });
  const summary = titles.map(element => element.closest("summary")).find(Boolean);
  expect(summary).not.toBeNull();
  expect(summary!.parentElement?.parentElement?.closest("details")).toBeNull();
  fireEvent.click(summary!);
  expect((summary!.parentElement as HTMLDetailsElement).open).toBe(true);
}

it("renders only the collaborator's returned programs with basic metadata", async () => {
  render(<MyProgramArea mode="list" />);
  expect((await screen.findByRole("link", { name: program.name })).getAttribute("href")).toBe("/my-programs/program-a");
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(screen.getByText("2026-09-01 — 2026-12-01")).toBeTruthy();
  expect(screen.getByText("Activo")).toBeTruthy();
  expect(listMyPrograms).toHaveBeenCalledWith(0, expect.any(AbortSignal));
  expect(screen.queryByText(/progreso/i)).toBeNull();
});

it("shows a preparation notice and never renders a draft's activity forms", async () => {
  vi.mocked(getMyProgram).mockResolvedValue({ ...program, status: "DRAFT" });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await screen.findByText(/Este programa está en preparación/);
  expect(screen.queryByText("Reflexión inicial")).toBeNull();
  expect(screen.queryByLabelText("Tu respuesta")).toBeNull();
});

it("keeps submitted work visible after closure but removes response and survey forms", async () => {
  vi.mocked(getMyProgram).mockResolvedValue({ ...program, status: "COMPLETED" });
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{ ...assignedActivity,
    assignmentStatus: "SUBMITTED", answers: [{ questionId: "question-3", values: ["Mi entrega conservada"] }], submittedAt: "2026-10-07T12:00:00Z",
    completionPercentage: 50, survey: { ...assignedActivity.survey!, status: "PENDING" } }] });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await screen.findByText(/Este programa ha finalizado/);
  await openAssignedActivity();
  expect(screen.getByText("Mi entrega conservada")).toBeTruthy();
  expect(screen.queryByLabelText("Tu respuesta")).toBeNull();
  expect(screen.queryByRole("form")).toBeNull();
  expect(screen.queryByLabelText("Tu próxima actividad")).toBeNull();
});

it("keeps a completed participation read-only in an otherwise active program without inflating progress", async () => {
  vi.mocked(getMyProgram).mockResolvedValue({ ...program, enrollmentStatus: "COMPLETED" });
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{ ...assignedActivity,
    assignmentStatus: "SUBMITTED", answers: [{ questionId: "question-3", values: ["Mi entrega conservada"] }], submittedAt: "2026-10-07T12:00:00Z",
    completionPercentage: 50, survey: { ...assignedActivity.survey!, status: "PENDING" } }] });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await screen.findByText(/Tu participación está completada/);await openAssignedActivity();
  expect(screen.getByText("Mi entrega conservada")).toBeTruthy();expect(screen.queryByRole("form")).toBeNull();
  expect(screen.queryByLabelText("Tu próxima actividad")).toBeNull();
  expect(submitMyActivitySurvey).not.toHaveBeenCalled();
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

it("lists activities directly and opens the full activity in one click without dimension or session dropdowns", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  expect((await screen.findAllByText("Reflexión inicial")).length).toBe(2);
  const list = screen.getByRole("list", { name: "Actividades de tu programa" });
  expect(within(list).getByText("Interior · Autoconocimiento")).toBeTruthy();
  expect(list.querySelectorAll("details")).toHaveLength(1);
  expect(list.querySelector("details")?.open).toBe(false);
  await openAssignedActivity();
  expect(screen.getByRole("link", { name: "Ver video en YouTube" }).getAttribute("href")).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(screen.getByTitle("Video de la actividad: Reflexión inicial").tagName).toBe("IFRAME");
  expect(screen.getByLabelText("Respuesta a ¿Qué aprendiste?").closest("details")?.open).toBe(true);
  expect(screen.queryByRole("heading", { name: "Progreso del programa" })).toBeNull();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it("opens the next activity directly and reopens it even when its shortcut was already used", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  const start = await screen.findByRole("link", { name: "Comenzar actividad" });
  expect(start.getAttribute("href")).toBe("#activity-activity-a");
  fireEvent.click(start);
  const response=screen.getByLabelText("Respuesta a ¿Qué aprendiste?");
  const details=response.closest("details")!;
  expect(details.open).toBe(true);
  expect(document.activeElement).toBe(details.querySelector("summary"));
  fireEvent.click(details.querySelector("summary")!);
  expect(details.open).toBe(false);
  fireEvent.click(start);
  expect(details.open).toBe(true);
});

it("does not offer a second activity survey after the form was submitted", async () => {
  vi.mocked(listMyProgramActivities).mockResolvedValue({items:[{...assignedActivity,assignmentStatus:"SUBMITTED",
    submittedAt:"2026-10-07T12:00:00Z",
    answers:[{questionId:"question-3",values:["Mi entrega"]}],completionPercentage:100,survey:{...assignedActivity.survey!,status:"COMPLETED"}}]});
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await openAssignedActivity();
  expect(screen.getByText("Mi entrega")).toBeTruthy();
  expect(screen.queryByRole("form")).toBeNull();
  expect(screen.queryByRole("link",{name:"Continuar encuesta"})).toBeNull();
});

it("highlights the first actionable activity in program structure order instead of due-date order", async () => {
  const firstPending = { ...assignedActivity, id: "activity-first", title: "Primera pendiente",
    dimensionPosition: 1, sessionPosition: 1, position: 2, dueDate: "2026-12-20" };
  const laterPending = { ...assignedActivity, id: "activity-later", moduleId: "module-b", sessionId: "session-b",
    dimensionName: "Exterior", dimensionPosition: 2, sessionName: "Proyección", sessionPosition: 1,
    title: "Pendiente posterior", position: 1, dueDate: "2026-09-20" };
  const completedFirst = { ...assignedActivity, id: "activity-completed", title: "Ya completada", position: 1,
    assignmentStatus: "COMPLETED" as const, completionPercentage: 100,
    survey: { ...assignedActivity.survey!, status: "COMPLETED" as const, completedAt: "2026-09-10T12:00:00Z" } };
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [laterPending, firstPending, completedFirst] });

  render(<MyProgramArea mode="activities" programId="program-a" />);

  const notice = await screen.findByRole("complementary", { name: "Tu próxima actividad" });
  expect(within(notice).getByText("Primera pendiente")).toBeTruthy();
  expect(within(notice).queryByText("Pendiente posterior")).toBeNull();
  expect(within(notice).getByText(/Después de esta tienes 1 actividad pendiente/)).toBeTruthy();
  const list=screen.getByRole("list",{name:"Actividades de tu programa"});
  expect(Array.from(list.children).map(item=>item.id)).toEqual(["activity-activity-completed","activity-activity-first","activity-activity-later"]);
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

it("requires all activity answers and submits them as the deliverable with its version", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  await openAssignedActivity();
  const form=screen.getByRole("form",{name:"Formulario de Encuesta de cierre"});
  fireEvent.submit(form);
  expect(submitMyActivitySurvey).not.toHaveBeenCalled();
  expect(screen.getByText("Responde todas las preguntas antes de enviar.")).toBeTruthy();
  const radios=within(form).getAllByRole("radio");
  fireEvent.click(radios[3]);fireEvent.click(radios[7]);
  fireEvent.change(within(form).getByLabelText("Respuesta a ¿Qué aprendiste?"),{target:{value:"Aprendí a reconocer mis fortalezas."}});
  fireEvent.click(within(form).getByRole("checkbox",{name:"Inspirado(a)"}));
  fireEvent.click(within(form).getByRole("button",{name:"Enviar actividad"}));
  await waitFor(()=>expect(submitMyActivitySurvey).toHaveBeenCalledWith("program-a","activity-a",[
    {questionId:"question-1",values:["4"]},{questionId:"question-2",values:["3"]},
    {questionId:"question-3",values:["Aprendí a reconocer mis fortalezas."]},{questionId:"question-4",values:["Inspirado(a)"]}
  ],0));
  await waitFor(()=>expect(screen.queryByRole("form")).toBeNull());
  expect(screen.getByText("Aprendí a reconocer mis fortalezas.")).toBeTruthy();
});

it("prefills a requested correction without permitting unsolicited resubmission", async () => {
  vi.mocked(listMyProgramActivities).mockResolvedValue({items:[{...assignedActivity,assignmentStatus:"CHANGES_REQUESTED",
    assignmentVersion:2,reviewComment:"Amplía tu ejemplo",answers:[{questionId:"question-3",values:["Mi respuesta original"]}]}]});
  render(<MyProgramArea mode="activities" programId="program-a" />);await openAssignedActivity();
  expect((screen.getByLabelText("Respuesta a ¿Qué aprendiste?") as HTMLTextAreaElement).value).toBe("Mi respuesta original");
  expect(screen.getByText(/Amplía tu ejemplo/)).toBeTruthy();
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
