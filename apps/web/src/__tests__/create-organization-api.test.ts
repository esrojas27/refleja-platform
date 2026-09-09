import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createOrganization, OrganizationRequestError } from "@/lib/organizations/create-organization";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
function setup() {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: {
    accessToken: { toString: () => "test-access" }, idToken: { toString: () => "never-use-id" },
  } } as Awaited<ReturnType<typeof fetchAuthSession>>);
}
describe("Organization API", () => {
  it("uses an access token, JSON POST, cancellation, and a strict field allowlist", async () => {
    setup(); const result = { id: "test-id", name: "Example", defaultTimeZone: "UTC", version: 0, status: "ACTIVE" };
    const fetchMock = vi.fn().mockResolvedValue({ status: 201, json: async () => result }); vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const input = { name: "Example", defaultTimeZone: "UTC", roles: ["SUPER_ADMIN"], userId: "foreign" };
    expect(await createOrganization(input, signal)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8082/api/v1/organizations", {
      method: "POST", cache: "no-store", signal,
      headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Example", defaultTimeZone: "UTC" }),
    });
  });
  it("does not make a request without a session", async () => {
    setup(); vi.mocked(fetchAuthSession).mockResolvedValue({});
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(createOrganization({ name: "Example", defaultTimeZone: "UTC" })).rejects.toEqual(new OrganizationRequestError(401));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses stable validation codes and ignores raw error details and unknown fields", async () => {
    setup(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 400, json: async () => ({
      code: "VALIDATION_ERROR", message: "SQL private details", errors: [{ field: "name" }, { field: "secret" }], requestId: "raw-secret",
    }) }));
    await expect(createOrganization({ name: "", defaultTimeZone: "UTC" })).rejects.toEqual(new OrganizationRequestError(400, ["name"]));
  });
  it("does not retry a failed POST", async () => {
    setup(); const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network")); vi.stubGlobal("fetch", fetchMock);
    await expect(createOrganization({ name: "Example", defaultTimeZone: "UTC" })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
