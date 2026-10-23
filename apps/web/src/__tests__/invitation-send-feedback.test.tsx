import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvitationSendFeedback, batchFeedback, type InvitationFeedback } from "@/components/participation/invitation-send-feedback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const success: InvitationFeedback = { id: 1, tone: "success", title: "Invitaciones enviadas", message: "Envío confirmado por el proveedor.", hasFailures: false };

it("animates a non-modal success notice and dismisses it after eight seconds", () => {
  const dismiss = vi.fn();
  render(<InvitationSendFeedback feedback={success} onDismiss={dismiss} />);
  const notice = screen.getByRole("status", { name: "Resultado del envío de invitaciones" });
  expect(notice.className).toContain("animate-in");
  expect(notice.className).toContain("motion-reduce:animate-none");
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => vi.advanceTimersByTime(8_000));
  expect(dismiss).toHaveBeenCalledOnce();
});
it("pauses automatic dismissal while hovered or focused", () => {
  const dismiss = vi.fn();
  render(<InvitationSendFeedback feedback={success} onDismiss={dismiss} />);
  const notice = screen.getByRole("status");
  fireEvent.mouseEnter(notice);
  act(() => vi.advanceTimersByTime(10_000));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.mouseLeave(notice);
  fireEvent.focus(screen.getByRole("button", { name: "Cerrar aviso de invitaciones" }));
  act(() => vi.advanceTimersByTime(10_000));
  expect(dismiss).not.toHaveBeenCalled();
});
it("keeps warnings visible and links to the persistent failure details", () => {
  const dismiss = vi.fn();
  render(<InvitationSendFeedback feedback={{ ...success, tone: "warning", title: "Hay invitaciones por revisar", hasFailures: true }} onDismiss={dismiss} />);
  expect(screen.getByRole("alert")).toBeTruthy();
  act(() => vi.advanceTimersByTime(60_000));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("link", { name: "Ver correos con envío no confirmado" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
it("does not call partial failure or in-progress batches successful", () => {
  const base = { sent: 2, failed: 0, inProgress: 0, skipped: 0, failures: [] };
  expect(batchFeedback({ ...base, failed: 1 }).tone).toBe("warning");
  expect(batchFeedback({ ...base, inProgress: 1 }).tone).toBe("info");
  expect(batchFeedback({ ...base, sent: 0 }).tone).toBe("info");
  expect(batchFeedback(base).tone).toBe("success");
});
