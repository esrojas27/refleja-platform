import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSession } from "@/components/auth/account-session";

const { fetchCurrentIdentity, signOut } = vi.hoisted(() => ({
  fetchCurrentIdentity: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("aws-amplify/auth", () => ({ signOut }));
vi.mock("@/lib/auth/authenticated-api", () => ({ fetchCurrentIdentity }));

describe("Account session", () => {
  beforeEach(() => {
    fetchCurrentIdentity.mockReset();
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
  });

  it("ends the Cognito session through Amplify Auth", async () => {
    render(<AccountSession />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });
});
