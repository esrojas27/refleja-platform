import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { exportSurveyResults, getSurveyResults, surveyResultsErrorMessage, surveyResultsPath, SurveyResultsRequestError } from "@/lib/participation/survey-results-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "access" } } } as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("encodes tenant, program and whitelisted hierarchical filters without caching", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ summary: {} }), { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await getSurveyResults("org a", "program/a", { dimensionId: "d/1", sessionId: "s a", activityId: "a1" }, signal);
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8081/api/v1/organizations/org%20a/programs/program%2Fa/survey-results?dimensionId=d%2F1&sessionId=s+a&activityId=a1",
    expect.objectContaining({ method: "GET", cache: "no-store", signal, headers: { Authorization: "Bearer access" } }));
});
it("exports the same filters through an authenticated request, not a public URL", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("csv", { status: 200, headers: { "Content-Type": "text/csv;charset=UTF-8" } }));
  vi.stubGlobal("fetch", fetcher);
  const blob = await exportSurveyResults("o", "p", { activityId: "a" });
  expect(blob.size).toBeGreaterThan(0);
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8081/api/v1/organizations/o/programs/p/survey-results/export?activityId=a");
  expect(surveyResultsPath("o", "p", {})).toBe("/organizations/o/programs/p/survey-results");
});
it("does not leak server details in access errors or retry requests", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "private", requestId: "invalid" }), { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(getSurveyResults("o", "p")).rejects.toMatchObject({ status: 403, requestId: undefined });
  expect(surveyResultsErrorMessage(new SurveyResultsRequestError(403))).toMatch(/Sólo un consultor/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("never contacts the API without a session or after cancellation", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  await expect(exportSurveyResults("o", "p")).rejects.toMatchObject({ status: 401 });
  const controller = new AbortController(); controller.abort();
  await expect(getSurveyResults("o", "p", {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects unexpected export payloads", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })));
  await expect(exportSurveyResults("o", "p")).rejects.toMatchObject({ status: 0 });
});
