import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createProgramDimension, createProgramSession, listProgramDimensions } from "@/lib/programs/program-content-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
const session = { tokens: { accessToken: { toString: () => "access-token" } } };

describe("program content API", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
    vi.mocked(fetchAuthSession).mockResolvedValue(session as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("loads the tenant and program scoped dimension structure without cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await listProgramDimensions("org a", "program/a", signal);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/modules",
      expect.objectContaining({ method: "GET", signal, cache: "no-store", headers: { Authorization: "Bearer access-token" } }),
    );
  });

  it("sends the dimension and session creation contracts over the compatible v1 paths", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "module-a", sessions: [] }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "session-a" }), { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const dimensionInput = { name: "Interior", description: "Contexto", position: 1 };
    const sessionInput = { name: "Sesión inicial", objective: "Encuentro", scheduledDate: "2026-10-01", position: 1 };
    await createProgramDimension("org-a", "program-a", dimensionInput);
    await createProgramSession("org-a", "program-a", "module-a", sessionInput);
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify(dimensionInput) }));
    expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/org-a/programs/program-a/modules/module-a/sessions");
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify(sessionInput) }));
  });

  it("does not call the backend without an access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listProgramDimensions("org", "program")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
