import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgramArea, CreateProgramForm } from "@/components/programs/program-area";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { createProgram, listPrograms, getProgram, ProgramRequestError } from "@/lib/programs/program-api";
import { createProgramFromTemplate, createProgramTemplate, getProgramTemplateReadiness,
  listProgramTemplates } from "@/lib/programs/program-template-api";

vi.mock("@/lib/auth/authenticated-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/programs/program-api", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/programs/program-api")>(), createProgram: vi.fn(), listPrograms: vi.fn(), getProgram: vi.fn() }));
vi.mock("@/lib/programs/program-template-api", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/programs/program-template-api")>(),
  createProgramFromTemplate: vi.fn(), createProgramTemplate: vi.fn(),
  getProgramTemplateReadiness: vi.fn(), listProgramTemplates: vi.fn(),
}));
const program = { id: "program-a", organizationId: "org-a", name: "Programa real", description: "Descripción", status: "DRAFT" as const, startDate: "2026-09-01", endDate: "2026-12-01", version: 0 };
const template = { id: "template-a", sourceOrganizationId: "org-a", sourceProgramId: "program-a", name: "Plantilla liderazgo",
  description: "Contenido base", sourceProgramName: "Programa real", durationDays: 91, dimensionCount: 3,
  sessionCount: 5, activityCount: 8, surveyCount: 8, createdAt: "2026-09-24T12:00:00Z", version: 0 };
const identity = { cognitoSubject: "subject", user: { id: "user", email: "test@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listPrograms).mockResolvedValue({ items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 });
  vi.mocked(createProgram).mockResolvedValue(program); vi.mocked(getProgram).mockResolvedValue(program);
  vi.mocked(listProgramTemplates).mockResolvedValue({ items: [template], page: 0, size: 100,
    totalElements: 1, totalPages: 1 });
  vi.mocked(getProgramTemplateReadiness).mockResolvedValue({ eligible: true, dimensionCount: 3,
    sessionCount: 5, activityCount: 8, surveyCount: 8, issues: [] });
  vi.mocked(createProgramTemplate).mockResolvedValue(template);
  vi.mocked(createProgramFromTemplate).mockResolvedValue(program);
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
  await waitFor(() => expect((screen.getByRole("button", { name: "Crear plantilla global" }) as HTMLButtonElement).disabled).toBe(false));
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

it("creates a complete program from a selected organization template", async () => {
  render(<CreateProgramForm organizationId="org-a" />);
  fireEvent.click(screen.getByRole("button", { name: /Crear a partir de plantilla/ }));
  const option = await screen.findByText("Plantilla liderazgo");
  fireEvent.click(option);
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2027-01-10" } });
  expect((screen.getByLabelText("Fecha de fin") as HTMLInputElement).value).toBe("2027-04-11");
  fireEvent.submit(screen.getByRole("form", { name: "Crear programa desde plantilla" }));
  await screen.findByText("Programa creado desde la plantilla.");
  expect(createProgramFromTemplate).toHaveBeenCalledWith("org-a", "template-a",
    expect.objectContaining({ name: "Plantilla liderazgo", startDate: "2027-01-10", endDate: "2027-04-11" }),
    expect.any(AbortSignal));
});

it("explains missing content and disables template creation", async () => {
  vi.mocked(getProgramTemplateReadiness).mockResolvedValue({ eligible: false, dimensionCount: 1,
    sessionCount: 1, activityCount: 1, surveyCount: 0, issues: ["ACTIVITY_WITHOUT_SURVEY"] });
  render(<ProgramArea organizationId="org-a" mode="detail" programId="program-a" />);
  expect(await screen.findByText("Faltan encuestas.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Crear plantilla global" }) as HTMLButtonElement).disabled).toBe(true);
});

it("shows only the first missing content level", async () => {
  vi.mocked(getProgramTemplateReadiness).mockResolvedValue({ eligible: false, dimensionCount: 1,
    sessionCount: 0, activityCount: 0, surveyCount: 0,
    issues: ["ACTIVITY_WITHOUT_SURVEY", "SESSION_WITHOUT_ACTIVITIES", "DIMENSION_WITHOUT_SESSIONS"] });
  render(<ProgramArea organizationId="org-a" mode="detail" programId="program-a" />);
  expect(await screen.findByText("Faltan sesiones.")).toBeTruthy();
  expect(screen.queryByText("Faltan actividades.")).toBeNull();
  expect(screen.queryByText("Faltan encuestas.")).toBeNull();
});

it("saves an eligible program as an organization template", async () => {
  render(<ProgramArea organizationId="org-a" mode="detail" programId="program-a" />);
  await waitFor(() => expect((screen.getByRole("button", { name: "Crear plantilla global" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Crear plantilla global" }));
  fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), { target: { value: "Plantilla nueva" } });
  fireEvent.submit(screen.getByRole("form", { name: "Crear plantilla" }));
  await screen.findByText("Plantilla creada y disponible para todas las organizaciones.");
  expect(createProgramTemplate).toHaveBeenCalledWith("org-a", {
    sourceProgramId: "program-a", name: "Plantilla nueva", description: "Descripción",
  });
});
