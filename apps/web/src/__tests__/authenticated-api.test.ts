import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAuthSession } from "aws-amplify/auth";

import { fetchCurrentIdentity, IdentityRequestError } from "@/lib/auth/authenticated-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));

describe("Authenticated API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("sends the Cognito access token as the Bearer token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080");
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "access-token-value" },
        idToken: { toString: () => "never-send-this-id-token" },
      },
    } as Awaited<ReturnType<typeof fetchAuthSession>>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cognitoSubject: "subject-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentIdentity()).resolves.toEqual({
      cognitoSubject: "subject-123",
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/me", {
      cache: "no-store",
      signal: undefined,
      headers: { Authorization: "Bearer access-token-value" },
    });
  });

  it("does not call the backend when no access token exists", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080");
    vi.mocked(fetchAuthSession).mockResolvedValue({} as Awaited<
      ReturnType<typeof fetchAuthSession>
    >);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentIdentity()).rejects.toThrow(
      "No Cognito access token is available",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("encodes the requested organization and propagates cancellation", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081/");
    vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "access-token" } } } as Awaited<ReturnType<typeof fetchAuthSession>>);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await fetchCurrentIdentity("org&other=value", controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8081/api/v1/me?organizationId=org%26other%3Dvalue", {
      cache: "no-store", signal: controller.signal, headers: { Authorization: "Bearer access-token" },
    });
  });

  it.each([401, 403, 404, 500])("preserves status %s without exposing the response body", async (status) => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081");
    vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "access-token" } } } as Awaited<ReturnType<typeof fetchAuthSession>>);
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json }));
    await expect(fetchCurrentIdentity()).rejects.toEqual(new IdentityRequestError(status));
    expect(json).not.toHaveBeenCalled();
  });
});
