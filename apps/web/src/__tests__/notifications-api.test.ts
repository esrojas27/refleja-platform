import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { listNotifications, readNotification } from "@/lib/notifications-api";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("aws-amplify/auth", () => ({ fetchAuthSession: auth }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  vi.stubGlobal("fetch", vi.fn());
  auth.mockResolvedValue({ tokens: { accessToken: { toString: () => "test-access" } } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("uses the validated-session access token, no-store and abort signals", async () => {
  const data = { items: [], unreadCount: 0, hasMore: false };
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
  const controller = new AbortController();
  expect(await listNotifications(controller.signal)).toEqual(data);
  expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/v1/me/notifications", expect.objectContaining({
    cache: "no-store", signal: controller.signal, headers: { Authorization: "Bearer test-access" },
  }));
});
it("does not call the backend without a session", async () => {
  auth.mockResolvedValue({});
  await expect(listNotifications()).rejects.toMatchObject({ status: 401 });
  expect(fetch).not.toHaveBeenCalled();
});
it("marks a notification read with POST and handles empty 204 responses", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
  await expect(readNotification("id")).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/v1/me/notifications/id/read", expect.objectContaining({ method: "POST" }));
});
it("does not turn a failed mutation into a successful read", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
  await expect(readNotification("id")).rejects.toMatchObject({ status: 404 });
});
