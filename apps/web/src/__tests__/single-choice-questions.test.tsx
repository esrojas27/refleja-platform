import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { ActivitySurveyForm } from "@/components/participation/activity-survey-form";
import { createActivityEvaluation, type ActivityEvaluation } from "@/lib/participation/evaluation-api";
import { editSurvey } from "@/lib/programs/content-administration-api";
import { submitMyActivitySurvey, type ActivitySurvey } from "@/lib/participation/activity-api";
import { optionLetter, parseQuestionOptions, questionOptionsError } from "@/lib/forms/question-catalog";

vi.mock("@/lib/participation/evaluation-api", async original => ({
  ...await original<typeof import("@/lib/participation/evaluation-api")>(), createActivityEvaluation: vi.fn(),
}));
vi.mock("@/lib/programs/content-administration-api", () => ({ editSurvey: vi.fn() }));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(), submitMyActivitySurvey: vi.fn(),
}));
const words = Array.from({ length: 30 }, (_, i) => `Palabra ${i + 1}`);
const question = { id: "choice-question", prompt: "Elige una fortaleza", type: "SINGLE_CHOICE_WORDS" as const, position: 1, version: 0, options: words };
const definition: ActivityEvaluation = { id: "survey", organizationId: "org", programId: "program", activityId: "activity", title: "Encuesta", instructions: null, version: 2, questions: [question] };
const survey: ActivitySurvey = { ...definition, status: "PENDING", completedAt: null };
const props = { organizationId: "org", programId: "program", activityId: "activity", activityTitle: "Actividad", onSaved: vi.fn() };
beforeEach(() => {
  vi.mocked(createActivityEvaluation).mockResolvedValue(definition);
  vi.mocked(editSurvey).mockResolvedValue(definition);
  vi.mocked(submitMyActivitySurvey).mockResolvedValue({ evaluationId: "survey", status: "COMPLETED", completedAt: "2026-10-25T12:00:00Z" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("parses bulk options, validates counts, length and duplicates, and labels beyond z", () => {
  expect(parseQuestionOptions(" Primera \r\n\n Segunda\n")).toEqual(["Primera", "Segunda"]);
  for (const size of [2, 6, 30, 100]) expect(questionOptionsError(Array.from({ length: size }, (_, i) => `Opción ${i}`))).toBe("");
  expect(questionOptionsError(["Una"])).toMatch(/entre 2 y 100/);
  expect(questionOptionsError(Array.from({ length: 101 }, (_, i) => `Opción ${i}`))).toMatch(/entre 2 y 100/);
  expect(questionOptionsError(["Una", "una"])).toMatch(/repetidas/);
  expect(questionOptionsError(["x".repeat(201), "Dos"])).toMatch(/200/);
  expect([0, 3, 25, 26, 29, 99].map(optionLetter)).toEqual(["a", "d", "z", "aa", "ad", "cv"]);
});

it.each(["SINGLE_CHOICE_LETTERS", "SINGLE_CHOICE_WORDS"] as const)("creates %s with thirty editable options", async type => {
  render(<ActivityEvaluationForm {...props} />);
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: question.prompt } });
  fireEvent.change(screen.getByLabelText("Tipo de respuesta"), { target: { value: type } });
  fireEvent.change(screen.getByLabelText("Opciones de respuesta"), { target: { value: words.join("\n") } });
  expect(screen.getByText("Palabra 30")).toBeTruthy();
  if (type === "SINGLE_CHOICE_LETTERS") expect(screen.getByText("ad.")).toBeTruthy();
  fireEvent.submit(screen.getByRole("form", { name: "Crear encuesta" }));
  await waitFor(() => expect(createActivityEvaluation).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    questions: [{ prompt: question.prompt, type, position: 1, options: words }],
  }), expect.any(AbortSignal)));
});

it("highlights missing and duplicate choices and focuses the options editor", async () => {
  render(<ActivityEvaluationForm {...props} />);
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: "Elige" } });
  fireEvent.change(screen.getByLabelText("Tipo de respuesta"), { target: { value: "SINGLE_CHOICE_LETTERS" } });
  fireEvent.submit(screen.getByRole("form", { name: "Crear encuesta" }));
  const options = screen.getByLabelText("Opciones de respuesta");
  expect(options.getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(options));
  fireEvent.change(options, { target: { value: "Una\nuna" } });
  fireEvent.submit(screen.getByRole("form", { name: "Crear encuesta" }));
  expect(screen.getByText(/Hay opciones repetidas/)).toBeTruthy();
  expect(createActivityEvaluation).not.toHaveBeenCalled();
});

it("loads, edits and reorders a custom question without losing its choices", async () => {
  render(<ActivityEvaluationForm {...props} initial={definition} />);
  expect(screen.getByLabelText<HTMLTextAreaElement>("Opciones de respuesta").value).toBe(words.join("\n"));
  fireEvent.change(screen.getByLabelText("Opciones de respuesta"), { target: { value: "Primera\nSegunda" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar pregunta" }));
  fireEvent.change(screen.getAllByLabelText("Enunciado")[1], { target: { value: "Abierta" } });
  fireEvent.click(screen.getByRole("button", { name: "Bajar pregunta 1" }));
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    version: 2, questions: [{ prompt: "Abierta", type: "OPEN_TEXT", position: 1 },
      { prompt: question.prompt, type: "SINGLE_CHOICE_WORDS", position: 2, options: ["Primera", "Segunda"] }],
  }), expect.any(AbortSignal)));
});

it("does not send custom choices after changing the question to a fixed type", async () => {
  render(<ActivityEvaluationForm {...props} initial={definition} />);
  fireEvent.change(screen.getByLabelText("Tipo de respuesta"), { target: { value: "NUMERIC_SCALE" } });
  expect(screen.queryByLabelText("Opciones de respuesta")).toBeNull();
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    questions: [{ prompt: question.prompt, type: "NUMERIC_SCALE", position: 1 }],
  }), expect.any(AbortSignal)));
});

it.each(["SINGLE_CHOICE_LETTERS", "SINGLE_CHOICE_WORDS"] as const)("%s requires exactly one selected option and sends its label", async type => {
  render(<ActivitySurveyForm programId="program" activityId="activity" survey={{ ...survey, questions: [{ ...question, type }] }} onCompleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Enviar encuesta" }));
  expect(screen.getByText("Esta pregunta es obligatoria.")).toBeTruthy();
  expect(submitMyActivitySurvey).not.toHaveBeenCalled();
  expect(screen.getAllByRole("radio")).toHaveLength(30);
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Palabra 1" }));
  fireEvent.click(screen.getByRole("radio", { name: "Palabra 30" }));
  expect(screen.getAllByRole<HTMLInputElement>("radio").filter(r => r.checked).map(r => r.value)).toEqual(["Palabra 30"]);
  fireEvent.click(screen.getByRole("button", { name: "Enviar encuesta" }));
  await waitFor(() => expect(submitMyActivitySurvey).toHaveBeenCalledWith("program", "activity", [{ questionId: question.id, values: ["Palabra 30"] }]));
});

it("disables custom radio choices while the submission is pending", async () => {
  vi.mocked(submitMyActivitySurvey).mockReturnValue(new Promise(() => {}));
  render(<ActivitySurveyForm programId="program" activityId="activity" survey={survey} onCompleted={vi.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: "Palabra 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar encuesta" }));
  await waitFor(() => expect(submitMyActivitySurvey).toHaveBeenCalledOnce());
  expect(screen.getAllByRole<HTMLInputElement>("radio").every(r => r.disabled)).toBe(true);
});
