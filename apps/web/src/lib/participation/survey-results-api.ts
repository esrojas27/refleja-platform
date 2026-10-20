import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";
import type { EvaluationQuestionType } from "./evaluation-api";

export type SurveyFilters = { dimensionId?: string; sessionId?: string; activityId?: string };
export type SurveySummary = {
  surveyCount: number; assignedCount: number; responseCount: number; pendingCount: number;
  participantCount: number; respondentCount: number; responseRate: number | null;
  agreementAverage: number | null; agreementAnswers: number; likelihoodAverage: number | null; likelihoodAnswers: number;
};
export type SurveyActivityOption = { id: string; title: string; dimensionId: string; dimensionName: string; sessionId: string; sessionName: string };
export type SurveyComparison = { id: string; name: string; context: string; summary: SurveySummary };
export type SurveyQuestionResult = {
  id: string; prompt: string; type: EvaluationQuestionType; position: number; responseCount: number; average: number | null;
  distribution: Array<{ value: string; label: string; count: number; percentage: number }>;
};
export type SurveyRespondent = { responseId: string; enrollmentId: string; name: string; email: string; completedAt: string;
  answers: Array<{ questionId: string; values: string[] }> };
export type SurveyResult = { id: string; title: string; activity: SurveyActivityOption; summary: SurveySummary;
  questions: SurveyQuestionResult[]; responses: SurveyRespondent[] };
export type SurveyResults = { programId: string; programName: string; generatedAt: string;
  scope: { dimensionId: string | null; sessionId: string | null; activityId: string | null };
  options: SurveyActivityOption[]; summary: SurveySummary; dimensions: SurveyComparison[]; sessions: SurveyComparison[];
  activities: SurveyComparison[]; surveys: SurveyResult[] };

export class SurveyResultsRequestError extends Error {
  constructor(public readonly status: number, public readonly requestId?: string) {
    super("Survey results request failed"); this.name = "SurveyResultsRequestError";
  }
}
export function surveyResultsPath(org: string, program: string, filters: SurveyFilters = {}, exporting = false) {
  const query = new URLSearchParams();
  for (const field of ["dimensionId", "sessionId", "activityId"] as const) if (filters[field]) query.set(field, filters[field]);
  return `${programsPath(org)}/${encodeURIComponent(program)}/survey-results${exporting ? "/export" : ""}${query.size ? "?" + query : ""}`;
}
async function request(org: string, program: string, filters: SurveyFilters, signal?: AbortSignal, exporting = false) {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new SurveyResultsRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new SurveyResultsRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${surveyResultsPath(org, program, filters, exporting)}`, {
    method: "GET", signal, cache: "no-store", headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}` },
  });
  if (response.status !== 200) {
    const body = await response.json().catch(() => null);
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new SurveyResultsRequestError(response.status, requestId);
  }
  return response;
}
export async function getSurveyResults(org: string, program: string, filters: SurveyFilters = {}, signal?: AbortSignal) {
  return (await request(org, program, filters, signal)).json() as Promise<SurveyResults>;
}
export async function exportSurveyResults(org: string, program: string, filters: SurveyFilters = {}, signal?: AbortSignal) {
  const response = await request(org, program, filters, signal, true);
  if (!response.headers.get("Content-Type")?.startsWith("text/csv")) throw new SurveyResultsRequestError(0);
  return response.blob();
}
export function surveyResultsErrorMessage(error: unknown) {
  const status = error instanceof SurveyResultsRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "Sólo un consultor autorizado puede consultar los resultados de las encuestas."
      : status === 404 ? "El programa o los filtros no están disponibles en esta organización. Actualiza los resultados."
        : status === 400 ? "Revisa los filtros seleccionados."
          : "No se pudieron consultar los resultados. Inténtalo de nuevo.";
  return message + (error instanceof SurveyResultsRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
