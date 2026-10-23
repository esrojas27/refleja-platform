import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { createActivityEvaluation, type ActivityEvaluation } from "@/lib/participation/evaluation-api";
import { editSurvey } from "@/lib/programs/content-administration-api";
import { ProgramContentRequestError } from "@/lib/programs/program-content-api";

vi.mock("@/lib/participation/evaluation-api", async original => ({
  ...await original<typeof import("@/lib/participation/evaluation-api")>(), createActivityEvaluation: vi.fn(),
}));
vi.mock("@/lib/programs/content-administration-api", () => ({ editSurvey: vi.fn() }));

const survey: ActivityEvaluation = {
  id: "survey", organizationId: "org", programId: "program", activityId: "activity", title: "Encuesta", instructions: null, version: 7,
  questions: [
    { id: "q3", prompt: "Emociones", type: "EMOTION_MULTI_SELECT", position: 3, version: 0 },
    { id: "q1", prompt: "Acuerdo", type: "AGREEMENT_SCALE", position: 1, version: 0 },
    { id: "q2", prompt: "Reflexión", type: "OPEN_TEXT", position: 2, version: 0 },
  ],
};
const props = { organizationId: "org", programId: "program", activityId: "activity", activityTitle: "Actividad", onSaved: vi.fn() };
function prompts() { return screen.getAllByLabelText<HTMLTextAreaElement>("Enunciado").map(input => input.value); }
beforeEach(() => { vi.mocked(createActivityEvaluation).mockResolvedValue(survey); vi.mocked(editSurvey).mockResolvedValue(survey); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("reorders new questions without losing prompts or response types and saves sequential positions", async () => {
  render(<ActivityEvaluationForm {...props} />);
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: "Acuerdo" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar pregunta" }));
  fireEvent.change(screen.getAllByLabelText("Enunciado")[1], { target: { value: "Probabilidad" } });
  fireEvent.change(screen.getAllByLabelText("Tipo de respuesta")[1], { target: { value: "LIKELIHOOD_SCALE" } });
  fireEvent.click(screen.getByRole("button", { name: "Bajar pregunta 1" }));
  expect(prompts()).toEqual(["Probabilidad", "Acuerdo"]);
  expect(screen.getByText(/Pregunta 1 movida a la posición 2/)).toBeTruthy();
  expect(createActivityEvaluation).not.toHaveBeenCalled();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Subir pregunta 2" })));
  fireEvent.submit(screen.getByRole("form", { name: "Crear encuesta" }));
  await waitFor(() => expect(createActivityEvaluation).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    questions: [ { prompt: "Probabilidad", type: "LIKELIHOOD_SCALE", position: 1 }, { prompt: "Acuerdo", type: "AGREEMENT_SCALE", position: 2 } ],
  }), expect.any(AbortSignal)));
});

it("loads saved positions, reorders existing questions and saves the survey version", async () => {
  render(<ActivityEvaluationForm {...props} initial={survey} />);
  expect(prompts()).toEqual(["Acuerdo", "Reflexión", "Emociones"]);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Subir pregunta 1" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Bajar pregunta 3" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Subir pregunta 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Subir pregunta 2" }));
  expect(prompts()).toEqual(["Emociones", "Acuerdo", "Reflexión"]);
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org", "program", "activity", {
    title: "Encuesta", instructions: null, version: 7,
    questions: [
      { prompt: "Emociones", type: "EMOTION_MULTI_SELECT", position: 1 },
      { prompt: "Acuerdo", type: "AGREEMENT_SCALE", position: 2 },
      { prompt: "Reflexión", type: "OPEN_TEXT", position: 3 },
    ],
  }, expect.any(AbortSignal)));
  expect(props.onSaved).toHaveBeenCalledWith(survey);
});

it("keeps question identity when editing, deleting and adding after a reorder", async () => {
  render(<ActivityEvaluationForm {...props} initial={survey} />);
  fireEvent.click(screen.getByRole("button", { name: "Bajar pregunta 1" }));
  fireEvent.change(screen.getAllByLabelText("Enunciado")[1], { target: { value: "Acuerdo actualizado" } });
  fireEvent.click(screen.getByRole("button", { name: "Eliminar pregunta 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Agregar pregunta" }));
  fireEvent.change(screen.getAllByLabelText("Enunciado")[2], { target: { value: "Nueva" } });
  fireEvent.click(screen.getByRole("button", { name: "Subir pregunta 3" }));
  expect(prompts()).toEqual(["Acuerdo actualizado", "Nueva", "Emociones"]);
  expect(new Set(screen.getAllByLabelText("Enunciado").map(input => input.id)).size).toBe(3);
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  await waitFor(() => expect(editSurvey).toHaveBeenCalledWith("org", "program", "activity", expect.objectContaining({
    questions: [
      { prompt: "Acuerdo actualizado", type: "AGREEMENT_SCALE", position: 1 },
      { prompt: "Nueva", type: "OPEN_TEXT", position: 2 },
      { prompt: "Emociones", type: "EMOTION_MULTI_SELECT", position: 3 },
    ],
  }), expect.any(AbortSignal)));
});

it("disables both directions for a single question and keeps validation attached to a moved question", () => {
  render(<ActivityEvaluationForm {...props} />);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Subir pregunta 1" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Bajar pregunta 1" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Agregar pregunta" }));
  fireEvent.change(screen.getAllByLabelText("Enunciado")[1], { target: { value: "Válida" } });
  fireEvent.submit(screen.getByRole("form", { name: "Crear encuesta" }));
  fireEvent.click(screen.getByRole("button", { name: "Bajar pregunta 1" }));
  const inputs = screen.getAllByLabelText("Enunciado");
  expect(inputs[0].getAttribute("aria-invalid")).toBeNull();
  expect(inputs[1].getAttribute("aria-invalid")).toBe("true");
  expect(createActivityEvaluation).not.toHaveBeenCalled();
});

it("blocks order changes while saving", async () => {
  vi.mocked(editSurvey).mockReturnValue(new Promise(() => {}));
  render(<ActivityEvaluationForm {...props} initial={survey} />);
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  expect(await screen.findByText("Guardando encuesta…")).toBeTruthy();
  for (const button of screen.getAllByRole<HTMLButtonElement>("button", { name: /^(Subir|Bajar|Eliminar) pregunta/ })) expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Bajar pregunta 1" }));
  expect(prompts()).toEqual(["Acuerdo", "Reflexión", "Emociones"]);
});

it("does not allow further reordering after the API reports existing submissions", async () => {
  vi.mocked(editSurvey).mockRejectedValue(new ProgramContentRequestError(409, [], undefined, "CONTENT_HAS_SUBMISSIONS"));
  render(<ActivityEvaluationForm {...props} initial={survey} />);
  fireEvent.submit(screen.getByRole("form", { name: "Editar encuesta" }));
  expect(await screen.findByText(/Ya existen entregas/)).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Bajar pregunta 1" }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Subir pregunta 3" }).disabled).toBe(true);
});
