import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MyProgramArea } from "@/components/participation/my-program-area";
import { getMyProgram, listMyPrograms, ParticipationRequestError, type MyProgram } from "@/lib/participation/participation-api";
import { listMyProgramActivities, submitMyActivity, type AssignedActivity } from "@/lib/participation/activity-api";

vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(),
  getMyProgram: vi.fn(), listMyPrograms: vi.fn(),
}));
vi.mock("@/lib/participation/activity-api", async original => ({
  ...await original<typeof import("@/lib/participation/activity-api")>(),
  listMyProgramActivities: vi.fn(), submitMyActivity: vi.fn(),
}));

const program: MyProgram = {
  id: "program-a", organizationId: "org-a", organizationName: "Empresa A",
  name: "Tu historia, tu mayor diferencial", description: "Programa asignado", status: "DRAFT",
  startDate: "2026-09-01", endDate: "2026-12-01", version: 0,
};
const page = { items: [program], page: 0, size: 20, totalElements: 1, totalPages: 1 };
const assignedActivity: AssignedActivity = { id: "activity-a", organizationId: "org-a",
  programId: "program-a", moduleId: "module-a", sessionId: "session-a",
  dimensionName: "Interior", sessionName: "Autoconocimiento", title: "Reflexión inicial",
  instructions: "Describe tu punto de partida.", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
  dueDate: "2026-10-08", position: 1, version: 0,
  assignmentId: "assignment-a", assignmentStatus: "ASSIGNED", responseText: null, submittedAt: null,
  reviewComment: null, reviewedAt: null, assignmentVersion: 0 };

beforeEach(() => {
  vi.mocked(listMyPrograms).mockResolvedValue(page);
  vi.mocked(getMyProgram).mockResolvedValue(program);
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [assignedActivity] });
  vi.mocked(submitMyActivity).mockResolvedValue({ ...assignedActivity, assignmentStatus: "SUBMITTED",
    responseText: "Mi reflexión", submittedAt: "2026-10-07T12:00:00Z", assignmentVersion: 1 });
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

it("opens the program summary with progress without requesting participant identifiers", async () => {
  render(<MyProgramArea mode="summary" programId="program-a" />);
  expect(await screen.findByText("Programa asignado")).toBeTruthy();
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(getMyProgram).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
  expect(await screen.findByRole("heading", { name: "Progreso del programa" })).toBeTruthy();
  expect(screen.queryByText("Reflexión inicial")).toBeNull();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it("shows assigned work only in the activities section", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  expect(await screen.findByText("Reflexión inicial")).toBeTruthy();
  expect(screen.getByText("Interior · Autoconocimiento · Actividad 1")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver video en YouTube" }).getAttribute("href")).toBe("https://youtu.be/dQw4w9WgXcQ");
  expect(screen.queryByRole("heading", { name: "Progreso del programa" })).toBeNull();
  expect(listMyProgramActivities).toHaveBeenCalledWith("program-a", expect.any(AbortSignal));
});

it("shows overdue as a visual activity label without replacing its workflow state", async () => {
  vi.mocked(listMyProgramActivities).mockResolvedValue({ items: [{
    ...assignedActivity,
    dueDate: "2020-01-01", assignmentStatus: "CHANGES_REQUESTED",
  }] });
  render(<MyProgramArea mode="activities" programId="program-a" />);
  expect(await screen.findByText("Requiere cambios")).toBeTruthy();
  expect(screen.getByText("Vencida")).toBeTruthy();
});

it("lets the collaborator complete an assigned activity with a textual response", async () => {
  render(<MyProgramArea mode="activities" programId="program-a" />);
  fireEvent.change(await screen.findByLabelText("Tu respuesta"), { target: { value: " Mi reflexión " } });
  fireEvent.click(screen.getByRole("button", { name: "Completar actividad" }));
  await waitFor(() => expect(submitMyActivity).toHaveBeenCalledWith("program-a", "activity-a", "Mi reflexión"));
  expect(within(screen.getByLabelText("Estado de la actividad")).getByText("En revisión")).toBeTruthy();
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
