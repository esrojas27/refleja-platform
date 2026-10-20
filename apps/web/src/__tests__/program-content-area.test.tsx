import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DimensionForm, ProgramContentArea, SessionForm } from "@/components/programs/program-content-area";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { listEnrollments } from "@/lib/participation/participation-api";
import { createProgramActivity, listProgramActivities, type ProgramActivity } from "@/lib/participation/activity-api";
import { createActivityEvaluation, listActivityEvaluations } from "@/lib/participation/evaluation-api";
import { createProgramDimension, createProgramSession, listProgramDimensions, type ProgramDimension } from "@/lib/programs/program-content-api";
import { archiveContent, deleteContent, duplicateActivity, editActivity, editDimension, editSession, editSurvey, moveContent } from "@/lib/programs/content-administration-api";
import { ActivityForm } from "@/components/programs/program-activity-area";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { ContentTools } from "@/components/programs/content-tools";
import { ProgramStateContext } from "@/components/programs/program-state-context";

vi.mock("@/lib/programs/content-administration-api", () => ({
  archiveContent: vi.fn(), deleteContent: vi.fn(), duplicateActivity: vi.fn(), editActivity: vi.fn(),
  editDimension: vi.fn(), editSession: vi.fn(), editSurvey: vi.fn(), moveContent: vi.fn(),
}));

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/programs/program-content-api", async original => ({
  ...await original<typeof import("@/lib/programs/program-content-api")>(),
  createProgramDimension: vi.fn(), createProgramSession: vi.fn(), listProgramDimensions: vi.fn(),
}));
vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(), listEnrollments: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  createProgramActivity: vi.fn(), listProgramActivities: vi.fn(),
}));
vi.mock("@/lib/participation/evaluation-api", async original => ({
  ...await original<typeof import("@/lib/participation/evaluation-api")>(),
  createActivityEvaluation: vi.fn(), listActivityEvaluations: vi.fn(),
}));

const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const dimensionData: ProgramDimension = { id: "module-a", organizationId: "org-a", programId: "program-a", name: "Fundamentos",
  description: "Contexto del proceso", position: 2, version: 0, sessions: [{ id: "session-a", organizationId: "org-a",
    programId: "program-a", dimensionId: "module-a", name: "Sesión inicial", objective: "Definir el punto de partida",
    scheduledDate: "2026-10-01", position: 3, version: 0 }] };
const activity: ProgramActivity = { id: "activity-a", organizationId: "org-a", programId: "program-a",
  moduleId: "module-a", sessionId: "session-a", dimensionName: "Fundamentos", dimensionPosition: 1,
  sessionName: "Sesión inicial", sessionPosition: 1,
  title: "Reflexión inicial", instructions: "Describe tu punto de partida.", youtubeUrl: null,
  dueDate: "2026-10-08", position: 1, version: 0, assignees: [] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramDimensions).mockResolvedValue({ items: [dimensionData] });
  vi.mocked(createProgramDimension).mockResolvedValue({ ...dimensionData, id: "new-module", position: 3, sessions: [] });
  vi.mocked(createProgramSession).mockResolvedValue({ ...dimensionData.sessions[0], id: "new-session", position: 4 });
  vi.mocked(listProgramActivities).mockResolvedValue({ items: [activity] });
  vi.mocked(listActivityEvaluations).mockResolvedValue({ items: [] });
  vi.mocked(listEnrollments).mockResolvedValue({ items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
  vi.mocked(createProgramActivity).mockResolvedValue({ ...activity, id: "new-activity", position: 2 });
  vi.mocked(createActivityEvaluation).mockResolvedValue({ id: "evaluation-a", organizationId: "org-a",
    programId: "program-a", activityId: "activity-a", title: "Encuesta de cierre", instructions: null, version: 0,
    questions: [{ id: "question-a", prompt: "¿Qué tan de acuerdo estás?", type: "AGREEMENT_SCALE", position: 1, version: 0 }] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders the ordered real dimension and session structure", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText("Fundamentos");
  expect(screen.getByText("Dimensión 2")).toBeTruthy();
  expect(screen.queryByText("Sesión inicial")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Fundamentos/, expanded: false }));
  expect(await screen.findByText("Sesión inicial")).toBeTruthy();
    expect(screen.getByText(/2026-10-01/)).toBeTruthy();
  expect(screen.queryByText("Reflexión inicial")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Sesión inicial/, expanded: false }));
  expect(await screen.findByText(/Definir el punto de partida/)).toBeTruthy();
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(listProgramDimensions).toHaveBeenCalledWith("org-a", "program-a", expect.any(AbortSignal), true);
});

