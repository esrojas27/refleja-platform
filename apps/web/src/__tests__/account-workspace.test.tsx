import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AccountWorkspace } from "@/components/auth/account-workspace";
import { IdentityRequestError } from "@/lib/auth/authenticated-api";
import { rememberAuthReturnPath } from "@/lib/auth/auth-return-path";

const { fetchCurrentIdentity, navigation, replace, signOut } = vi.hoisted(() => ({
  fetchCurrentIdentity: vi.fn(),
  navigation: { pathname: "/invitations" },
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({ signOut }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(),
  fetchCurrentIdentity,
}));

beforeEach(() => {
  navigation.pathname = "/invitations";
  replace.mockReset();
  signOut.mockReset();
  window.sessionStorage.clear();
  fetchCurrentIdentity.mockReset();
  fetchCurrentIdentity.mockResolvedValue({
    cognitoSubject: "subject",
    user: { id: "user", email: "user@example.test", firstName: "Ana", lastName: "Prueba" },
    organizations: [{ id: "org-a", name: "Empresa A", roles: ["COLLABORATOR"], profileStatus: "COMPLETE" }],
    activeOrganizationId: "org-a",
    roles: ["COLLABORATOR"],
  });
});
afterEach(cleanup);

it("returns an authenticated invitee to invitations even before internal access is active", async () => {
  navigation.pathname = "/account";
  rememberAuthReturnPath("/invitations");
  fetchCurrentIdentity.mockRejectedValue(new IdentityRequestError(403));

  render(<AccountWorkspace><h1>Cuenta</h1></AccountWorkspace>);

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/invitations"));
});

it.each([
  ["/invitations", "Invitaciones"],
  ["/my-programs", "Mis programas"],
  ["/profile", "Mi perfil"],
])("keeps the account menu visible at %s", async (pathname, selected) => {
  navigation.pathname = pathname;
  render(<AccountWorkspace><h1>Contenido</h1></AccountWorkspace>);

  expect(screen.getByRole("navigation", { name: "Secciones de la cuenta" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Cuenta" }).getAttribute("href")).toBe("/account");
  expect(screen.getByRole("link", { name: "Invitaciones" }).getAttribute("href")).toBe("/invitations");
  expect((await screen.findByRole("link", { name: "Mis programas" })).getAttribute("href")).toBe("/my-programs");
  expect((await screen.findByRole("link", { name: selected })).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByRole("link", { name: "Mi perfil" })).toBeDefined();
});

it("leaves program detail navigation to the program workspace", () => {
  navigation.pathname = "/my-programs/program-a";
  render(<AccountWorkspace><h1>Detalle contextual</h1></AccountWorkspace>);
  expect(screen.getByRole("heading", { name: "Detalle contextual" })).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "Secciones de la cuenta" })).toBeNull();
  expect(fetchCurrentIdentity).not.toHaveBeenCalled();
});

it.each([
  "/organizations/org-a/programs",
  "/organizations/org-a/programs/new",
])("keeps the account menu visible at %s and selects Ver programas", async pathname => {
  navigation.pathname = pathname;
  fetchCurrentIdentity.mockResolvedValue({
    cognitoSubject: "subject",
    user: { id: "user", email: "consultant@example.test", firstName: "Ana", lastName: "Prueba" },
    organizations: [{ id: "org-a", name: "Empresa A", roles: ["CONSULTANT"], profileStatus: "COMPLETE" }],
    activeOrganizationId: "org-a",
    roles: ["CONSULTANT"],
  });

  render(<AccountWorkspace><h1>Programas</h1></AccountWorkspace>);

  expect(screen.getByRole("navigation", { name: "Secciones de la cuenta" })).toBeDefined();
  expect((await screen.findByRole("link", { name: "Ver programas" })).getAttribute("aria-current")).toBe("page");
  await waitFor(() => expect(fetchCurrentIdentity).toHaveBeenCalledWith("org-a", expect.any(AbortSignal)));
  expect(screen.queryByRole("link", { name: "Mis programas" })).toBeNull();
});
