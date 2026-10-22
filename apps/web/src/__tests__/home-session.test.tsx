import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { HomeAccountLink, HomeSessionProvider } from "@/components/auth/home-session";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: vi.fn() } }));
const authenticated = { tokens: { accessToken: { toString: () => "synthetic-token" } } };
const stop = vi.fn();
function HomeLinks() {
  return <HomeSessionProvider>
    <HomeAccountLink className="header-link">Iniciar sesión</HomeAccountLink>
    <HomeAccountLink className="hero-link">Entrar a la plataforma</HomeAccountLink>
  </HomeSessionProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Hub.listen).mockReturnValue(stop);
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
});
afterEach(cleanup);

it("shows login links to guests after a single shared session check", async () => {
  render(<HomeLinks />);
  expect((await screen.findByRole("link", { name: "Iniciar sesión" })).getAttribute("href")).toBe("/login");
  expect(screen.getByRole("link", { name: "Entrar a la plataforma" }).getAttribute("href")).toBe("/login");
  expect(fetchAuthSession).toHaveBeenCalledTimes(1);
});

it("shows account links for an existing Cognito session without requiring API authorization", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue(authenticated as never);
  render(<HomeLinks />);
  for (const link of await screen.findAllByRole("link", { name: "Volver a mi cuenta" })) expect(link.getAttribute("href")).toBe("/account");
  expect(screen.queryByText("Iniciar sesión")).toBeNull();
});

it("offers login if the session cannot be recovered", async () => {
  vi.mocked(fetchAuthSession).mockRejectedValue(new Error("Session expired"));
  render(<HomeLinks />);
  expect(await screen.findByRole("link", { name: "Iniciar sesión" })).toBeTruthy();
});

it("does not offer a misleading login while the session check is pending", () => {
  vi.mocked(fetchAuthSession).mockReturnValue(new Promise(() => {}));
  render(<HomeLinks />);
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getAllByText("Comprobando sesión…")).toHaveLength(2);
});

it("ignores a stale session check after sign-out and removes listeners on unmount", async () => {
  let resolve!: (value: never) => void;
  vi.mocked(fetchAuthSession).mockReturnValue(new Promise(done => { resolve = done; }));
  const { unmount } = render(<HomeLinks />);
  const callback = vi.mocked(Hub.listen).mock.calls[0][1];
  act(() => callback({ payload: { event: "signedOut" } } as never));
  await act(async () => resolve(authenticated as never));
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toBeTruthy();
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it("rechecks the session when the user returns to the window", async () => {
  render(<HomeLinks />);
  await screen.findByRole("link", { name: "Iniciar sesión" });
  vi.mocked(fetchAuthSession).mockResolvedValue(authenticated as never);
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(screen.getAllByRole("link", { name: "Volver a mi cuenta" })).toHaveLength(2));
});

it("does not recursively retry a failed token refresh", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue(authenticated as never);
  render(<HomeLinks />);
  await screen.findAllByRole("link", { name: "Volver a mi cuenta" });
  act(() => vi.mocked(Hub.listen).mock.calls[0][1]({ payload: { event: "tokenRefresh_failure" } } as never));
  expect(screen.getByRole("link", { name: "Iniciar sesión" })).toBeTruthy();
  expect(fetchAuthSession).toHaveBeenCalledTimes(1);
});
