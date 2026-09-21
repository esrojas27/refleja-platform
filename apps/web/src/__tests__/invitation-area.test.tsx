import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { InvitationArea } from "@/components/participation/invitation-area";
import { ParticipationRequestError } from "@/lib/participation/participation-api";

const { listInvitations, replace } = vi.hoisted(() => ({
  listInvitations: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/participation/participation-api", async original => ({
  ...await original<typeof import("@/lib/participation/participation-api")>(),
  listInvitations,
}));

beforeEach(() => {
  replace.mockReset();
  listInvitations.mockReset();
  listInvitations.mockRejectedValue(new ParticipationRequestError(401));
});
afterEach(cleanup);

it("redirects an unauthenticated invitee to Cognito login with a safe return path", async () => {
  render(<InvitationArea />);

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Finvitations"));
});
