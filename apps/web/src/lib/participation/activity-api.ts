import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";

export type ActivityAssignee = {
  assignmentId: string; enrollmentId: string; email: string; firstName: string | null; lastName: string | null;
  status: ActivityAssignmentStatus; responseText: string | null; submittedAt: string | null;
  reviewComment: string | null; reviewedAt: string | null; version: number;
};
export type ActivityAssignmentStatus = "ASSIGNED" | "SUBMITTED" | "CHANGES_REQUESTED" | "COMPLETED";
export type ProgramActivity = {
  id: string; organizationId: string; programId: string; moduleId: string; sessionId: string;
  title: string; instructions: string; youtubeUrl: string | null; dueDate: string; position: number; version: number;
  assignees: ActivityAssignee[];
};
export type AssignedActivity = Omit<ProgramActivity, "assignees"> & {
  assignmentId: string; assignmentStatus: ActivityAssignmentStatus; responseText: string | null;
  submittedAt: string | null; reviewComment: string | null; reviewedAt: string | null;
  assignmentVersion: number;
};
export type ActivityInput = {
  sessionId: string; title: string; instructions: string; youtubeUrl: string | null; dueDate: string;
  position: number; assignToAll: boolean; enrollmentIds: string[];
};
export type ActivityReviewInput = { decision: "APPROVE" | "REQUEST_CHANGES"; comment: string | null };

export class ActivityRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Activity request failed");
    this.name = "ActivityRequestError";
  }
}

export function programActivitiesPath(organizationId: string, programId: string) {
  return `${programsPath(organizationId)}/${encodeURIComponent(programId)}/activities`;
}

async function request<T>(path: string, method: "GET" | "POST", expected: number,
  input?: unknown, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ActivityRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ActivityRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (response.status !== expected) {
    const body = await response.json().catch(() => null);
    const allowed = ["sessionId", "title", "instructions", "youtubeUrl", "dueDate", "position", "enrollmentIds",
      "responseText", "decision", "comment"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field))
      : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new ActivityRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<T>;
}

export const listProgramActivities = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<{ items: ProgramActivity[] }>(programActivitiesPath(organizationId, programId), "GET", 200, undefined, signal);

export const createProgramActivity = (organizationId: string, programId: string, input: ActivityInput,
  signal?: AbortSignal) => request<ProgramActivity>(programActivitiesPath(organizationId, programId),
    "POST", 201, input, signal);

export const listMyProgramActivities = (programId: string, signal?: AbortSignal) =>
  request<{ items: AssignedActivity[] }>(`/me/programs/${encodeURIComponent(programId)}/activities`,
    "GET", 200, undefined, signal);

export const submitMyActivity = (programId: string, activityId: string, responseText: string,
  signal?: AbortSignal) => request<AssignedActivity>(
    `/me/programs/${encodeURIComponent(programId)}/activities/${encodeURIComponent(activityId)}/submission`,
    "POST", 200, { responseText }, signal);

export const reviewActivityAssignment = (organizationId: string, programId: string, activityId: string,
  assignmentId: string, input: ActivityReviewInput, signal?: AbortSignal) => request<ActivityAssignee>(
    `${programActivitiesPath(organizationId, programId)}/${encodeURIComponent(activityId)}`
      + `/assignments/${encodeURIComponent(assignmentId)}/review`, "POST", 200, input, signal);

export function isYoutubeVideoUrl(value: string) {
  if (!value) return true;
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const id = /^[A-Za-z0-9_-]{11}$/;
    const segments = url.pathname.split("/").filter(Boolean);
    if (["youtu.be", "www.youtu.be"].includes(url.hostname)) return segments.length === 1 && id.test(segments[0]);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") return id.test(url.searchParams.get("v") ?? "");
      return segments.length === 2 && ["shorts", "embed", "live"].includes(segments[0]) && id.test(segments[1]);
    }
    return ["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(url.hostname)
      && segments.length === 2 && segments[0] === "embed" && id.test(segments[1]);
  } catch {
    return false;
  }
}

export function activityErrorMessage(error: unknown) {
  const status = error instanceof ActivityRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para gestionar estas actividades."
    : status === 404 ? "El programa, la sesión o la inscripción ya no está disponible."
    : status === 400 ? "Revisa los datos de la actividad y sus destinatarios."
    : status === 409 ? "La actividad cambió. Actualiza el listado antes de intentarlo de nuevo."
    : "No se pudo completar la operación. Inténtalo de nuevo.";
  return message + (error instanceof ActivityRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
