import { fetchAuthSession } from "aws-amplify/auth";

export type NotificationKind = "ACTIVITY_ASSIGNED" | "SUBMISSION_RECEIVED" | "CHANGES_REQUESTED" | "ACTIVITY_APPROVED" | "SURVEY_PENDING";
export type AppNotification = {
  id: string; organizationId: string; organizationName: string; programId: string; programName: string;
  activityId: string; activityTitle: string; assignmentId: string; kind: NotificationKind;
  participantName: string | null;
  createdAt: string; readAt: string | null;
};
export type NotificationPage = { items: AppNotification[]; unreadCount: number; hasMore: boolean };
export class NotificationRequestError extends Error {
  constructor(public status: number) { super("Notification request failed"); }
}
async function request<T>(suffix: string, method: "GET" | "POST", signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new NotificationRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new NotificationRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/me/notifications${suffix}`, {
    method, signal, cache: "no-store", headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}` },
  });
  if (!response.ok) throw new NotificationRequestError(response.status);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export function listNotifications(signal?: AbortSignal, last?: AppNotification) {
  const query = last ? `?${new URLSearchParams({ before: last.createdAt, beforeId: last.id })}` : "";
  return request<NotificationPage>(query, "GET", signal);
}
export const readNotification = (id: string, signal?: AbortSignal) =>
  request<void>(`/${encodeURIComponent(id)}/read`, "POST", signal);

export const notificationLabels: Record<NotificationKind, string> = {
  ACTIVITY_ASSIGNED: "Tienes una actividad asignada",
  SUBMISSION_RECEIVED: "Recibiste una entrega",
  CHANGES_REQUESTED: "Tu actividad necesita ajustes",
  ACTIVITY_APPROVED: "Tu actividad fue aprobada",
  SURVEY_PENDING: "Te falta completar la encuesta",
};
export function notificationDestination(item: AppNotification) {
  const program = encodeURIComponent(item.programId);
  return item.kind === "SUBMISSION_RECEIVED"
    ? `/organizations/${encodeURIComponent(item.organizationId)}/programs/${program}/activities#review-${encodeURIComponent(item.assignmentId)}`
    : `/my-programs/${program}/activities#activity-${encodeURIComponent(item.activityId)}`;
}
