import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchAuthSession } from "aws-amplify/auth";
import { acceptInvitation, createEnrollment, listEnrollments, listInvitations, retryInvitationDelivery,
  ParticipationRequestError, deliveryMessage } from "@/lib/participation/participation-api";

vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: vi.fn() }));
const input = { email: "participant@example.test", firstName: "Ana", lastName: "Prueba" };
const session = { tokens: { accessToken: { toString: () => "test-access" } } };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8082/");
  vi.mocked(fetchAuthSession).mockResolvedValue(session as never);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("creates an enrollment with only participant input and an access token", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 201 })); vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await createEnrollment("org-a", "program-a", { ...input, userId: "foreign", status: "ACTIVE", roles: ["CONSULTANT"] } as typeof input, signal);
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8082/api/v1/organizations/org-a/programs/program-a/enrollments", expect.objectContaining({
    method: "POST", body: JSON.stringify(input), signal, cache: "no-store",
    headers: { Authorization: "Bearer test-access", "Content-Type": "application/json" },
  }));
});
it("scopes paginated enrollment listing and retries to the organization and program", async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}"))); vi.stubGlobal("fetch", fetcher);
  await listEnrollments("org/a", "program/b", 2); await retryInvitationDelivery("org/a", "program/b", "enrollment/c");
  expect(fetcher.mock.calls[0][0]).toBe("http://localhost:8082/api/v1/organizations/org%2Fa/programs/program%2Fb/enrollments?page=2&size=20");
  expect(fetcher.mock.calls[1][0]).toBe("http://localhost:8082/api/v1/organizations/org%2Fa/programs/program%2Fb/enrollments/enrollment%2Fc/invitation-delivery");
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", body: undefined });
});
it("lists own invitations directly without calling /me or accepting on GET", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetcher);
  await listInvitations(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8082/api/v1/invitations?page=1&size=20", expect.objectContaining({ method: "GET", body: undefined }));
});
it("accepts only with an explicit POST and no client identity fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetcher);
  await acceptInvitation("invite/a");
  expect(fetcher).toHaveBeenCalledWith("http://localhost:8082/api/v1/invitations/invite%2Fa/accept", expect.objectContaining({ method: "POST", body: undefined }));
});
it("does not call the backend without an access token", async () => {
  vi.mocked(fetchAuthSession).mockResolvedValue({} as never); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(listInvitations()).rejects.toMatchObject({ status: 401 }); expect(fetcher).not.toHaveBeenCalled();
});
it("aborts before a delayed authentication result can trigger a request", async () => {
  let complete!: (value: never) => void;
  vi.mocked(fetchAuthSession).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); const controller = new AbortController();
  const pending = listInvitations(0, controller.signal); controller.abort(); complete(session as never);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" }); expect(fetcher).not.toHaveBeenCalled();
});
it("sanitizes server errors and only exposes known validation fields", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "private database detail",
    errors: [{ field: "email" }, { field: "password" }], requestId: "untrusted" }), { status: 400 })));
  await expect(createEnrollment("a", "b", input)).rejects.toMatchObject({ status: 400, fields: ["email"], requestId: undefined, message: "Participation request failed" });
});
it.each([403, 404, 409, 410, 503])("preserves HTTP %s without retrying acceptance", async status => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status })); vi.stubGlobal("fetch", fetcher);
  await expect(acceptInvitation("invite")).rejects.toMatchObject({ status }); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not retry an uncertain creation or claim an unexpected status is success", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  await expect(createEnrollment("a", "b", input)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(createEnrollment("a", "b", input)).rejects.toBeInstanceOf(ParticipationRequestError);
});
it("never describes SENT as delivered mail", () => {
  expect(deliveryMessage("SENT")).toContain("no confirma recepción");
});
