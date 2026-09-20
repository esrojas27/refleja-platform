import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AccountWorkspace } from "@/components/auth/account-workspace";

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
  expect(screen.getByRole("link", { name: "Mis programas" }).getAttribute("href")).toBe("/my-programs");
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
