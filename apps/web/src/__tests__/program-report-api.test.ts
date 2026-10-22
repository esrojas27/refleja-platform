import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { exportProgramReport, getProgramReport, ProgramReportError, reportErrorMessage, reportPath } from "@/lib/participation/program-report-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081/");
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { accessToken: { toString: () => "token" } } } as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("encodes program and participant scope and never caches private reports", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  await getProgramReport("org a", "p/a", "e&1");
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8081/api/v1/organizations/org%20a/programs/p%2Fa/reports?enrollmentId=e%261",
    expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer token" } }));
  expect(reportPath("o", "p")).toBe("/organizations/o/programs/p/reports");
});
it.each(["csv", "xlsx"] as const)("downloads authenticated %s for the selected participant", async format => {
  const type = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const fetcher = vi.fn().mockResolvedValue(new Response("file", { status: 200, headers: { "Content-Type": type } })); vi.stubGlobal("fetch", fetcher);
  expect((await exportProgramReport("o", "p", format, "e")).size).toBe(4);
  expect(fetcher.mock.calls[0][0]).toContain(`/reports/export?enrollmentId=e&format=${format}`);
});
it("rejects unexpected export content and hides server internals", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })));
  await expect(exportProgramReport("o", "p", "xlsx")).rejects.toMatchObject({ status: 0 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "secret", requestId: "bad" }), { status: 403 })));
  await expect(getProgramReport("o", "p")).rejects.toMatchObject({ status: 403, requestId: undefined });
  expect(reportErrorMessage(new ProgramReportError(403))).toContain("Sólo un consultor");
});
it("never contacts the API without authentication or after cancellation", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never);
  await expect(getProgramReport("o", "p")).rejects.toMatchObject({ status: 401 });
  const controller = new AbortController(); controller.abort();
  await expect(exportProgramReport("o", "p", "csv", undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});
