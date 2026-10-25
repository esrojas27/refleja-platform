import { fetchAuthSession } from "aws-amplify/auth";
import { programActivitiesPath } from "@/lib/participation/activity-api";

import type { EvaluationQuestionType, FormQuestion } from "@/lib/forms/question-catalog";
export type { EvaluationQuestionType } from "@/lib/forms/question-catalog";
export { AGREEMENT_OPTIONS, LIKELIHOOD_OPTIONS, NUMERIC_SCALE_OPTIONS, EMOTION_OPTIONS } from "@/lib/forms/question-catalog";
export type EvaluationQuestion = FormQuestion & { version: number };
export type ActivityEvaluation = {
  id: string; organizationId: string; programId: string; activityId: string | null; sessionId?: string | null; title: string;
  instructions: string | null; questions: EvaluationQuestion[]; version: number;
};
export type EvaluationInput = {
  title: string; instructions: string | null;
  questions: Array<{ prompt: string; type: EvaluationQuestionType; position: number; options?: string[] }>;
};

export class EvaluationRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Evaluation request failed"); this.name = "EvaluationRequestError";
  }
}
export const programEvaluationsPath = (organizationId: string, programId: string) =>
  `${programActivitiesPath(organizationId, programId).replace(/\/activities$/, "")}/evaluations`;

async function request<T>(path: string, method: "GET" | "POST", expected: number,
  input?: unknown, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new EvaluationRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new EvaluationRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`,
      ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (response.status !== expected) {
    const body = await response.json().catch(() => null);
    const allowed = ["title", "instructions", "questions", "prompt", "type", "position", "options"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field)) : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new EvaluationRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<T>;
}

export const listActivityEvaluations = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<{ items: ActivityEvaluation[] }>(programEvaluationsPath(organizationId, programId), "GET", 200, undefined, signal);

export const createActivityEvaluation = (organizationId: string, programId: string, activityId: string,
  input: EvaluationInput, signal?: AbortSignal) => request<ActivityEvaluation>(
    `${programActivitiesPath(organizationId, programId)}/${encodeURIComponent(activityId)}/evaluation`,
    "POST", 201, input, signal);
export const listSessionEvaluations = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<{items:ActivityEvaluation[];closedSessionIds:string[];startedSessionIds:string[]}>(programEvaluationsPath(organizationId,programId).replace(/\/evaluations$/,"/session-surveys"),"GET",200,undefined,signal);
export const saveSessionEvaluation = (organizationId:string,programId:string,sessionId:string,input:EvaluationInput & {version?:number},signal?:AbortSignal) =>
  request<ActivityEvaluation>(`${programActivitiesPath(organizationId,programId).replace(/\/activities$/,"")}/sessions/${encodeURIComponent(sessionId)}/survey`,"POST",200,input,signal);

export function evaluationErrorMessage(error: unknown) {
  const status = error instanceof EvaluationRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para gestionar esta encuesta."
      : status === 404 ? "La actividad ya no está disponible."
        : status === 400 ? "Revisa los datos y las preguntas de la encuesta."
          : status === 409 ? "Esta actividad ya tiene una encuesta."
            : "No se pudo completar la operación. Inténtalo de nuevo.";
  return message + (error instanceof EvaluationRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
