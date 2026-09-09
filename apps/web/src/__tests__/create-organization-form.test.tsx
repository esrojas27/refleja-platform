import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { OrganizationRequestError } from "@/lib/organizations/create-organization";

const { identity, create } = vi.hoisted(() => ({ identity: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/authenticated-api", async (original) => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: identity,
}));
vi.mock("@/lib/organizations/create-organization", async (original) => ({
  ...await original<typeof import("@/lib/organizations/create-organization")>(), createOrganization: create,
}));

async function fill() {
  fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Empresa Real" } });
  fireEvent.change(screen.getByLabelText("Zona horaria"), { target: { value: "Europe/Madrid" } });
}
describe("Create organization", () => {
  afterEach(cleanup);
  beforeEach(() => { identity.mockReset(); create.mockReset(); identity.mockResolvedValue({ canCreateOrganizations: true }); });

  it("submits only the two fields and displays the returned organization", async () => {
    create.mockResolvedValue({ id: "org-new", name: "Empresa Real", status: "ACTIVE", defaultTimeZone: "Europe/Madrid", version: 0 });
    render(<CreateOrganizationForm />); await fill();
    fireEvent.click(screen.getByRole("button", { name: "Crear organización" }));
    expect(await screen.findByText("Organización creada.")).toBeDefined();
    expect(screen.getByText("Empresa Real")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
    expect(create).toHaveBeenCalledWith({ name: "Empresa Real", defaultTimeZone: "Europe/Madrid" }, expect.any(AbortSignal));
    expect(screen.queryByRole("button", { name: "Crear organización" })).toBeNull();
  });

  it("does not show the form when the server denies the capability, regardless of role strings", async () => {
    identity.mockResolvedValue({ canCreateOrganizations: false, roles: ["CONSULTANT", "SUPER_ADMIN"] });
    render(<CreateOrganizationForm />);
    await screen.findByText("No tienes permiso para crear organizaciones.");
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects blank names and invalid timezones without a write", async () => {
    render(<CreateOrganizationForm />); await fill();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  " } });
    fireEvent.change(screen.getByLabelText("Zona horaria"), { target: { value: "Invalid/Zone" } });
    fireEvent.submit(screen.getByRole("form", { name: "Crear organización" }));
    await screen.findByText("Revisa los campos indicados.");
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre").getAttribute("aria-invalid")).toBe("true");
  });

  it("prevents duplicate submits while a request is in progress", async () => {
    create.mockReturnValue(new Promise(() => {}));
    render(<CreateOrganizationForm />); await fill();
    const form = screen.getByRole("form", { name: "Crear organización" });
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: "Creando…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([401, 403])("removes the form if authorization expires with %s", async status => {
    create.mockRejectedValue(new OrganizationRequestError(status));
    render(<CreateOrganizationForm />); await fill();
    fireEvent.submit(screen.getByRole("form", { name: "Crear organización" }));
    await waitFor(() => expect(screen.queryByLabelText("Nombre")).toBeNull());
    expect(screen.getByRole("link", { name: "Ir a iniciar sesión" })).toBeDefined();
  });

  it("shows field feedback for backend validation and permits correcting the input", async () => {
    create.mockRejectedValue(new OrganizationRequestError(400, ["defaultTimeZone"]));
    render(<CreateOrganizationForm />); await fill();
    fireEvent.submit(screen.getByRole("form", { name: "Crear organización" }));
    await screen.findByText("Revisa el nombre y la zona horaria.");
    expect(screen.getByLabelText("Zona horaria").getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "Crear organización" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("never automatically retries an uncertain network result", async () => {
    create.mockRejectedValue(new TypeError("Network failed"));
    render(<CreateOrganizationForm />); await fill();
    fireEvent.submit(screen.getByRole("form", { name: "Crear organización" }));
    await screen.findByText(/No se pudo confirmar el resultado/);
    fireEvent.submit(screen.getByRole("form", { name: "Crear organización" }));
    expect(create).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Crear organización" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
