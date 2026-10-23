import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProgramSurveyResultsArea } from "@/components/programs/program-survey-results-area";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { exportSurveyResults, getSurveyResults, SurveyResultsRequestError, type SurveyResults } from "@/lib/participation/survey-results-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/participation/survey-results-api", async original => ({
  ...await original<typeof import("@/lib/participation/survey-results-api")>(), getSurveyResults: vi.fn(), exportSurveyResults: vi.fn(),
}));
const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const summary = { surveyCount: 1, assignedCount: 2, responseCount: 1, pendingCount: 1, participantCount: 2,
  respondentCount: 1, responseRate: 50, agreementAverage: 4, agreementAnswers: 1, likelihoodAverage: null, likelihoodAnswers: 0 };
const activity = { id: "a", title: "Reflexión", dimensionId: "d", dimensionName: "Interior", sessionId: "s", sessionName: "Sesión uno" };
const report: SurveyResults = { programId: "p", programName: "Programa de prueba", generatedAt: "2026-10-19T12:00:00Z",
  scope: { dimensionId: null, sessionId: null, activityId: null },
  options: [activity, { ...activity, id: "a2", title: "Escucha", dimensionId: "d2", dimensionName: "Social", sessionId: "s2", sessionName: "Sesión dos" }],
  summary, dimensions: [{ id: "d", name: "Interior", context: "", summary }],
  sessions: [{ id: "s", name: "Sesión uno", context: "Interior", summary }],
  activities: [{ id: "a", name: "Reflexión", context: "Interior · Sesión uno", summary }],
  surveys: [{ id: "survey", title: "Encuesta de experiencia", activity, summary,
    questions: [{ id: "q1", prompt: "¿Estás de acuerdo?", type: "AGREEMENT_SCALE", position: 1, responseCount: 1, average: 4,
      distribution: [{ value: "4", label: "De acuerdo", count: 1, percentage: 100 }] },
    { id: "q2", prompt: "¿Qué aprendiste?", type: "OPEN_TEXT", position: 2, responseCount: 1, average: null, distribution: [] },
    { id: "q3", prompt: "¿Cómo te sientes?", type: "EMOTION_MULTI_SELECT", position: 3, responseCount: 1, average: null,
      distribution: [{ value: "Inspirado(a)", label: "Inspirado(a)", count: 1, percentage: 100 }] }],
    responses: [{ responseId: "r", enrollmentId: "e", name: "Ana", email: "ana@example.test", completedAt: "2026-10-19T12:00:00Z",
      answers: [{ questionId: "q1", values: ["4"] }, { questionId: "q2", values: ["Aprendí <script>texto</script>"] }, { questionId: "q3", values: ["Inspirado(a)"] }] }] }] };
beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(getSurveyResults).mockResolvedValue(report);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders real summaries, distributions, emotions and escaped open responses", async () => {
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  await screen.findByText(/Programa de prueba/);
  fireEvent.click(screen.getByText("Reflexión", { selector: "span" }));
  expect(await screen.findByRole("heading", { name: "1. ¿Estás de acuerdo?" })).toBeTruthy();
  expect(screen.getByText(/Media 4 \/ 5/)).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "De acuerdo: 1 respuestas" })).toBeTruthy();
  expect(screen.getByText(/la suma puede superar el 100%/)).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Pregunta 2: ¿Qué aprendiste?" })).getByText("Aprendí <script>texto</script>")).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByText("Respuestas por participante (1)"));
  expect(screen.getByText("4 · De acuerdo")).toBeTruthy();
});

it("shows numeric scale distribution and answers as bare numbers with a per-question average", async () => {
  const numeric = { ...report, summary: { ...summary, agreementAverage: null, agreementAnswers: 0 },
    surveys: [{ ...report.surveys[0], questions: [{ id: "q1", prompt: "Nivel alcanzado", type: "NUMERIC_SCALE" as const,
      position: 1, responseCount: 1, average: 4,
      distribution: ["1","2","3","4","5"].map(value=>({value,label:value,count:value==="4"?1:0,percentage:value==="4"?100:0})) }] }] };
  vi.mocked(getSurveyResults).mockResolvedValue(numeric);
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  fireEvent.click(await screen.findByText("Reflexión", { selector: "span" }));
  const article=screen.getByRole("article",{name:"Pregunta 1: Nivel alcanzado"});
  expect(within(article).getByText(/Media 4 \/ 5/)).toBeTruthy();
  expect(within(article).getByRole("progressbar",{name:"4: 1 respuestas"})).toBeTruthy();
  expect(within(article).getByText("4")).toBeTruthy();
  expect(within(article).queryByText("4. 4")).toBeNull();
  expect(within(article).queryByText(/De acuerdo|probable/)).toBeNull();
  fireEvent.click(screen.getByText("Respuestas por participante (1)"));
  expect(screen.queryByText("4 · De acuerdo")).toBeNull();
});

