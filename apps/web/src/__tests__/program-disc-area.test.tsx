import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProgramDiscArea } from "@/components/programs/program-disc-area";
import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";
import { listProgramDiscProfiles, saveProgramDiscProfile } from "@/lib/participation/disc-api";

vi.mock("@/lib/auth/authenticated-api", () => ({ fetchCurrentIdentity: vi.fn() }));
vi.mock("@/lib/participation/disc-api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/participation/disc-api")>();
  return { ...actual, listProgramDiscProfiles: vi.fn(), saveProgramDiscProfile: vi.fn() };
});

const participant = { enrollmentId: "enrollment-a", enrollmentStatus: "ACTIVE" as const,
  email: "ana@example.com", firstName: "Ana", lastName: "Prueba", profile: null };
const identity = { cognitoSubject: "subject", user: { id: "user", email: "leader@example.com", firstName: null, lastName: null },
  organizations: [], activeOrganizationId: "org-a", roles: ["LEADER"] };

beforeEach(() => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue(identity);
  vi.mocked(listProgramDiscProfiles).mockResolvedValue({ items: [participant] });
  vi.mocked(saveProgramDiscProfile).mockResolvedValue({ ...participant, profile: {
    id: "profile-a", dominant: "Decide", influential: "Conecta", serene: "Acompaña",
    conscientious: "Analiza", updatedAt: "2026-09-20T10:00:00Z", version: 0,
  } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("lets an authorized leader complete all four DISC fields for one collaborator", async () => {
  render(<ProgramDiscArea organizationId="org-a" programId="program-a" />);
  fireEvent.click(await screen.findByRole("button", { name: "Completar pendientes (1)" }));
  const form = screen.getByRole("form", { name: "Ficha DISC de Ana Prueba" });
  fireEvent.change(within(form).getByLabelText(/Dominante/), { target: { value: "Decide" } });
  fireEvent.change(within(form).getByLabelText(/Influyente/), { target: { value: "Conecta" } });
  fireEvent.change(within(form).getByLabelText(/Sereno/), { target: { value: "Acompaña" } });
  fireEvent.change(within(form).getByLabelText(/Concienzudo/), { target: { value: "Analiza" } });
  fireEvent.submit(form);

  await waitFor(() => expect(saveProgramDiscProfile).toHaveBeenCalledWith("org-a", "program-a", "enrollment-a", {
    dominant: "Decide", influential: "Conecta", serene: "Acompaña", conscientious: "Analiza", version: null,
  }));
  expect(await screen.findByText("Todas las fichas DISC están completas.")).toBeTruthy();
});

it("does not request private DISC data for an unauthorized organization role", async () => {
  vi.mocked(fetchCurrentIdentity).mockResolvedValue({ ...identity, roles: ["COMPANY_ADMIN"] });
  render(<ProgramDiscArea organizationId="org-a" programId="program-a" />);
  expect(await screen.findByText(/Sólo consultores y líderes autorizados/)).toBeTruthy();
  expect(listProgramDiscProfiles).not.toHaveBeenCalled();
  expect(screen.queryByRole("form")).toBeNull();
});
