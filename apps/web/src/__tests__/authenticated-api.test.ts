import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAuthSession } from "aws-amplify/auth";

import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";

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
});
