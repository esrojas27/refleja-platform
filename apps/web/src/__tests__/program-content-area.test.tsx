import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DimensionForm, ProgramContentArea, SessionForm } from "@/components/programs/program-content-area";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { createProgramDimension, createProgramSession, listProgramDimensions, type ProgramDimension } from "@/lib/programs/program-content-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));
vi.mock("@/lib/programs/program-content-api", async original => ({
  ...await original<typeof import("@/lib/programs/program-content-api")>(),
  createProgramDimension: vi.fn(), createProgramSession: vi.fn(), listProgramDimensions: vi.fn(),
}));

const identity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"] }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const dimensionData: ProgramDimension = { id: "module-a", organizationId: "org-a", programId: "program-a", name: "Fundamentos",
  description: "Contexto del proceso", position: 2, version: 0, sessions: [{ id: "session-a", organizationId: "org-a",
    programId: "program-a", dimensionId: "module-a", name: "Sesión inicial", objective: "Definir el punto de partida",
    scheduledDate: "2026-10-01", position: 3, version: 0 }] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramDimensions).mockResolvedValue({ items: [dimensionData] });
  vi.mocked(createProgramDimension).mockResolvedValue({ ...dimensionData, id: "new-module", position: 3, sessions: [] });
  vi.mocked(createProgramSession).mockResolvedValue({ ...dimensionData.sessions[0], id: "new-session", position: 4 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders the ordered real dimension and session structure", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText("Fundamentos");
  expect(screen.getByText("Dimensión 2")).toBeTruthy();
  expect(screen.getByText("Sesión inicial")).toBeTruthy();
  expect(screen.getByText(/Definir el punto de partida/)).toBeTruthy();
  expect(screen.getByText("2026-10-01")).toBeTruthy();
  expect(listProgramDimensions).toHaveBeenCalledWith("org-a", "program-a", expect.any(AbortSignal));
});

it("appends dimensions using the next visible position", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  const form = await screen.findByRole("form", { name: "Crear dimensión" });
  fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Práctica" } });
  fireEvent.change(within(form).getByLabelText("Descripción opcional"), { target: { value: "Aplicación" } });
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramDimension).toHaveBeenCalledWith("org-a", "program-a",
    { name: "Práctica", description: "Aplicación", position: 3 }, expect.any(AbortSignal)));
});

it("appends sessions inside their module using the next visible position", async () => {
  render(<ProgramContentArea organizationId="org-a" programId="program-a" />);
  const form = await screen.findByRole("form", { name: "Crear sesión" });
  fireEvent.change(within(form).getByLabelText("Nombre"), { target: { value: "Segunda sesión" } });
  fireEvent.change(within(form).getByLabelText("Objetivo opcional"), { target: { value: "Practicar lo aprendido" } });
  fireEvent.change(within(form).getByLabelText("Fecha"), { target: { value: "2026-10-08" } });
  fireEvent.submit(form);
  await waitFor(() => expect(createProgramSession).toHaveBeenCalledWith("org-a", "program-a", "module-a",
    { name: "Segunda sesión", objective: "Practicar lo aprendido", scheduledDate: "2026-10-08", position: 4 }, expect.any(AbortSignal)));
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