it("appends dimensions using the next visible position", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Crear dimensión" }));
  const form = await screen.findByRole("form", { name: "Crear dimensión" });
  expect(screen.getByRole("dialog", { name: "Crear dimensión" })).toBeTruthy();
  fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Práctica" } });
  fireEvent.change(within(form).getByLabelText("Descripción opcional"), { target: { value: "Aplicación" } });
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramDimension).toHaveBeenCalledWith("org-a", "program-a",
    { name: "Práctica", description: "Aplicación", position: 3 }, expect.any(AbortSignal)));
});

it("appends sessions inside their module using the next visible position", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: /Fundamentos/, expanded: false }));
  fireEvent.click(screen.getByRole("button", { name: "Agregar sesión" }));
  const form = await screen.findByRole("form", { name: "Crear sesión" });
  expect(screen.getByRole("dialog", { name: "Agregar sesión" })).toBeTruthy();
  fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Segunda sesión" } });
  fireEvent.change(within(form).getByLabelText("Objetivo opcional"), { target: { value: "Practicar lo aprendido" } });
  fireEvent.change(within(form).getByLabelText("Fecha"), { target: { value: "2026-10-08" } });
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramSession).toHaveBeenCalledWith("org-a", "program-a", "module-a",
    { name: "Segunda sesión", objective: "Practicar lo aprendido", scheduledDate: "2026-10-08", position: 4 }, expect.any(AbortSignal)));
});

it("creates a visual post-activity evaluation with the four supported question types", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: /Fundamentos/, expanded: false }));
  fireEvent.click(screen.getByRole("button", { name: /Sesión inicial/, expanded: false }));
  fireEvent.click(await screen.findByRole("button", { name: "Crear encuesta" }));
  const form = await screen.findByRole("form", { name: "Crear encuesta" });
  expect(screen.getByRole("dialog", { name: "Crear encuesta" })).toBeTruthy();

  fireEvent.change(within(form).getByLabelText("Enunciado"), { target: { value: "¿Qué tan de acuerdo estás?" } });
  const add = within(form).getByRole("button", { name: "Agregar pregunta" });
  fireEvent.click(add); fireEvent.click(add); fireEvent.click(add);
  const prompts = within(form).getAllByLabelText("Enunciado");
  const types = within(form).getAllByLabelText("Tipo de respuesta");
  expect(Boolean(prompts[3].compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  fireEvent.change(prompts[1], { target: { value: "¿Qué tan probable es que lo apliques?" } });
  fireEvent.change(types[1], { target: { value: "LIKELIHOOD_SCALE" } });
  fireEvent.change(prompts[2], { target: { value: "¿Qué te llevas?" } });
  fireEvent.change(types[2], { target: { value: "OPEN_TEXT" } });
  fireEvent.change(prompts[3], { target: { value: "¿Cómo te sentiste?" } });
  fireEvent.change(types[3], { target: { value: "EMOTION_MULTI_SELECT" } });

  expect(within(form).getByText("Totalmente en desacuerdo")).toBeTruthy();
  expect(within(form).getByText("Muy probable")).toBeTruthy();
  expect(within(form).getByPlaceholderText("El colaborador escribirá aquí su respuesta")).toBeTruthy();
  expect(within(form).getByText("Inspirado(a)")).toBeTruthy();
  expect(within(form).getByText("Máximo 2")).toBeTruthy();
  fireEvent.submit(form);

  await waitFor(() => expect(createActivityEvaluation).toHaveBeenCalledWith("org-a", "program-a", "activity-a",
    expect.objectContaining({ questions: [
      { prompt: "¿Qué tan de acuerdo estás?", type: "AGREEMENT_SCALE", position: 1 },
      { prompt: "¿Qué tan probable es que lo apliques?", type: "LIKELIHOOD_SCALE", position: 2 },
      { prompt: "¿Qué te llevas?", type: "OPEN_TEXT", position: 3 },
      { prompt: "¿Cómo te sentiste?", type: "EMOTION_MULTI_SELECT", position: 4 },
    ] }), expect.any(AbortSignal)));
});

