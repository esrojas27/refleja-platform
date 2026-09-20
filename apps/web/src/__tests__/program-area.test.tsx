import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgramArea, CreateProgramForm } from "@/components/programs/program-area";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { createProgram, listPrograms, getProgram, ProgramRequestError } from "@/lib/programs/program-api";

vi.mock("@/lib/auth/authenticated-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/programs/program-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/programs/program-api")>(), createProgram: vi.fn(), listPrograms: vi.fn(), getProgram: vi.fn() }));
const program = { id: "program-a", organizationId: "org-a", name: "Programa real", description: "Descripción", status: "DRAFT" as const, startDate: "2026-09-01", endDate: "2026-12-01", version: 0 };
const identity = { cognitoSubject: "subject", user: { id: "user", email: "test@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listPrograms).mockResolvedValue({ items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 });
  vi.mocked(createProgram).mockResolvedValue(program); vi.mocked(getProgram).mockResolvedValue(program);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function fill() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Programa real" } });
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Fecha de fin"), { target: { value: "2026-12-01" } });
}
it("lists actual API data and links to create and detail in the same organization", async () => {
  render(<ProgramArea organizationId="org-a" mode="list" />);
  expect((await screen.findByRole("link", { name: "Programa real" })).getAttribute("href")).toBe("/organizations/org-a/programs/program-a");
  expect(screen.getByRole("link", { name: "Crear programa" }).getAttribute("href")).toBe("/organizations/org-a/programs/new");
  expect(fetchCurrentIdentity).toHaveBeenCalledWith("org-a", expect.any(AbortSignal));
});
it("shows an honest empty list", async () => {
  vi.mocked(listPrograms).mockResolvedValue({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
  render(<ProgramArea organizationId="org-a" mode="list" />); await screen.findByText("No hay programas en esta página.");
});
it("loads the next page and does not retain the old page while loading", async () => {
  vi.mocked(listPrograms).mockResolvedValue({ items: [program], page: 0, size: 20, totalElements: 21, totalPages: 2 });
  render(<ProgramArea organizationId="org-a" mode="list" />); await screen.findByText("Programa real");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(listPrograms).toHaveBeenLastCalledWith("org-a", 1, expect.any(AbortSignal)));
});
it("requires session and never fetches programs when identity fails", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(401));
  render(<ProgramArea organizationId="org-a" mode="list" />); await screen.findByText(/Tu sesión no está disponible/);
  expect(listPrograms).not.toHaveBeenCalled();
});
it("does not offer creation to a read-only role", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  render(<ProgramArea organizationId="org-a" mode="create" />); await screen.findByText("No tienes permiso para crear programas.");
  expect(screen.queryByRole("form")).toBeNull();
});
it("renders detail and a generic unavailable message for cross-tenant failure", async () => {
  vi.mocked(getProgram).mockRejectedValue(new ProgramRequestError(404));
  render(<ProgramArea organizationId="org-a" mode="detail" programId="foreign" />);
  await screen.findByText(/El recurso no está disponible/); expect(screen.queryByText("Programa real")).toBeNull();
});
it("renders saved detail metadata including version", async () => {
  render(<ProgramArea organizationId="org-a" mode="detail" programId="program-a" />);
  await screen.findByText("Programa real"); expect(screen.getByText("DRAFT")).toBeTruthy(); expect(screen.getByText("Versión")).toBeTruthy();
});
it("creates within selected organization then shows returned data and detail link", async () => {
  render(<CreateProgramForm organizationId="org-a" />); fill(); fireEvent.submit(screen.getByRole("form"));
  await screen.findByText("Programa creado.");
  expect(createProgram).toHaveBeenCalledWith("org-a", expect.objectContaining({ name: "Programa real", startDate: "2026-09-01" }), expect.any(AbortSignal));
  expect(screen.getByRole("link", { name: "Consultar programa creado" }).getAttribute("href")).toBe("/organizations/org-a/programs/program-a");
});
it("rejects reversed dates before submission", () => {
  render(<CreateProgramForm organizationId="org-a" />); fill();
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2027-01-01" } });
  fireEvent.submit(screen.getByRole("form")); expect(createProgram).not.toHaveBeenCalled(); expect(screen.getByText(/El inicio debe ser anterior/)).toBeTruthy();
});
it("blocks duplicate pending submissions", async () => {
  vi.mocked(createProgram).mockReturnValue(new Promise(() => {})); render(<CreateProgramForm organizationId="org-a" />); fill();
  fireEvent.submit(screen.getByRole("form")); fireEvent.submit(screen.getByRole("form"));
  expect(createProgram).toHaveBeenCalledTimes(1);
});
it("blocks retry on uncertain result and never claims successful creation", async () => {
  vi.mocked(createProgram).mockRejectedValue(new TypeError("network")); render(<CreateProgramForm organizationId="org-a" />); fill();
  fireEvent.submit(screen.getByRole("form")); await screen.findByText(/Revisa el listado antes de repetir/);
  expect((screen.getByRole("button", { name: "Crear programa" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Programa creado.")).toBeNull();
});
it("honors permission revoked on POST", async () => {
  vi.mocked(createProgram).mockRejectedValue(new ProgramRequestError(403)); render(<CreateProgramForm organizationId="org-a" />); fill();
  fireEvent.submit(screen.getByRole("form")); await screen.findByText(/No tienes permiso para realizar/);
  expect((screen.getByRole("button", { name: "Crear programa" }) as HTMLButtonElement).disabled).toBe(true);
});
