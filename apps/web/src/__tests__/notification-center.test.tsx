import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "@/components/layout/notification-center";
import { ActivityLinkTarget } from "@/components/participation/activity-link-target";
import { NotificationRequestError, notificationDestination, type AppNotification } from "@/lib/notifications-api";

const mocks = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), authListener: vi.fn() }));
vi.mock("@/lib/notifications-api", async original => ({
  ...await original<typeof import("@/lib/notifications-api")>(), listNotifications: mocks.list, readNotification: mocks.read,
}));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: (_: string, listener: unknown) => { mocks.authListener(listener); return vi.fn(); } } }));

const item: AppNotification = {
  id: "notification-1", organizationId: "org-a", organizationName: "Empresa A", programId: "program-a", programName: "Programa inicial",
  activityId: "activity-a", activityTitle: "Reflexión", assignmentId: "assignment-a", kind: "ACTIVITY_ASSIGNED", participantName: null, createdAt: "2026-10-22T04:00:00Z", readAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ items: [item], unreadCount: 1, hasMore: false });
  mocks.read.mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

describe("In-app notification center", () => {
  it("shows unread badge, safe content and persists read only after server confirmation", async () => {
    render(<NotificationCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" }));
    await screen.findByText("Reflexión");
    expect(screen.getByRole("dialog", { name: "Notificaciones" })).toBeDefined();
    expect(screen.getByText("Empresa A · Programa inicial")).toBeDefined();
    await waitFor(() => expect(screen.getByRole("button", { name: "Marcar como leída" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(item.id, expect.any(AbortSignal)));
    await screen.findByText("Leída");
    expect(screen.getByText("0 sin leer")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificaciones" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Notificaciones" }));
  });

  it("offers an empty state and never claims success when loading fails", async () => {
    mocks.list.mockResolvedValue({ items: [], unreadCount: 0, hasMore: false });
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    await screen.findByText("No tienes notificaciones");
    mocks.list.mockRejectedValue(new Error("Offline"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("No tienes notificaciones")).toBeNull();
  });

  it("removes stale content on revoked access", async () => {
    render(<NotificationCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" }));
    await screen.findByText("Reflexión");
    mocks.list.mockRejectedValue(new NotificationRequestError(403));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Reflexión")).toBeNull();
  });

  it("hides the inbox immediately on signout", async () => {
    render(<NotificationCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificaciones: 1 sin leer" }));
    await screen.findByText("Reflexión");
    const listener = mocks.authListener.mock.calls[0][0];
    const { act } = await import("@testing-library/react");
    act(() => listener({ payload: { event: "signedOut" } }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Reflexión")).toBeNull();
  });

  it("ignores a late response and stops refreshing after signout", async () => {
    let resolve!: (value: unknown) => void;
    mocks.list.mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<NotificationCenter />);
    const listener = mocks.authListener.mock.calls[0][0];
    const { act } = await import("@testing-library/react");
    await act(async () => {
      listener({ payload: { event: "signedOut" } });
      resolve({ items: [item], unreadCount: 1, hasMore: false });
    });
    fireEvent.focus(window);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Notificaciones/ })).toBeNull();
  });

  it("appends older notifications with the exact cursor and without duplicate ids", async () => {
    mocks.list.mockResolvedValue({ items: [item], unreadCount: 2, hasMore: true });
    render(<NotificationCenter />);
    fireEvent.click(await screen.findByRole("button", { name: "Notificaciones: 2 sin leer" }));
    await screen.findByText("Reflexión");
    mocks.list.mockResolvedValue({ items: [item, { ...item, id: "older", activityTitle: "Anterior" }], unreadCount: 2, hasMore: false });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ver anteriores" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Ver anteriores" }));
    await screen.findByText("Anterior");
    expect(screen.getAllByText("Reflexión")).toHaveLength(1);
    expect(mocks.list).toHaveBeenLastCalledWith(expect.any(AbortSignal), item);
  });

  it("keeps destinations internal and targets the correct participant or consultant activity", () => {
    expect(notificationDestination(item)).toBe("/my-programs/program-a/activities#activity-activity-a");
    expect(notificationDestination({ ...item, kind: "SUBMISSION_RECEIVED" })).toBe("/organizations/org-a/programs/program-a/activities#review-assignment-a");
  });

  it("opens all nested collaborator accordions from a notification link", () => {
    const id = "01900000-0000-7000-8000-000000000001";
    window.history.replaceState({}, "", `/#activity-${id}`);
    render(<><details data-testid="dimension"><summary>Dimensión</summary><details data-testid="session"><summary>Sesión</summary>
      <ul><li id={`activity-${id}`}><details data-testid="activity"><summary>Actividad</summary><p>Instrucciones</p></details></li></ul>
    </details></details><ActivityLinkTarget /></>);
    for (const name of ["dimension", "session", "activity"]) expect(screen.getByTestId(name).hasAttribute("open")).toBe(true);
  });
});
