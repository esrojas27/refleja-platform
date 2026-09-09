import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createProgram, listPrograms, getProgram, ProgramRequestError } from "@/lib/programs/program-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
const input = { name: "Programa", description: "Descripción", startDate: "2026-09-01", endDate: "2026-12-01" };
const session = { tokens: { accessToken: { toString: () => "test-access" } } };

describe("program API", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/"); vi.mocked(fetchAuthSession).mockResolvedValue(session as never); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("sends only approved fields using an access token and no cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "new", status: "DRAFT" }), { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await createProgram("tenant-a", { ...input, organizationId: "tenant-b", status: "ACTIVE", version: 99 } as typeof input, signal);
    expect(fetcher).toHaveBeenCalledWith("http://localhost:8082/api/v1/organizations/tenant-a/programs", expect.objectContaining({
      method: "POST", signal, cache: "no-store", body: JSON.stringify(input),
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
    }));
  });
  it("scopes list, pagination and detail URLs to the selected organization", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetcher);
    await listPrograms("tenant-a", 2); await getProgram("tenant-a", "program-b");
    expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/tenant-a/programs?page=2&size=20");
    expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/tenant-a/programs/program-b");
  });
  it("never calls backend without an access token", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({} as never); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(listPrograms("a")).rejects.toMatchObject({ status: 401 }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves status but never exposes server messages or unknown fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "secret SQL",
      errors: [{ field: "startDate" }, { field: "secret" }], requestId: "untrusted" }), { status: 400 })));
    await expect(createProgram("a", input)).rejects.toMatchObject({ status: 400, fields: ["startDate"], requestId: undefined, message: "Program request failed" });
  });
  it("does not retry POST on an uncertain network failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("network")); vi.stubGlobal("fetch", fetcher);
    await expect(createProgram("a", input)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("treats cross-tenant 404 and unexpected success status as failures", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 404 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(getProgram("a", "b")).rejects.toMatchObject({ status: 404 });
    await expect(createProgram("a", input)).rejects.toBeInstanceOf(ProgramRequestError);
  });
});
