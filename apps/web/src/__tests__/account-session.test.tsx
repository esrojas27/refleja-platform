import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSession } from "@/components/auth/account-session";
import { AccountWorkspace } from "@/components/auth/account-workspace";
import { IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";

const { fetchCurrentIdentity, signOut, router } = vi.hoisted(() => ({
  fetchCurrentIdentity: vi.fn(),
  signOut: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("aws-amplify/auth", () => ({ signOut }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => router }));
vi.mock("@/lib/auth/authenticated-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authenticated-api")>(),
  fetchCurrentIdentity,
}));

const identity: CurrentIdentity = {
  cognitoSubject: "test-subject",
  user: { id: "user-1", email: "user@example.test", firstName: "Test", lastName: "User" },
  organizations: [], activeOrganizationId: null, roles: [],
};

function renderAccount() {
  return render(<AccountWorkspace><AccountSession /></AccountWorkspace>);
}

describe("Account session", () => {
  afterEach(cleanup);

  beforeEach(() => {
    fetchCurrentIdentity.mockReset();
    fetchCurrentIdentity.mockRejectedValue(new IdentityRequestError(401));
    signOut.mockReset();
    router.replace.mockReset();
    signOut.mockResolvedValue(undefined);
  });

  it("ends the Cognito session through Amplify Auth", async () => {
    renderAccount();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it("shows the identity returned by the authenticated API", async () => {
    fetchCurrentIdentity.mockResolvedValue(identity);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText("Sesión autenticada.")).toBeDefined();
    expect(screen.getByText("test-subject")).toBeDefined();
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("No tienes organizaciones disponibles.")).toBeDefined();
  });

  it("clears the previous identity when the session is no longer available", async () => {
    fetchCurrentIdentity.mockResolvedValueOnce(identity);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    await screen.findByText("test-subject");
    fetchCurrentIdentity.mockRejectedValueOnce(new IdentityRequestError(401));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText("No hay una sesión autenticada disponible.")).toBeDefined();
    expect(screen.queryByText("test-subject")).toBeNull();
  });

  it.each([
    [403, "Tu sesión de Cognito es válida, pero no tienes acceso interno habilitado."],
    [404, "La organización ya no está disponible. Comprueba de nuevo la sesión."],
    [500, "No se pudo consultar el acceso. Inténtalo de nuevo."],
  ])("distinguishes an API %s from a missing session and clears stale access", async (status, message) => {
    fetchCurrentIdentity.mockResolvedValueOnce(identity);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    await screen.findByText("test-subject");
    fetchCurrentIdentity.mockRejectedValueOnce(new IdentityRequestError(status));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText(message)).toBeDefined();
    expect(screen.queryByText("test-subject")).toBeNull();
  });

  it("asks the backend to select an organization without merging its roles", async () => {
    const multiple = { ...identity, organizations: [
      { id: "org-a", name: "Organization A", roles: ["COLLABORATOR"], profileStatus: "COMPLETE" as const },
      { id: "org-b", name: "Organization B", roles: ["CONSULTANT"], profileStatus: "COMPLETE" as const },
    ] };
    fetchCurrentIdentity.mockResolvedValueOnce(multiple);
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    const select = await screen.findByRole("combobox", { name: "Organización activa" });
    expect(select.textContent).toContain("Selecciona una organización");
    expect(screen.queryByText(/Roles activos:/)).toBeNull();
    fetchCurrentIdentity.mockResolvedValueOnce({ ...multiple, activeOrganizationId: "org-b", roles: ["CONSULTANT"] });
    fireEvent.click(select);
    const organization = await screen.findByRole("option", { name: "Organization B" });
    fireEvent.pointerDown(organization, { pointerType: "mouse" });
    fireEvent.click(organization);
    expect(await screen.findByText("Roles activos: Consultor")).toBeDefined();
    expect(fetchCurrentIdentity).toHaveBeenLastCalledWith("org-b", expect.any(AbortSignal));
    expect(screen.queryByText(/Roles activos:.*COLLABORATOR/)).toBeNull();
  });

  it("presents COMPANY_ADMIN with the product label RRHH", async () => {
    fetchCurrentIdentity.mockResolvedValue({
      ...identity,
      organizations: [{ id: "org-a", name: "Organization A", roles: ["COMPANY_ADMIN"], profileStatus: "COMPLETE" }],
      activeOrganizationId: "org-a",
      roles: ["COMPANY_ADMIN"],
    });
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText("Roles activos: RRHH")).toBeDefined();
    expect(screen.queryByText(/Roles activos:.*COMPANY_ADMIN/)).toBeNull();
  });

  it("offers self-service programs when any active organization has the collaborator role", async () => {
    fetchCurrentIdentity.mockResolvedValue({ ...identity, organizations: [
      { id: "org-a", name: "Organization A", roles: ["COLLABORATOR"], profileStatus: "COMPLETE" },
    ], activeOrganizationId: "org-a", roles: ["COLLABORATOR"] });
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect((await screen.findByRole("link", { name: "Mis programas" })).getAttribute("href")).toBe("/my-programs");
    expect(screen.getByText("Perfil verificado")).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Secciones de la cuenta" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Cuenta" }).getAttribute("aria-current")).toBe("page");
  });

  it("redirects a collaborator with a pending profile and withholds program access", async () => {
    fetchCurrentIdentity.mockResolvedValue({ ...identity, organizations: [
      { id: "org-a", name: "Organization A", roles: ["COLLABORATOR"], profileStatus: "PENDING" },
    ], activeOrganizationId: "org-a", roles: ["COLLABORATOR"] });
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/profile?organizationId=org-a"));
    expect(screen.getByText("Perfil pendiente")).toBeDefined();
    expect(screen.getByRole("link", { name: "Mis programas" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Mi perfil" })).toBeDefined();
  });

  it("does not restore identity when an in-flight request finishes after logout", async () => {
    let resolveIdentity!: (value: CurrentIdentity) => void;
    fetchCurrentIdentity.mockImplementationOnce(() => new Promise<CurrentIdentity>((resolve) => { resolveIdentity = resolve; }));
    renderAccount();
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await screen.findByText("Sesión cerrada.");
    resolveIdentity(identity);
    await waitFor(() => expect(fetchCurrentIdentity.mock.calls[0][1].aborted).toBe(true));
    expect(screen.queryByText("test-subject")).toBeNull();
  });
});
