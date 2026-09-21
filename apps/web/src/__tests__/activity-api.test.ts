import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { createProgramActivity, listMyProgramActivities, listProgramActivities,
  isYoutubeVideoUrl, reviewActivityAssignment, submitMyActivity,
  submitMyActivitySurvey } from "@/lib/participation/activity-api";

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
    const input = { sessionId: "session-a", title: "Reflexión", instructions: "Escribe",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", dueDate: "2026-10-08",
      position: 1, assignToAll: false, enrollmentIds: ["enrollment-a"] };
    await listProgramActivities("org a", "program/a");
    await createProgramActivity("org a", "program/a", input);
    const path = "http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/activities";
    expect(fetcher.mock.calls[0][0]).toBe(path);
    expect(fetcher.mock.calls[1]).toEqual([path, expect.objectContaining({ method: "POST", body: JSON.stringify(input),
      headers: { Authorization: "Bearer activity-access", "Content-Type": "application/json" } })]);
  });

  it("accepts only supported HTTPS YouTube video URLs", () => {
    expect(isYoutubeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeVideoUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(isYoutubeVideoUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });

  it("uses self-service submission and tenant-scoped review commands", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ assignmentStatus: "SUBMITTED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "COMPLETED" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await submitMyActivity("program/a", "activity a", "Mi respuesta");
    await submitMyActivitySurvey("program/a", "activity a", [{ questionId: "question/a", values: ["5"] }]);
    await reviewActivityAssignment("org a", "program/a", "activity a", "assignment/a",
      { decision: "APPROVE", comment: "Buen trabajo" });
    expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/me/programs/program%2Fa/activities/activity%20a/submission");
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST",
      body: JSON.stringify({ responseText: "Mi respuesta" }) }));
    expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/me/programs/program%2Fa/activities/activity%20a/survey-response");
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST",
      body: JSON.stringify({ answers: [{ questionId: "question/a", values: ["5"] }] }) }));
    expect(fetcher.mock.calls[2][0]).toBe("http://localhost:8082/api/v1/organizations/org%20a/programs/program%2Fa/activities/activity%20a/assignments/assignment%2Fa/review");
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
