import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProgramReportArea } from "@/components/programs/program-report-area";
import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";
import { getProgramReport, exportProgramReport, ProgramReportError, type ProgramReport } from "@/lib/participation/program-report-api";

vi.mock("@/lib/auth/authenticated-api", async original => ({ ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/participation/program-report-api", async original => ({ ...await original<typeof import("@/lib/participation/program-report-api")>(), getProgramReport: vi.fn(), exportProgramReport: vi.fn() }));
const identity = { cognitoSubject: "subject", user: { id: "u", email: "consultant@example.test", firstName: null, lastName: null }, organizations: [], activeOrganizationId: "o", roles: ["CONSULTANT"] };
const summary = { participantCount: 2, participatingCount: 1, assigned: 2, submitted: 1, pending: 1, inReview: 1, changesRequested: 0,
  approved: 0, overdue: 1, surveysAssigned: 2, surveysCompleted: 0, due: 1, onTime: 0, progressPercentage: 25, approvalPercentage: 0, participationPercentage: 50, onTimePercentage: 0 };
const surveySummary = { surveyCount: 0, assignedCount: 0, responseCount: 0, pendingCount: 0, participantCount: 0, respondentCount: 0,
  responseRate: null, agreementAverage: null, agreementAnswers: 0, likelihoodAverage: null, likelihoodAnswers: 0 };
const report: ProgramReport = { organizationId: "o", organizationName: "Empresa Ejemplo", programId: "p", programName: "Mi programa",
  programStatus: "ACTIVE", startDate: null, endDate: null, generatedAt: "2026-10-22T15:00:00Z", asOfDate: "2026-10-22", timeZone: "America/Bogota",
  enrollmentId: null, summary, enrollmentCounts: { ACTIVE: 2 }, participants: [
    { enrollmentId: "e1", name: "Ana", email: "ana@example.test", status: "ACTIVE", summary: { ...summary, participantCount: 1 } },
    { enrollmentId: "e2", name: "Juan", email: "juan@example.test", status: "ACTIVE", summary: { ...summary, participantCount: 1 } }],
  work: [{ assignmentId: "assignment", enrollmentId: "e1", activityId: "a", activityTitle: "Reflexión", dimensionId: "d", dimensionName: "Interior",
    sessionId: "s", sessionName: "Mi sesión", dueDate: "2026-10-21", status: "SUBMITTED", submittedAt: "2026-10-20T15:00:00Z", surveyRequired: true,
    surveyCompletedAt: null, progressPercentage: 50, overdue: true, onTime: false }],
  surveys: { programId: "p", programName: "Mi programa", generatedAt: "2026-10-22T15:00:00Z", scope: { dimensionId: null, sessionId: null, activityId: null },
    options: [], summary: surveySummary, dimensions: [], sessions: [], activities: [], surveys: [] } };
beforeEach(() => { vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity); vi.mocked(getProgramReport).mockResolvedValue(report); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows distinct progress, approval, participation and deadline metrics", async () => {
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByRole("heading", { name: "Mi programa" });
  expect(screen.getByRole("heading", { name: "Avance del colaborador" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Aprobación del consultor" })).toBeTruthy();
  expect(screen.getByText(/America\/Bogota/)).toBeTruthy();
  expect(screen.getByText(/No equivale a aprobación/)).toBeTruthy();
  expect(screen.getByText(/no una evaluación inicial\/final/)).toBeTruthy();
});
it("loads an individual report from the API and removes the previous general data immediately", async () => {
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByRole("button", { name: "Ver reporte de Ana" });
  let resolve!: (data: ProgramReport) => void;
  vi.mocked(getProgramReport).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByRole("button", { name: "Ver reporte de Ana" }));
  expect(screen.queryByRole("heading", { name: "Mi programa" })).toBeNull();
  await waitFor(() => expect(getProgramReport).toHaveBeenLastCalledWith("o", "p", "e1", expect.any(AbortSignal)));
  resolve({ ...report, enrollmentId: "e1", participants: [report.participants[0]] });
  expect(await screen.findByRole("heading", { name: "Reporte individual · Ana" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ver reporte de Juan" })).toBeNull();
});
it.each(["LEADER", "COMPANY_ADMIN", "COLLABORATOR"])("does not load business data for %s", async role => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: [role] });
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByText(/Sólo un consultor/); expect(getProgramReport).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Exportar Excel" })).toBeNull();
});
it("normalizes missing sessions and rejects a different active organization", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValueOnce(new IdentityRequestError(401));
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByText(/Tu sesión no está disponible/); expect(getProgramReport).not.toHaveBeenCalled(); cleanup();
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, activeOrganizationId: "other" });
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByText(/Sólo un consultor/); expect(getProgramReport).not.toHaveBeenCalled();
});
it("clears reports and participant options when authorization expires during export", async () => {
  vi.mocked(exportProgramReport).mockRejectedValue(new ProgramReportError(403));
  render(<ProgramReportArea organizationId="o" programId="p" />);
  fireEvent.click(await screen.findByRole("button", { name: "Exportar Excel" }));
  await screen.findByText(/Sólo un consultor/);
  expect(screen.queryByText("ana@example.test")).toBeNull(); expect(screen.queryByLabelText("Alcance del reporte")).toBeNull();
});
it("downloads the selected format and revokes temporary object URLs", async () => {
  const revoke = vi.fn(); vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:report"), revokeObjectURL: revoke }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.mocked(exportProgramReport).mockResolvedValue(new Blob(["xlsx"]));
  render(<ProgramReportArea organizationId="o" programId="p" />);
  fireEvent.click(await screen.findByRole("button", { name: "Exportar Excel" }));
  await screen.findByText(/Archivo preparado/);
  expect(exportProgramReport).toHaveBeenCalledWith("o", "p", "xlsx", undefined, expect.any(AbortSignal));
  await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:report"), { timeout: 2000 });
});
it("shows no invented progress when the program has no assignments or participants", async () => {
  vi.mocked(getProgramReport).mockResolvedValue({ ...report, participants: [], work: [], summary: { ...summary, participantCount: 0, assigned: 0,
    progressPercentage: null, approvalPercentage: null, participationPercentage: null, onTimePercentage: null } });
  render(<ProgramReportArea organizationId="o" programId="p" />);
  await screen.findByText(/Aún no hay personas inscritas/); expect(screen.getAllByText("No aplica")).toHaveLength(4);
});
