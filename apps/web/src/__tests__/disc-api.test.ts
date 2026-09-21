import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { listProgramDiscProfiles, saveProgramDiscProfile } from "@/lib/participation/disc-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

describe("DISC API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
    vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "disc-token" } } } as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses tenant and program scoped paths without user-selected ownership", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ enrollmentId: "enrollment-a" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const input = { dominant: "Decide", influential: "Conecta", serene: "Acompaña",
      conscientious: "Analiza", version: null };

    await listProgramDiscProfiles("org a", "program/a");
    await saveProgramDiscProfile("org a", "program/a", "enrollment/a", input);

    const base = "http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/disc-profiles";
    expect(fetcher.mock.calls[0][0]).toBe(base);
    expect(fetcher.mock.calls[1]).toEqual([`${base}/enrollment%2Fa`, expect.objectContaining({
      method: "PUT", body: JSON.stringify(input),
      headers: { Authorization: "Bearer disc-token", "Content-Type": "application/json" },
    })]);
  });

  it("does not call the backend without a Cognito access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listProgramDiscProfiles("org", "program")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
