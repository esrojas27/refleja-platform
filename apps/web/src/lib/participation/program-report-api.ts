import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath, type Program } from "@/lib/programs/program-api";
import type { SurveyResults } from "./survey-results-api";
import type { ActivityAssignmentStatus } from "./activity-api";
import type { EnrollmentStatus } from "./participation-api";

export type ReportSummary = {
  participantCount: number; participatingCount: number; assigned: number; submitted: number; pending: number;
  inReview: number; changesRequested: number; approved: number; overdue: number; surveysAssigned: number;
  surveysCompleted: number; due: number; onTime: number; progressPercentage: number | null;
  approvalPercentage: number | null; participationPercentage: number | null; onTimePercentage: number | null;
};
export type ReportParticipant = { enrollmentId: string; name: string; email: string; status: EnrollmentStatus; summary: ReportSummary };
export type ReportWork = { assignmentId: string; enrollmentId: string; activityId: string; activityTitle: string;
  dimensionId: string; dimensionName: string; sessionId: string; sessionName: string; dueDate: string | null;
  status: ActivityAssignmentStatus; submittedAt: string | null; surveyRequired: boolean; surveyCompletedAt: string | null;
  progressPercentage: number; overdue: boolean; onTime: boolean };
export type ProgramReport = { organizationId: string; organizationName: string; programId: string; programName: string;
  programStatus: Program["status"]; startDate: string | null; endDate: string | null; generatedAt: string;
  timeZone: string; asOfDate: string; enrollmentId: string | null; summary: ReportSummary;
  enrollmentCounts: Partial<Record<EnrollmentStatus, number>>; participants: ReportParticipant[]; work: ReportWork[]; surveys: SurveyResults };
export type ReportFormat = "csv" | "xlsx";
export class ProgramReportError extends Error {
  constructor(public readonly status: number, public readonly requestId?: string) { super("Program report failed"); this.name = "ProgramReportError"; }
}
export function reportPath(org: string, program: string, enrollmentId?: string, format?: ReportFormat) {
  const query = new URLSearchParams();
  if (enrollmentId) query.set("enrollmentId", enrollmentId);
  if (format) query.set("format", format);
  return `${programsPath(org)}/${encodeURIComponent(program)}/reports${format ? "/export" : ""}${query.size ? `?${query}` : ""}`;
}
async function request(org: string, program: string, enrollmentId?: string, format?: ReportFormat, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const session = await fetchAuthSession(); signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ProgramReportError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProgramReportError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${reportPath(org, program, enrollmentId, format)}`, {
    method: "GET", signal, cache: "no-store", headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}` },
  });
  if (response.status !== 200) {
    const body = await response.json().catch(() => null);
    const id = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new ProgramReportError(response.status, id);
  }
  return response;
}
export async function getProgramReport(org: string, program: string, enrollmentId?: string, signal?: AbortSignal): Promise<ProgramReport> {
  return (await request(org, program, enrollmentId, undefined, signal)).json();
}
export async function exportProgramReport(org: string, program: string, format: ReportFormat, enrollmentId?: string, signal?: AbortSignal) {
  const response = await request(org, program, enrollmentId, format, signal);
  const expected = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!response.headers.get("Content-Type")?.startsWith(expected)) throw new ProgramReportError(0);
  return response.blob();
}
export function reportErrorMessage(error: unknown) {
  const status = error instanceof ProgramReportError ? error.status : 0;
  return (status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "Sólo un consultor autorizado puede consultar y exportar reportes."
      : status === 404 ? "El programa o participante no está disponible en esta organización."
        : status === 400 ? "No se pudo exportar ese alcance o formato. Revisa la selección."
          : "No se pudo generar el reporte. Inténtalo de nuevo.")
    + (error instanceof ProgramReportError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