it("changes hierarchical filters and clears the child selection when the parent changes", async () => {
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  fireEvent.change(await screen.findByLabelText("Dimensión"), { target: { value: "d" } });
  await waitFor(() => expect(getSurveyResults).toHaveBeenLastCalledWith("org-a", "p", { dimensionId: "d" }, expect.any(AbortSignal)));
  await screen.findByRole("button", { name: "Exportar CSV" });
  fireEvent.change(screen.getByLabelText("Sesión"), { target: { value: "s" } });
  await waitFor(() => expect(getSurveyResults).toHaveBeenLastCalledWith("org-a", "p", { dimensionId: "d", sessionId: "s" }, expect.any(AbortSignal)));
  await screen.findByRole("button", { name: "Exportar CSV" });
  fireEvent.change(screen.getByLabelText("Actividad"), { target: { value: "a" } });
  await waitFor(() => expect(getSurveyResults).toHaveBeenLastCalledWith("org-a", "p", { dimensionId: "d", sessionId: "s", activityId: "a" }, expect.any(AbortSignal)));
  await screen.findByRole("button", { name: "Exportar CSV" });
  fireEvent.change(screen.getByLabelText("Dimensión"), { target: { value: "d2" } });
  await waitFor(() => expect(getSurveyResults).toHaveBeenLastCalledWith("org-a", "p", { dimensionId: "d2" }, expect.any(AbortSignal)));
});

it("compares dimensions, sessions and activities without mixing scale types", async () => {
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  fireEvent.change(await screen.findByLabelText("Comparar por"), { target: { value: "sessions" } });
  const comparison = screen.getByRole("region", { name: "Comparar resultados" });
  expect(within(comparison).getByRole("heading", { name: "Sesión uno" })).toBeTruthy();
  expect(within(comparison).getByText("Acuerdo · media / 5")).toBeTruthy();
  expect(within(comparison).getByText("Probabilidad · media / 5")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Comparar por"), { target: { value: "activities" } });
  expect(within(comparison).getByRole("heading", { name: "Reflexión" })).toBeTruthy();
});

it("shows empty averages and an honest no-responses state", async () => {
  vi.mocked(getSurveyResults).mockResolvedValue({ ...report, summary: { ...summary, responseCount: 0, agreementAverage: null }, surveys: [] });
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  expect(await screen.findByText(/Todavía no hay respuestas enviadas/)).toBeTruthy();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

it("does not request protected data for a leader, HR or collaborator", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["LEADER", "COMPANY_ADMIN", "COLLABORATOR"] });
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  await screen.findByText(/Sólo un consultor autorizado/);
  expect(getSurveyResults).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Exportar CSV" })).toBeNull();
});

it("preserves the unauthenticated smoke-test contract without exposing filters or answers", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(401));
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "Tu sesión no está disponible. Inicia sesión de nuevo.");
  expect(screen.getByRole("link", { name: "Volver a Cuenta" })).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(getSurveyResults).not.toHaveBeenCalled();
});

it("discards old results when reloading fails authorization", async () => {
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  await screen.findByText(/Programa de prueba/);
  vi.mocked(getSurveyResults).mockRejectedValue(new SurveyResultsRequestError(403));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar resultados" }));
  await screen.findByText(/Sólo un consultor autorizado/);
  expect(screen.queryByText(/Programa de prueba/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Exportar CSV" })).toBeNull();
});

it("downloads an authenticated CSV and warns about personal data", async () => {
  vi.mocked(exportSurveyResults).mockResolvedValue(new Blob(["csv"], { type: "text/csv" }));
  const revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:report"); static revokeObjectURL = revoke; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  fireEvent.change(await screen.findByLabelText("Actividad"), { target: { value: "a" } });
  await waitFor(() => expect(getSurveyResults).toHaveBeenLastCalledWith("org-a", "p", { activityId: "a" }, expect.any(AbortSignal)));
  fireEvent.click(await screen.findByRole("button", { name: "Exportar CSV" }));
  await screen.findByText(/CSV preparado con los filtros actuales/);
  expect(exportSurveyResults).toHaveBeenCalledWith("org-a", "p", { activityId: "a" }, expect.any(AbortSignal));
  expect(click).toHaveBeenCalledTimes(1);
  await new Promise(resolve => setTimeout(resolve, 1050));
  expect(revoke).toHaveBeenCalledWith("blob:report");
});

it("pages open answers instead of expanding all participants at once", async () => {
  const people = Array.from({ length: 6 }, (_, i) => ({ ...report.surveys[0].responses[0], responseId: "r" + i,
    name: "Persona " + (i + 1), answers: [{ questionId: "q2", values: ["Aprendizaje " + (i + 1)] }] }));
  vi.mocked(getSurveyResults).mockResolvedValue({ ...report, surveys: [{ ...report.surveys[0], responses: people }] });
  render(<ProgramSurveyResultsArea organizationId="org-a" programId="p" />);
  await screen.findByText(/Programa de prueba/);
  fireEvent.click(screen.getByText("Reflexión", { selector: "span" }));
  const question = screen.getByRole("article", { name: "Pregunta 2: ¿Qué aprendiste?" });
  expect(within(question).getByText("Aprendizaje 1")).toBeTruthy();
  expect(within(question).queryByText("Aprendizaje 6")).toBeNull();
  fireEvent.click(within(question).getByRole("button", { name: "Siguiente" }));
  expect(within(question).getByText("Aprendizaje 6")).toBeTruthy();
  expect(within(question).queryByText("Aprendizaje 1")).toBeNull();
});
