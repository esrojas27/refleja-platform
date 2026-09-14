import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MyProgramArea } from "@/components/participation/my-program-area";
import { getMyProgram, listMyPrograms, ParticipationRequestError, type MyProgram } from "@/lib/participation/participation-api";
import { listMyProgramActivities } from "@/lib/participation/activity-api";

vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(),
  getMyProgram: vi.fn(), listMyPrograms: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(), listMyProgramActivities: vi.fn(),
}));

const program: MyProgram = {
  id: "program-a", organizationId: "org-a", organizationName: "Empresa A",
  name: "Tu historia, tu mayor diferencial", description: "Programa asignado", status: "DRAFT",
  startDate: "2026-09-01", endDate: "2026-12-01", version: 0,
};
const page = { items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 };

beforeEach(() => {
  vi.mocked(listMyPrograms).mockResolvedValue(page);
  vi.mocked(getMyProgram).mockResolvedValue(program);
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{ id: "activity-a", organizationId: "org-a",
    programId: "program-a", moduleId: "module-a", sessionId: "session-a", title: "Reflexión inicial",
    instructions: "Describe tu punto de partida.", dueDate: "2026-10-08", position: 1, version: 0 }] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("renders only the collaborator's returned programs with basic metadata", async () => {
  render(<MyProgramArea mode="list" />);
  expect((await screen.findByRole("link", { name: program.name })).getAttribute("href")).toBe("/my-programs/program-a");
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(screen.getByText("2026-09-01 — 2026-12-01")).toBeTruthy();
  expect(screen.getByText("DRAFT")).toBeTruthy();
  expect(listMyPrograms).toHaveBeenCalledWith(0, expect.any(AbortSignal));
  expect(screen.queryByText(/progreso/i)).toBeNull();
});

it("opens basic detail without requesting a participant or organization identifier", async () => {
  render(<MyProgramArea mode="detail" programId="program-a" />);
  expect(await screen.findByText("Programa asignado")).toBeTruthy();
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(getMyProgram).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it.each([
  [401, "Tu sesión no está disponible"],
  [403, "No tienes acceso activo como colaborador"],
  [404, "El programa no está disponible para esta cuenta"],
])("shows the safe state for HTTP %s", async (status, message) => {
  vi.mocked(listMyPrograms).mockRejectedValue(new ParticipationRequestError(status));
  render(<MyProgramArea mode="list" />);
  expect(await screen.findByText(new RegExp(message))).toBeTruthy();
  expect(screen.queryByText(program.name)).toBeNull();
});

it("paginates only through the self-service API", async () => {
  vi.mocked(listMyPrograms).mockResolvedValueOnce({ ...page, totalElements: 21, totalPages: 2 });
  render(<MyProgramArea mode="list" />);
  fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(listMyPrograms).toHaveBeenLastCalledWith(1, expect.any(AbortSignal)));
});

it("aborts and discards delayed list data after unmount", async () => {
  let resolve!: (value: typeof page) => void;
  vi.mocked(listMyPrograms).mockReturnValue(new Promise(done => { resolve = done; }));
  const view = render(<MyProgramArea mode="list" />);
  await waitFor(() => expect(listMyPrograms).toHaveBeenCalledOnce());
  const signal = vi.mocked(listMyPrograms).mock.calls[0][1]!;
  view.unmount();
  await act(async () => resolve(page));
  expect(signal.aborted).toBe(true);
});
