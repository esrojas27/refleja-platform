import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";

import { completeCollaboratorProfile, getCollaboratorProfile } from "@/lib/auth/profile-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "profile-access" } } } as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("reads and updates only the authenticated organization profile contract", async () => {
  const profile = { organizationId: "org a", email: "ana@example.test", company: "Empresa", status: "PENDING" };
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(profile), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...profile, status: "COMPLETE" }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const input = { fullName: "Ana Prueba", dateOfBirth: "1990-05-12", phone: "+57 300 123 4567",
    city: "Bogotá", country: "Colombia", jobTitle: "Líder de producto" };
  await getCollaboratorProfile("org a");
  await completeCollaboratorProfile("org a", input);
  const url = "http://localhost:8082/api/v1/me/profile?organizationId=org+a";
  expect(fetcher.mock.calls[0]).toEqual([new URL(url), expect.objectContaining({ method: "GET",
    headers: { Authorization: "Bearer profile-access" }, body: undefined })]);
  expect(fetcher.mock.calls[1]).toEqual([new URL(url), expect.objectContaining({ method: "PUT",
    headers: { Authorization: "Bearer profile-access", "Content-Type": "application/json" },
    body: JSON.stringify(input) })]);
});

it("never calls the API without an access token", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(getCollaboratorProfile("org-a")).rejects.toMatchObject({ status: 401 });
  expect(fetcher).not.toHaveBeenCalled();
});
