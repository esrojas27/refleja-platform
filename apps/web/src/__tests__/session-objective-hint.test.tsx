import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionObjectiveHint } from "@/components/participation/session-objective-hint";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("hides the optional hint when the session has no objective", () => {
  const { rerender } = render(<SessionObjectiveHint sessionName="Interior" />);
  expect(screen.queryByRole("button")).toBeNull();
  rerender(<SessionObjectiveHint sessionName="Interior" objective="  " />);
  expect(screen.queryByRole("button")).toBeNull();
});

it("opens on click and dismisses with Escape without displaying text initially", async () => {
  render(<SessionObjectiveHint sessionName="Interior" objective="Reconocer mis fortalezas" />);
  expect(screen.queryByText("Reconocer mis fortalezas")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Ver objetivo de la sesión Interior" });
  fireEvent.click(trigger);
  expect(await screen.findByText("Reconocer mis fortalezas")).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await waitFor(() => expect(screen.queryByText("Reconocer mis fortalezas")).toBeNull());
});
