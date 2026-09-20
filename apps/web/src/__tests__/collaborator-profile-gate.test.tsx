import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CollaboratorProfileGate } from "@/components/auth/collaborator-profile-gate";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/auth/authenticated-api", async original => ({
  ...await original<typeof import("@/lib/auth/authenticated-api")>(), fetchCurrentIdentity: vi.fn(),
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("redirects an incomplete collaborator before rendering programs", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ cognitoSubject: "subject", user: { id: "user", email: "a@b.co", firstName: null, lastName: null },
    organizations: [{ id: "org-a", name: "Empresa", roles: ["COLLABORATOR"], profileStatus: "PENDING" }],
    activeOrganizationId: "org-a", roles: ["COLLABORATOR"] });
  render(<CollaboratorProfileGate><p>Programas privados</p></CollaboratorProfileGate>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile?organizationId=org-a"));
  expect(screen.queryByText("Programas privados")).toBeNull();
});

it("renders programs when every collaborator profile is complete", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ cognitoSubject: "subject", user: { id: "user", email: "a@b.co", firstName: null, lastName: null },
    organizations: [{ id: "org-a", name: "Empresa", roles: ["COLLABORATOR"], profileStatus: "COMPLETE" }],
    activeOrganizationId: "org-a", roles: ["COLLABORATOR"] });
  render(<CollaboratorProfileGate><p>Programas privados</p></CollaboratorProfileGate>);
  expect(await screen.findByText("Programas privados")).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});
