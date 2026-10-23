import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnrollmentArea, EnrollmentForm } from "@/components/participation/enrollment-area";
import { AccountSession } from "@/components/auth/account-session";
import { AccountWorkspace } from "@/components/auth/account-workspace";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createEnrollment, listEnrollments, retryInvitationDelivery, sendProgramInvitations, ParticipationRequestError, type Enrollment, type InvitationBatch } from "@/lib/participation/participation-api";

vi.mock("aws-amplify/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth/authenticated-api", async original => ({ ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/participation/participation-api", async original => ({ ...await original<typeof import("@/lib/participation/participation-api")>(), createEnrollment: vi.fn(), listEnrollments: vi.fn(), retryInvitationDelivery: vi.fn(), sendProgramInvitations: vi.fn() }));
const identity: CurrentIdentity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const enrollment: Enrollment = { id: "enrollment-a", organizationId: "org-a", programId: "program-a", status: "INVITED",
  participant: { userId: "user-b", membershipId: "membership-b", email: "participant@example.test", firstName: "Ana", lastName: "Prueba" },
  invitation: { id: "invite-a", role: "COLLABORATOR", status: "PENDING", expiresAt: "2026-09-16T00:00:00Z", deliveryStatus: "SENT" } };
const data = { items: [enrollment], page: 0, size: 20, totalElements: 1, totalPages: 1 };
beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity); vi.mocked(listEnrollments).mockResolvedValue(data);
  vi.mocked(createEnrollment).mockResolvedValue(enrollment); vi.mocked(retryInvitationDelivery).mockResolvedValue(enrollment);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function fill() {
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "participant@example.test" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Prueba" } });
}

it("renders actual scoped collaborators and makes no mail delivery claim", async () => {
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText("participant@example.test");
  expect(screen.getByText(/no confirma recepción/)).toBeTruthy();
  expect(screen.getByText("Rol invitado: Colaborador")).toBeTruthy();
  const enrolledPerson = screen.getByText("participant@example.test").closest("li");
  expect(enrolledPerson?.textContent).toContain("Inscripción: Invitada · Invitación: Pendiente");
  expect(enrolledPerson?.textContent).not.toContain("Inscripción: INVITED");
  expect(screen.getByRole("form", { name: "Registrar persona" })).toBeTruthy();
  expect(listEnrollments).toHaveBeenCalledWith("org-a", "program-a", 0, expect.any(AbortSignal));
});
it("denies non-consultants without loading collaborator data", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Sólo un consultor autorizado/); expect(listEnrollments).not.toHaveBeenCalled(); expect(screen.queryByRole("form")).toBeNull();
});
it("does not reuse a consultant role from another organization", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, activeOrganizationId: "org-b" });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText(/Sólo un consultor autorizado/); expect(listEnrollments).not.toHaveBeenCalled();
});
it("shows unavailable without revealing a foreign program", async () => {
  vi.mocked(listEnrollments).mockRejectedValue(new ParticipationRequestError(404));
  render(<EnrollmentArea organizationId="org-a" programId="foreign" />);
  await screen.findByText(/no está disponible para esta cuenta/); expect(screen.queryByRole("form")).toBeNull();
});
it("registers once and refreshes the real list", async () => {
  const draft = { ...enrollment, invitation: { ...enrollment.invitation!, status: "DRAFT" as const, expiresAt: null, deliveryStatus: "PENDING" as const } };
  vi.mocked(createEnrollment).mockResolvedValue(draft);
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [draft] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByRole("form"); fill(); fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Persona registrada sin enviar correos/);
  expect(createEnrollment).toHaveBeenCalledWith("org-a", "program-a", { email: "participant@example.test", firstName: "Ana", lastName: "Prueba", role: "COLLABORATOR" }, expect.any(AbortSignal));
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(2));
  expect(sendProgramInvitations).not.toHaveBeenCalled();
  expect(retryInvitationDelivery).not.toHaveBeenCalled();
  expect(screen.getByText("Registrada")).toBeTruthy();
  expect(screen.queryByText(/^Vence:/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Reintentar envío" })).toBeNull();
});
it("requires confirmation and sends a program-wide batch, not the current page", async () => {
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [], totalElements: 23, totalPages: 2 });
  vi.mocked(sendProgramInvitations).mockResolvedValue({ sent: 22, failed: 1, inProgress: 0, skipped: 0,
    failures: [{ enrollmentId: "off-page", email: "other-page@example.test" }] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  expect(sendProgramInvitations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(sendProgramInvitations).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  await screen.findByText(/22 con envío confirmado por el proveedor, 1 con fallo/);
  await screen.findByText("Hay invitaciones por revisar");
  await screen.findByText("other-page@example.test");
  expect(screen.getByRole("link", { name: "Ver correos con envío no confirmado" }).getAttribute("href")).toBe("#invitation-delivery-failures");
  expect(sendProgramInvitations).toHaveBeenCalledWith("org-a", "program-a", expect.any(AbortSignal));
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(2));
});
it("blocks repeated batch clicks and refresh while sending", async () => {
  vi.mocked(sendProgramInvitations).mockReturnValue(new Promise(() => {}));
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviando invitaciones…" }));
  expect(sendProgramInvitations).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button", { name: "Actualizar listado" }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([undefined, null])("handles clicking send again when a legacy response has no failure details (%s)", async failures => {
  vi.mocked(sendProgramInvitations).mockResolvedValue({ sent: 0, failed: 0, inProgress: 0, skipped: 1, failures } as unknown as InvitationBatch);
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  await screen.findByText("Lista de invitaciones actualizada");
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(2));
  expect(screen.getByText("participant@example.test")).toBeTruthy();
  expect(screen.queryByText("Invitaciones enviadas")).toBeNull();
  expect(screen.queryByText("No se pudo confirmar el envío")).toBeNull();
  expect(sendProgramInvitations).toHaveBeenCalledOnce();
  expect(retryInvitationDelivery).not.toHaveBeenCalled();
});
it("refreshes after an uncertain batch without claiming delivery or automatically retrying", async () => {
  vi.mocked(sendProgramInvitations).mockRejectedValue(new ParticipationRequestError(0));
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  await screen.findByText(/algunos envíos pudieron completarse/);
  await screen.findByText("No se pudo confirmar el envío");
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(2));
  expect(sendProgramInvitations).toHaveBeenCalledTimes(1);
});
it("clears a confirmed individual retry from the failed batch detail and shows success", async () => {
  const failed = { ...enrollment, invitation: { ...enrollment.invitation!, deliveryStatus: "FAILED" as const } };
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [failed] });
  vi.mocked(sendProgramInvitations).mockResolvedValue({ sent: 0, failed: 1, inProgress: 0, skipped: 0,
    failures: [{ enrollmentId: enrollment.id, email: enrollment.participant.email }] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  await screen.findByRole("region", { name: "Envíos no confirmados" });
  vi.mocked(listEnrollments).mockResolvedValue(data);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar envío" }));
  await screen.findByText("Invitación enviada");
  await waitFor(() => expect(screen.queryByRole("region", { name: "Envíos no confirmados" })).toBeNull());
});
it("shows success for a completely confirmed batch and allows closing the popup", async () => {
  vi.mocked(sendProgramInvitations).mockResolvedValue({ sent: 1, failed: 0, inProgress: 0, skipped: 0, failures: [] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar Invitaciones" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar envío" }));
  await screen.findByText("Invitaciones enviadas");
  expect(screen.queryByRole("region", { name: "Envíos no confirmados" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso de invitaciones" }));
  expect(screen.queryByText("Invitaciones enviadas")).toBeNull();
});
it("sends the selected RRHH role as COMPANY_ADMIN", async () => {
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByRole("form"); fill();
  fireEvent.change(screen.getByLabelText("Tipo de invitación"), { target: { value: "COMPANY_ADMIN" } });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(createEnrollment).toHaveBeenCalledWith("org-a", "program-a",
    { email: "participant@example.test", firstName: "Ana", lastName: "Prueba", role: "COMPANY_ADMIN" }, expect.any(AbortSignal)));
});
it("blocks duplicate pending registration", () => {
  vi.mocked(createEnrollment).mockReturnValue(new Promise(() => {}));
  render(<EnrollmentForm organizationId="org-a" programId="program-a" onSaved={vi.fn()} />); fill();
  fireEvent.submit(screen.getByRole("form")); fireEvent.submit(screen.getByRole("form")); expect(createEnrollment).toHaveBeenCalledTimes(1);
});
it("rejects missing or malformed participant input", () => {
  render(<EnrollmentForm organizationId="org-a" programId="program-a" onSaved={vi.fn()} />);
  fireEvent.submit(screen.getByRole("form")); expect(createEnrollment).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Correo electrónico").getAttribute("aria-invalid")).toBe("true");
});
it.each([409, 403, 503, 0])("blocks unsafe resubmission after HTTP %s", async status => {
  vi.mocked(createEnrollment).mockRejectedValue(new ParticipationRequestError(status));
  render(<EnrollmentForm organizationId="org-a" programId="program-a" onSaved={vi.fn()} />); fill(); fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect((screen.getByRole("button", { name: "Agregar persona" }) as HTMLButtonElement).disabled).toBe(true));
  expect(screen.queryByText("Colaborador registrado.")).toBeNull();
});
it("allows a deliberate delivery retry only for a pending invitation with failed delivery", async () => {
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [{ ...enrollment, invitation: { ...enrollment.invitation!, deliveryStatus: "FAILED" } }] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar envío" }));
  await waitFor(() => expect(retryInvitationDelivery).toHaveBeenCalledWith("org-a", "program-a", "enrollment-a", expect.any(AbortSignal)));
});
it("does not offer retry while sending or invent invitations for historical enrollments", async () => {
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [{ ...enrollment, invitation: null },
    { ...enrollment, id: "sending", invitation: { ...enrollment.invitation!, deliveryStatus: "SENDING" } }] });
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByText("No hay invitación asociada."); await screen.findByText(/Envío en curso/);
  expect(screen.queryByRole("button", { name: "Reintentar envío" })).toBeNull();
});
it("aborts and discards delayed data when the program context changes", async () => {
  let resolve!: (value: typeof data) => void;
  vi.mocked(listEnrollments).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(listEnrollments).mock.calls[0][3]!;
  vi.mocked(listEnrollments).mockResolvedValue({ ...data, items: [], totalElements: 0, totalPages: 0 });
  view.rerender(<EnrollmentArea organizationId="org-a" programId="program-b" />);
  await screen.findByText("No hay personas en esta página.");
  await act(async () => resolve(data));
  expect(signal.aborted).toBe(true); expect(screen.queryByText("participant@example.test")).toBeNull();
});
it("keeps invitations reachable from Account when an invited user gets /me 403", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(403));
  render(<AccountWorkspace><AccountSession /></AccountWorkspace>);
  await screen.findByText(/no tienes acceso interno habilitado/);
  expect(screen.getByRole("link", { name: "Invitaciones" }).getAttribute("href")).toBe("/invitations");
});