it("does not expose content or forms to a non-consultant", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Sólo un consultor autorizado/);
  expect(listProgramDimensions).not.toHaveBeenCalled();
  expect(screen.queryByRole("form")).toBeNull();
});

it("blocks duplicate dimension and session submissions", () => {
  vi.mocked(createProgramDimension).mockReturnValue(new Promise(() => {}));
  vi.mocked(createProgramSession).mockReturnValue(new Promise(() => {}));
  render(<><DimensionForm organizationId="org-a" programId="program-a" position={1} onSaved={vi.fn()} />
    <SessionForm organizationId="org-a" programId="program-a" dimensionId="module-a" position={1} onSaved={vi.fn()} /></>);
  const dimensionForm = screen.getByRole("form", { name: "Crear dimensión" });
  fireEvent.change(within(dimensionForm).getByLabelText("Nombre"), { target: { value: "Interior" } });
  fireEvent.submit(dimensionForm); fireEvent.submit(dimensionForm);
  const sessionForm = screen.getByRole("form", { name: "Crear sesión" });
  fireEvent.change(within(sessionForm).getByLabelText("Nombre"), { target: { value: "Sesión" } });
  fireEvent.change(within(sessionForm).getByLabelText("Fecha"), { target: { value: "2026-10-01" } });
  fireEvent.submit(sessionForm); fireEvent.submit(sessionForm);
  expect(createProgramDimension).toHaveBeenCalledTimes(1);
  expect(createProgramSession).toHaveBeenCalledTimes(1);
});

it("edits a dimension from a prefilled modal using the original version", async () => {
  vi.mocked(editDimension).mockResolvedValue();
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  const tools = await screen.findByRole("group", { name: "Administrar Fundamentos" });
  fireEvent.click(within(tools).getByRole("button", { name: "Editar" }));
  const form = await screen.findByRole("form", { name: "Editar dimensión" });
  expect((within(form).getByLabelText("Nombre") as HTMLInputElement).value).toBe("Fundamentos");
  fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Interior" } });
  fireEvent.submit(form);
  await waitFor(() => expect(editDimension).toHaveBeenCalledWith("org-a", "program-a", "module-a",
    expect.objectContaining({ name: "Interior", version: 0 }), expect.any(AbortSignal)));
  expect(createProgramDimension).not.toHaveBeenCalled();
});

it("edits a session objective without recreating it", async () => {
  vi.mocked(editSession).mockResolvedValue();
  render(<SessionForm organizationId="org-a" programId="program-a" dimensionId="module-a" position={3}
    initial={dimensionData.sessions[0]} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Objetivo opcional"), { target: { value: "Objetivo revisado" } });
  fireEvent.submit(screen.getByRole("form", { name: "Editar sesión" }));
  await waitFor(() => expect(editSession).toHaveBeenCalledWith("org-a", "program-a", "session-a",
    expect.objectContaining({ objective: "Objetivo revisado", version: 0 }), expect.any(AbortSignal)));
  expect(createProgramSession).not.toHaveBeenCalled();
});

it("protects delivered instructions but allows saving activity metadata", async () => {
  vi.mocked(editActivity).mockResolvedValue();
  const delivered = { ...activity, assignees: [{ submittedAt: "2026-10-19" }] } as ProgramActivity;
  render(<ActivityForm organizationId="org-a" programId="program-a" initial={delivered}
    sessions={[{ id: "session-a", label: "Sesión inicial" }]} enrollments={[]} activities={[delivered]} onSaved={vi.fn()} />);
  expect((screen.getByLabelText("Instrucciones") as HTMLTextAreaElement).readOnly).toBe(true);
  expect((screen.getByLabelText("Sesión") as HTMLSelectElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título corregido" } });
  fireEvent.submit(screen.getByRole("form", { name: "Editar actividad" }));
  await waitFor(() => expect(editActivity).toHaveBeenCalledWith("org-a", "program-a", "activity-a",
    expect.objectContaining({ title: "Título corregido", instructions: activity.instructions, version: 0 }), expect.any(AbortSignal)));
  expect(createProgramActivity).not.toHaveBeenCalled();
});

it("loads survey questions for correction and sends survey version", async () => {
  const survey = { id: "survey", organizationId: "org-a", programId: "program-a", activityId: "activity-a",
    title: "Encuesta", instructions: null, version: 3,
    questions: [{ id: "question", prompt: "Pregunta original", type: "OPEN_TEXT" as const, position: 1, version: 0 }] };
  vi.mocked(editSurvey).mockResolvedValue(survey);
  render(<ActivityEvaluationForm organizationId="org-a" programId="program-a" activityId="activity-a"
    activityTitle={activity.title} initial={survey} onSaved={vi.fn()} />);
  expect((screen.getByLabelText("Enunciado") as HTMLTextAreaElement).value).toBe("Pregunta original");
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: "Pregunta corregida" } });
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org-a", "program-a", "activity-a",
    expect.objectContaining({ version: 3, questions: [{ prompt: "Pregunta corregida", type: "OPEN_TEXT", position: 1 }] }), expect.any(AbortSignal)));
});

