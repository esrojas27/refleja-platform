import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { TableDefinitionEditor, TableAnswerInput } from "@/components/forms/table-question";
import { QuestionnaireForm, QuestionnaireAnswers } from "@/components/forms/questionnaire-form";
import { ActivityEvaluationForm } from "@/components/programs/activity-evaluation-form";
import { tableLayout, tableOptions, tableAnswerError, tableDefinitionError } from "@/lib/forms/table-question";
import { createActivityEvaluation } from "@/lib/participation/evaluation-api";
vi.mock("@/lib/participation/evaluation-api", async original => ({
  ...await original<typeof import("@/lib/participation/evaluation-api")>(), createActivityEvaluation: vi.fn(),
}));
const options = ["TABLE_V1:2:2", "Ámbito", "Acción", "Avance", "Personal", "Social"];
const question = { id: "table", prompt: "Mi plan", type: "TABLE" as const, position: 1, options };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("validates layouts, all cells and limits while accepting repeated free text", () => {
  expect(tableLayout(options)).toEqual({ corner: "Ámbito", columns: ["Acción","Avance"], rows: ["Personal","Social"] });
  expect(tableOptions(tableLayout(options)!)).toEqual(options);
  expect(tableDefinitionError(["TABLE_V1:21:1","A","B","C"])).toBeTruthy();
  expect(tableDefinitionError(["TABLE_V1:1:1","A","B"," "])).toBeTruthy();
  expect(tableAnswerError(options, ["igual","igual","igual","igual"])).toBe("");
  expect(tableAnswerError(options, ["igual"])).toBeTruthy();
  expect(tableAnswerError(options, ["1","2","3","x".repeat(151)])).toBeTruthy();
  expect(tableAnswerError(options, ["1","2","3"," "])).toBeTruthy();
});

it("configures only headers in a popup, adds rows and columns, and preserves existing headers", () => {
  const save = vi.fn();
  render(<TableDefinitionEditor id="configure" options={options} disabled={false} onChange={save} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar tabla" }));
  const popup = screen.getByRole("dialog", { name: "Configurar tabla" });
  expect(within(popup).getAllByRole("textbox")).toHaveLength(5);
  fireEvent.click(within(popup).getByRole("button", { name: "Agregar fila" }));
  fireEvent.click(within(popup).getByRole("button", { name: "Agregar columna" }));
  fireEvent.change(within(popup).getByLabelText("Encabezado de fila 3"), { target: { value: "Familiar" } });
  fireEvent.change(within(popup).getByLabelText("Encabezado de columna 3"), { target: { value: "Fecha" } });
  fireEvent.click(within(popup).getByRole("button", { name: "Guardar tabla" }));
  expect(save).toHaveBeenCalledWith(["TABLE_V1:3:3","Ámbito","Acción","Avance","Fecha","Personal","Social","Familiar"]);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("opens the answer preview, retains partial answers on close, and permits resizing with a 150 character limit", () => {
  function Harness() {
    const [values,setValues] = useState<string[]>([]);
    return <TableAnswerInput id="answer" prompt="Mi plan" options={options} values={values} disabled={false} onChange={setValues} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Abrir tabla: Mi plan" }));
  const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Personal / Acción" });
  expect(field.maxLength).toBe(150);
  expect(field.className).toContain("resize");
  fireEvent.change(field, { target: { value: "Mi compromiso" } });
  fireEvent.click(screen.getByRole("button", { name: "Volver al formulario" }));
  expect(screen.getByText("Mi compromiso")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Abrir tabla: Mi plan" }));
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Personal / Acción" }).value).toBe("Mi compromiso");
});

it("blocks incomplete submission and sends all table cells in row order", async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  render(<QuestionnaireForm title="Plan" instructions={null} questions={[question]} submitLabel="Enviar" onSend={send} />);
  fireEvent.submit(screen.getByRole("form", { name: "Plan" }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText(/Completa todas las celdas/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Abrir tabla: Mi plan" }));
  const fields = within(screen.getByRole("dialog")).getAllByRole("textbox");
  fields.forEach((field,index) => fireEvent.change(field, { target: { value: index === 3 ? "Final" : "Repetida" } }));
  fireEvent.click(screen.getByRole("button", { name: "Volver al formulario" }));
  fireEvent.submit(screen.getByRole("form", { name: "Plan" }));
  await waitFor(() => expect(send).toHaveBeenCalledWith([{ questionId:"table", values:["Repetida","Repetida","Repetida","Final"] }]));
});

it("shows the saved answers as a table with their row and column headers", () => {
  render(<QuestionnaireAnswers questions={[question]} answers={[{questionId:"table",values:["Uno","Dos","Tres","Cuatro"]}]} />);
  expect(screen.getByRole("columnheader", { name: "Acción" })).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "Social" })).toBeTruthy();
  expect(screen.getByRole("cell", { name: "Cuatro" })).toBeTruthy();
});

it("offers a table for activity and session forms, opens configuration when selected, and saves its headers", async () => {
  vi.mocked(createActivityEvaluation).mockResolvedValue({ id:"survey",organizationId:"org",programId:"program",activityId:"activity",
    title:"Formulario",instructions:null,version:0,questions:[{...question,version:0}] });
  render(<ActivityEvaluationForm organizationId="org" programId="program" activityId="activity" activityTitle="Plan" onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Enunciado"), { target: { value: "Mi plan" } });
  fireEvent.change(screen.getByLabelText("Tipo de respuesta"), { target: { value: "TABLE" } });
  expect(screen.getByRole("dialog")).toBeTruthy();
  ["Ámbito","Acción","Avance","Personal","Social"].forEach((value,i) => {
    const labels = ["Encabezado de la primera columna","Encabezado de columna 1","Encabezado de columna 2","Encabezado de fila 1","Encabezado de fila 2"];
    fireEvent.change(screen.getByLabelText(labels[i]), { target: { value } });
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar tabla" }));
  fireEvent.submit(screen.getByRole("form", { name: "Crear formulario" }));
  await waitFor(() => expect(createActivityEvaluation).toHaveBeenCalledWith("org","program","activity",
    expect.objectContaining({questions:[{prompt:"Mi plan",type:"TABLE",position:1,options}]}),expect.any(AbortSignal)));
  cleanup();
  render(<ActivityEvaluationForm organizationId="org" programId="program" sessionId="session" activityTitle="Cierre" onSaved={vi.fn()} />);
  expect(screen.getByRole("option", { name: "Tabla · Texto por celda" })).toBeTruthy();
});
