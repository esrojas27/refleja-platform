import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSession } from "@/components/auth/account-session";
import { IdentityRequestError, type CurrentIdentity } from "@/lib/auth/authenticated-api";

const { fetchCurrentIdentity, signOut } = vi.hoisted(() => ({
  fetchCurrentIdentity: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({ signOut }));
vi.mock("@/lib/auth/authenticated-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/authenticated-api")>(),
  fetchCurrentIdentity,
}));

const identity: CurrentIdentity = {
  cognitoSubject: "test-subject",
  user: { id: "user-1", email: "user@example.test", firstName: "Test", lastName: "User" },
  organizations: [], activeOrganizationId: null, roles: [],
};

describe("Account session", () => {
  afterEach(cleanup);

  beforeEach(() => {
    fetchCurrentIdentity.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
  });

  it("ends the Cognito session through Amplify Auth", async () => {
    render(<AccountSession />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it("shows the identity returned by the authenticated API", async () => {
    fetchCurrentIdentity.mockResolvedValue(identity);
    render(<AccountSession />);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText("Sesión autenticada.")).toBeDefined();
    expect(screen.getByText("test-subject")).toBeDefined();
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("No tienes organizaciones disponibles.")).toBeDefined();
  });

  it("clears the previous identity when the session is no longer available", async () => {
    fetchCurrentIdentity.mockResolvedValueOnce(identity);
    render(<AccountSession />);
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
    render(<AccountSession />);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    await screen.findByText("test-subject");
    fetchCurrentIdentity.mockRejectedValueOnce(new IdentityRequestError(status));
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect(await screen.findByText(message)).toBeDefined();
    expect(screen.queryByText("test-subject")).toBeNull();
  });

  it("asks the backend to select an organization without merging its roles", async () => {
    const multiple = { ...identity, organizations: [
      { id: "org-a", name: "Organization A", roles: ["COLLABORATOR"] },
      { id: "org-b", name: "Organization B", roles: ["CONSULTANT"] },
    ] };
    fetchCurrentIdentity.mockResolvedValueOnce(multiple);
    render(<AccountSession />);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    const select = await screen.findByRole("combobox", { name: "Organización activa" });
    expect((select as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/Roles activos:/)).toBeNull();
    fetchCurrentIdentity.mockResolvedValueOnce({ ...multiple, activeOrganizationId: "org-b", roles: ["CONSULTANT"] });
    fireEvent.change(select, { target: { value: "org-b" } });
    expect(await screen.findByText("Roles activos: CONSULTANT")).toBeDefined();
    expect(fetchCurrentIdentity).toHaveBeenLastCalledWith("org-b", expect.any(AbortSignal));
    expect(screen.queryByText(/Roles activos:.*COLLABORATOR/)).toBeNull();
  });

  it("offers self-service programs when any active organization has the collaborator role", async () => {
    fetchCurrentIdentity.mockResolvedValue({ ...identity, organizations: [
      { id: "org-a", name: "Organization A", roles: ["COLLABORATOR"] },
    ], activeOrganizationId: "org-a", roles: ["COLLABORATOR"] });
    render(<AccountSession />);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    expect((await screen.findByRole("link", { name: "Mis programas" })).getAttribute("href")).toBe("/my-programs");
  });

  it("does not restore identity when an in-flight request finishes after logout", async () => {
    let resolveIdentity!: (value: CurrentIdentity) => void;
    fetchCurrentIdentity.mockImplementationOnce(() => new Promise<CurrentIdentity>((resolve) => { resolveIdentity = resolve; }));
    render(<AccountSession />);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar sesión" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await screen.findByText("Sesión cerrada.");
    resolveIdentity(identity);
    await waitFor(() => expect(fetchCurrentIdentity.mock.calls[0][1].aborted).toBe(true));
    expect(screen.queryByText("test-subject")).toBeNull();
  });
});
