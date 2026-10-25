import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityEvaluationForm, QuestionPreview } from "@/components/programs/activity-evaluation-form";
import { ActivitySurveyForm } from "@/components/participation/activity-survey-form";
import { createActivityEvaluation, type ActivityEvaluation } from "@/lib/participation/evaluation-api";
import { editSurvey } from "@/lib/programs/content-administration-api";
import { submitMyActivitySurvey, type ActivitySurvey } from "@/lib/participation/activity-api";

vi.mock("@/lib/participation/evaluation-api", async original => ({
  ...await original<typeof import("@/lib/participation/evaluation-api")>(), createActivityEvaluation: vi.fn(),
}));
vi.mock("@/lib/programs/content-administration-api", () => ({ editSurvey: vi.fn() }));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(), submitMyActivitySurvey: vi.fn(),
}));
const question = { id: "numeric-question", prompt: "¿Qué nivel alcanzaste?", type: "NUMERIC_SCALE" as const, position: 1, version: 0 };
const definition: ActivityEvaluation = { id: "survey", organizationId: "org", programId: "program", activityId: "activity",
  title: "Encuesta", instructions: null, version: 2, questions: [question] };
const survey: ActivitySurvey = { ...definition, status: "PENDING", completedAt: null };
const props = { organizationId: "org", programId: "program", activityId: "activity", activityTitle: "Actividad", onSaved: vi.fn() };
beforeEach(() => {
  vi.mocked(createActivityEvaluation).mockResolvedValue(definition);
  vi.mocked(editSurvey).mockResolvedValue(definition);
  vi.mocked(submitMyActivitySurvey).mockResolvedValue({ evaluationId: "survey", status: "COMPLETED", completedAt: "2026-10-23T12:00:00Z" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("previews exactly five numbers without option descriptions", () => {
  render(<QuestionPreview type="NUMERIC_SCALE" />);
  expect(screen.getAllByText(/^[1-5]$/).map(element => element.textContent)).toEqual(["1", "2", "3", "4", "5"]);
  expect(screen.queryByText(/Totalmente|improbable|probable|seguro|acuerdo/i)).toBeNull();
});

it("offers the numeric type when creating a question and saves its definition", async () => {
  render(<ActivityEvaluationForm {...props} />);
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: question.prompt } });
  fireEvent.change(screen.getByLabelText("Tipo de respuesta"), { target: { value: "NUMERIC_SCALE" } });
  expect(screen.getByRole<HTMLOptionElement>("option", { name: "Escala numérica · 1–5" }).selected).toBe(true);
  expect(screen.getAllByText(/^[1-5]$/)).toHaveLength(5);
  fireEvent.submit(screen.getByRole("form", { name: "Crear formulario" }));
  await waitFor(() => expect(createActivityEvaluation).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    questions: [{ prompt: question.prompt, type: "NUMERIC_SCALE", position: 1 }],
  }), expect.any(AbortSignal)));
});

it("loads and edits an existing numeric question without changing its type", async () => {
  render(<ActivityEvaluationForm {...props} initial={definition} />);
  expect(screen.getByLabelText<HTMLSelectElement>("Tipo de respuesta").value).toBe("NUMERIC_SCALE");
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: "Nivel de avance" } });
  fireEvent.submit(screen.getByRole("form", { name: "Editar formulario" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    version: 2, questions: [{ prompt: "Nivel de avance", type: "NUMERIC_SCALE", position: 1 }],
  }), expect.any(AbortSignal)));
});

it("lets the collaborator choose exactly one number and sends only that value", async () => {
  const completed = vi.fn();
  const view=render(<ActivitySurveyForm version={0} programId="program" activityId="activity" survey={survey} onCompleted={completed} />);
  const radios=screen.getAllByRole<HTMLInputElement>("radio");
  expect(radios.map(input=>input.value)).toEqual(["1","2","3","4","5"]);
  expect(view.container.querySelectorAll("ol")).toHaveLength(1);
  for (const value of ["1","2","3","4","5"]) expect(screen.getByRole("radio",{name:value})).toBeTruthy();
  expect(screen.queryByText(/Totalmente|Muy improbable|Muy probable/)).toBeNull();
  fireEvent.click(screen.getByRole("radio",{name:"5"}));
  fireEvent.click(screen.getByRole("radio",{name:"2"}));
  expect(radios.filter(input=>input.checked).map(input=>input.value)).toEqual(["2"]);
  fireEvent.click(screen.getByRole("button",{name:"Enviar actividad"}));
  await waitFor(()=>expect(submitMyActivitySurvey).toHaveBeenCalledWith("program","activity",[{questionId:"numeric-question",values:["2"]}],0));
  expect(completed).toHaveBeenCalledOnce();
});

it("requires a numeric selection and disables the scale during submission", async () => {
  vi.mocked(submitMyActivitySurvey).mockReturnValue(new Promise(()=>{}));
  render(<ActivitySurveyForm version={0} programId="program" activityId="activity" survey={survey} onCompleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"Enviar actividad"}));
  expect(screen.getByText("Esta pregunta es obligatoria.")).toBeTruthy();
  expect(submitMyActivitySurvey).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio",{name:"1"}));
  fireEvent.click(screen.getByRole("button",{name:"Enviar actividad"}));
  await waitFor(()=>expect(submitMyActivitySurvey).toHaveBeenCalledOnce());
  expect(screen.getAllByRole<HTMLInputElement>("radio").every(input=>input.disabled)).toBe(true);
});
