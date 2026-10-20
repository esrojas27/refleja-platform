import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProgramLifecyclePanel } from "@/components/programs/program-lifecycle-panel";
import { changeProgramStatus, getProgram, ProgramRequestError, type Program } from "@/lib/programs/program-api";

vi.mock("@/lib/programs/program-api", async original => ({
  ...await original<typeof import("@/lib/programs/program-api")>(), changeProgramStatus: vi.fn(), getProgram: vi.fn(),
}));
const draft: Program = { id: "program-a", organizationId: "org-a", name: "Liderazgo", description: null,
  status: "DRAFT", startDate: "2026-10-01", endDate: "2026-11-01", version: 0 };
function Harness({ initial = draft }: { initial?: Program }) {
  const [program, setProgram] = useState(initial);
  return <ProgramLifecyclePanel program={program} onChanged={setProgram} />;
}
beforeEach(() => {
  vi.mocked(changeProgramStatus).mockResolvedValue({ ...draft, status: "ACTIVE", version: 1 });
  vi.mocked(getProgram).mockResolvedValue({ ...draft, status: "ACTIVE", version: 1 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("requires confirmation and sends the exact current version when activating", async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Activar programa" }));
  expect(changeProgramStatus).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Activar programa" });
  expect(within(dialog).getByText(/activación es inmediata y manual/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar: activar programa" }));
  expect(await screen.findByText("Programa activo.")).toBeTruthy();
  expect(changeProgramStatus).toHaveBeenCalledWith("org-a", "program-a", "ACTIVE", 0);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Finalizar programa" })).toBeTruthy();
});

it("warns about pending work before finishing and leaves only read actions afterwards", async () => {
  vi.mocked(changeProgramStatus).mockResolvedValue({ ...draft, status: "COMPLETED", version: 2 });
  render(<Harness initial={{ ...draft, status: "ACTIVE", version: 1 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Finalizar programa" }));
  expect(screen.getByText(/Puedes finalizar aunque existan actividades sin entregar/)).toBeTruthy();
  expect(screen.getByText(/Esta acción no se puede deshacer/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar: finalizar programa" }));
  await screen.findByText("Programa finalizado.");
  expect(screen.queryByRole("button", { name: "Activar programa" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancelar programa" })).toBeNull();
});

it("does not cancel until confirmed and permits returning without mutation", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar programa" }));
  fireEvent.click(screen.getByRole("button", { name: "Volver" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(changeProgramStatus).not.toHaveBeenCalled();
});

it("blocks repeated clicks and requires refresh after an uncertain result", async () => {
  vi.mocked(changeProgramStatus).mockRejectedValue(new ProgramRequestError(409, [], undefined, "PROGRAM_VERSION_CONFLICT"));
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Activar programa" }));
  const confirm = screen.getByRole("button", { name: "Confirmar: activar programa" });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await screen.findByText(/Actualiza para comprobar el estado/);
  expect(changeProgramStatus).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Activar programa" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Finalizar programa" })).toBeTruthy());
});