it("hides archived dimensions until explicitly requested", async () => {
  vi.mocked(listProgramDimensions).mockResolvedValue({ items: [{ ...dimensionData, archived: true }] });
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Todo el contenido está archivado/);
  expect(screen.queryByText("Fundamentos")).toBeNull();
  fireEvent.click(screen.getByLabelText("Mostrar archivados"));
  expect(await screen.findByText("Fundamentos")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
});

it("omits administration on closed programs", async () => {
  render(<ProgramStateContext.Provider value={{ canEdit: false, canExecute: false, update: vi.fn() }}>
    <ProgramContentArea organizationId="org-a" programId="program-a" />
  </ProgramStateContext.Provider>);
  await screen.findByText("Fundamentos");
  expect(screen.queryByRole("group", { name: "Administrar Fundamentos" })).toBeNull();
});

const toolsProps = { organizationId: "org-a", programId: "program-a", kind: "activities" as const,
  item: activity, hasAssignments: false, hasSubmissions: false, first: false, last: false,
  enrollments: [], onEdit: vi.fn(), onSaved: vi.fn() };
it("requires explicit confirmation before permanently deleting unassigned content", async () => {
  vi.mocked(deleteContent).mockResolvedValue();
  render(<ContentTools {...toolsProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  expect(deleteContent).not.toHaveBeenCalled();
  expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
  await waitFor(() => expect(deleteContent).toHaveBeenCalledWith("org-a", "program-a", "activities", "activity-a", 0));
});

it("disables deletion with assignments and archive with submissions", () => {
  render(<ContentTools {...toolsProps} hasAssignments hasSubmissions />);
  expect((screen.getByRole("button", { name: "Eliminar" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Archivar" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Duplicar" }) as HTMLButtonElement).disabled).toBe(false);
});

it("duplicates content without assignments by default", async () => {
  vi.mocked(duplicateActivity).mockResolvedValue({ id: "copy" });
  render(<ContentTools {...toolsProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
  expect((screen.getByLabelText("Preparar sin asignaciones") as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Crear copia" }));
  await waitFor(() => expect(duplicateActivity).toHaveBeenCalledWith("org-a", "program-a", "activity-a", 0, false, []));
});

it("sends move and restore actions with the current resource version", async () => {
  vi.mocked(moveContent).mockResolvedValue();
  const view = render(<ContentTools {...toolsProps} />);
  fireEvent.click(screen.getByRole("button", { name: "Bajar Reflexión inicial" }));
  await waitFor(() => expect(moveContent).toHaveBeenCalledWith("org-a", "program-a", "activities", "activity-a", 0, "DOWN"));
  view.unmount();
  vi.mocked(archiveContent).mockResolvedValue();
  render(<ContentTools {...toolsProps} item={{ ...activity, archived: true, version: 2 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
  await waitFor(() => expect(archiveContent).toHaveBeenCalledWith("org-a", "program-a", "activities", "activity-a", 2, false));
});
