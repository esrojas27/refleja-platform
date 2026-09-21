import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { consumeAuthReturnPath } from "@/lib/auth/auth-return-path";

const { signInWithRedirect } = vi.hoisted(() => ({
  signInWithRedirect: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({ signInWithRedirect }));
vi.mock("@/lib/auth/amplify-configuration", () => ({
  isAuthenticationConfigured: () => true,
}));

describe("Login page", () => {
  beforeEach(() => {
    signInWithRedirect.mockReset();
    signInWithRedirect.mockResolvedValue(undefined);
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/login?returnTo=%2Finvitations");
  });

  it("starts the Cognito redirect without rendering credential or signup controls", async () => {
    render(<LoginPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continuar con Cognito" }),
    );

    await waitFor(() => expect(signInWithRedirect).toHaveBeenCalledOnce());
    expect(consumeAuthReturnPath()).toBe("/invitations");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/registr/i)).toBeNull();
  });
});
