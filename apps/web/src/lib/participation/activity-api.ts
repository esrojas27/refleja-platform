import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";
import type { EvaluationQuestionType } from "@/lib/participation/evaluation-api";

export type ActivitySurveyStatus = "LOCKED" | "PENDING" | "COMPLETED";
export type ActivitySurvey = {
  id: string; title: string; instructions: string | null; status: ActivitySurveyStatus;
  completedAt: string | null;
  questions: Array<{ id: string; prompt: string; type: EvaluationQuestionType; position: number }>;
};

export type ActivityAssignee = {
  assignmentId: string; enrollmentId: string; email: string; firstName: string | null; lastName: string | null;
  status: ActivityAssignmentStatus; responseText: string | null; submittedAt: string | null;
  reviewComment: string | null; reviewedAt: string | null; surveyStatus: ActivitySurveyStatus | "NOT_REQUIRED";
  completionPercentage: number; version: number; dueDate?: string | null;
};
export type ActivityAssignmentStatus = "ASSIGNED" | "SUBMITTED" | "CHANGES_REQUESTED" | "COMPLETED";
export type ProgramActivity = {
  id: string; organizationId: string; programId: string; moduleId: string; sessionId: string;
  dimensionName: string; dimensionPosition: number; sessionName: string; sessionPosition: number;
  title: string; instructions: string; youtubeUrl: string | null; dueDate: string | null; position: number; version: number;
  assignees: ActivityAssignee[]; archived?: boolean;
};
export type AssignedActivity = Omit<ProgramActivity, "assignees"> & {
  assignmentId: string; assignmentStatus: ActivityAssignmentStatus; responseText: string | null;
  submittedAt: string | null; reviewComment: string | null; reviewedAt: string | null;
  assignmentVersion: number; survey: ActivitySurvey | null; completionPercentage: number;
};
export type ActivityInput = {
  sessionId: string; title: string; instructions: string; youtubeUrl: string | null; dueDate?: string;
  position: number;
};
export type ActivityReviewInput = { decision: "APPROVE" | "REQUEST_CHANGES"; comment: string | null };
export type ActivitySurveyAnswerInput = { questionId: string; values: string[] };
export type ActivitySurveySubmission = { evaluationId: string; status: "COMPLETED"; completedAt: string };

export function compareAssignedActivityOrder(left: AssignedActivity, right: AssignedActivity) {
  return left.dimensionPosition - right.dimensionPosition
    || left.moduleId.localeCompare(right.moduleId)
    || left.sessionPosition - right.sessionPosition
    || left.sessionId.localeCompare(right.sessionId)
    || left.position - right.position
    || left.id.localeCompare(right.id);
}

export function needsCollaboratorAction(activity: AssignedActivity) {
  return activity.assignmentStatus === "ASSIGNED"
    || activity.assignmentStatus === "CHANGES_REQUESTED"
    || activity.survey?.status === "PENDING";
}

export function pendingAssignedActivities(activities: AssignedActivity[]) {
  return activities.filter(needsCollaboratorAction).sort(compareAssignedActivityOrder);
}

export class ActivityRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string,
    public readonly code?: string) {
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
    const allowed = ["sessionId", "title", "instructions", "youtubeUrl", "dueDate", "position",
      "responseText", "decision", "comment"];
    allowed.push("answers");
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field))
      : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new ActivityRequestError(response.status, fields, requestId, typeof body?.code === "string" ? body.code : undefined);
  }
  if (method === "POST" && typeof window !== "undefined") window.dispatchEvent(new Event("rti:notifications-changed"));
  return response.json() as Promise<T>;
}

export const listProgramActivities = (organizationId: string, programId: string, signal?: AbortSignal, includeArchived = false) =>
  request<{ items: ProgramActivity[] }>(programActivitiesPath(organizationId, programId) + (includeArchived ? "?includeArchived=true" : ""), "GET", 200, undefined, signal);

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

export const submitMyActivitySurvey = (programId: string, activityId: string,
  answers: ActivitySurveyAnswerInput[], signal?: AbortSignal) => request<ActivitySurveySubmission>(
    `/me/programs/${encodeURIComponent(programId)}/activities/${encodeURIComponent(activityId)}/survey-response`,
    "POST", 200, { answers }, signal);

export const reviewActivityAssignment = (organizationId: string, programId: string, activityId: string,
  assignmentId: string, input: ActivityReviewInput, signal?: AbortSignal) => request<ActivityAssignee>(
    `${programActivitiesPath(organizationId, programId)}/${encodeURIComponent(activityId)}`
      + `/assignments/${encodeURIComponent(assignmentId)}/review`, "POST", 200, input, signal);

export { isYoutubeVideoUrl } from "./youtube";

export function activityErrorMessage(error: unknown) {
  const status = error instanceof ActivityRequestError ? error.status : 0;
  const code = error instanceof ActivityRequestError ? error.code : undefined;
  const message = code === "PROGRAM_NOT_ACTIVE" ? "El programa no está activo. Actualiza la página para consultar su estado."
    : code === "PROGRAM_READ_ONLY" ? "El programa está cerrado y solo permite consulta."
    : code === "PARTICIPATION_READ_ONLY" ? "Tu participación está completada y solo permite consulta."
    : status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para gestionar estas actividades."
    : status === 404 ? "El programa, la sesión o la inscripción ya no está disponible."
    : status === 400 ? "Revisa los datos de la actividad."
    : status === 409 ? "La actividad cambió. Actualiza el listado antes de intentarlo de nuevo."
    : "No se pudo completar la operación. Inténtalo de nuevo.";
  return message + (error instanceof ActivityRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
