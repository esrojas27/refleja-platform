import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnrollmentArea, EnrollmentForm } from "@/components/participation/enrollment-area";
import { AccountSession } from "@/components/auth/account-session";
import { fetchCurrentIdentity, IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";
import { createEnrollment, listEnrollments, retryInvitationDelivery, ParticipationRequestError, type Enrollment } from "@/lib/participation/participation-api";

vi.mock("aws-amplify/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth/authenticated-api", async original => ({ ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/participation/participation-api", async original => ({ ...await original<typeof import("@/lib/participation/participation-api")>(), createEnrollment: vi.fn(), listEnrollments: vi.fn(), retryInvitationDelivery: vi.fn() }));
const identity: CurrentIdentity = { cognitoSubject: "subject", user: { id: "user", email: "consultant@example.test", firstName: null, lastName: null },
  organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"] }], activeOrganizationId: "org-a", roles: ["CONSULTANT"] };
const enrollment: Enrollment = { id: "enrollment-a", organizationId: "org-a", programId: "program-a", status: "INVITED",
  participant: { userId: "user-b", membershipId: "membership-b", email: "participant@example.test", firstName: "Ana", lastName: "Prueba" },
  invitation: { id: "invite-a", status: "PENDING", expiresAt: "2026-09-16T00:00:00Z", deliveryStatus: "SENT" } };
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
  expect(screen.getByRole("form", { name: "Registrar colaborador" })).toBeTruthy();
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
  render(<EnrollmentArea organizationId="org-a" programId="program-a" />);
  await screen.findByRole("form"); fill(); fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Registro guardado: INVITED/);
  expect(createEnrollment).toHaveBeenCalledWith("org-a", "program-a", { email: "participant@example.test", firstName: "Ana", lastName: "Prueba" }, expect.any(AbortSignal));
  await waitFor(() => expect(listEnrollments).toHaveBeenCalledTimes(2));
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
  await waitFor(() => expect((screen.getByRole("button", { name: "Registrar e invitar" }) as HTMLButtonElement).disabled).toBe(true));
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
  await screen.findByText("No hay colaboradores en esta página.");
  await act(async () => resolve(data));
  expect(signal.aborted).toBe(true); expect(screen.queryByText("participant@example.test")).toBeNull();
});
it("keeps invitations reachable from Account when an invited user gets /me 403", async () => {
  vi.mocked(fetchCurrentIdentity).mockRejectedValue(new IdentityRequestError(403));
  render(<AccountSession />); fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
  await screen.findByText(/no tienes acceso interno habilitado/);
  expect(screen.getByRole("link", { name: "Invitaciones" }).getAttribute("href")).toBe("/invitations");
});
