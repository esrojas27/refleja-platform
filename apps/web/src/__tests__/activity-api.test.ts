import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createProgramActivity, listMyProgramActivities, listProgramActivities } from "@/lib/participation/activity-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
const session = { tokens: { accessToken: { toString: () => "activity-access" } } };

describe("activity API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
    vi.mocked(fetchAuthSession).mockResolvedValue(session as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses tenant-scoped consultant paths and sends only the activity contract", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "activity-a" }), { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const input = { sessionId: "session-a", title: "Reflexión", instructions: "Escribe", dueDate: "2026-10-08",
      position: 1, enrollmentIds: ["enrollment-a"] };
    await listProgramActivities("org a", "program/a");
    await createProgramActivity("org a", "program/a", input);
    const path = "http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/activities";
    expect(fetcher.mock.calls[0][0]).toBe(path);
    expect(fetcher.mock.calls[1]).toEqual([path, expect.objectContaining({ method: "POST", body: JSON.stringify(input),
      headers: { Authorization: "Bearer activity-access", "Content-Type": "application/json" } })]);
  });

  it("derives collaborator ownership exclusively from the access token", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await listMyProgramActivities("program/a");
    expect(fetcher).toHaveBeenCalledWith("http://localhost:8082/api/v1/me/programs/program%2Fa/activities",
      expect.objectContaining({ method: "GET", body: undefined, headers: { Authorization: "Bearer activity-access" } }));
  });

  it("does not call the backend without an access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listMyProgramActivities("program")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
