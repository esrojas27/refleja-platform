import { fetchAuthSession } from "aws-amplify/auth";
import { ParticipationRequestError } from "./participation-api";

export type AgendaSession = { id: string; moduleId: string; dimensionName: string; name: string; objective: string | null; dimensionPosition: number; position: number };
export type ScheduledPerson = { enrollmentId: string; email: string; name: string; status: string; enabled: boolean; scheduledDate: string | null; version: number | null };
export type SessionAgenda = { canEdit: boolean; today: string; startDate: string | null; endDate: string | null; items: { session: AgendaSession; participants: ScheduledPerson[];missingRequirement?:string }[] };
export const sessionRequirementMessage=(code:string)=>({SESSION_MISSING_ACTIVITIES:"Faltan actividades.",SESSION_MISSING_ACTIVITY_FORM:"Falta configurar el formulario de alguna actividad.",SESSION_MISSING_CLOSING_COMMENT:"Falta el comentario de cierre.",SESSION_MISSING_CLOSING_SURVEY:"Falta la encuesta de cierre de sesión."}[code]??"Completa la configuración de la sesión.");
export type OwnedSession = { session: AgendaSession; scheduledDate: string };
export type SessionRevision = { id: string; enrollmentId: string; previousDate: string | null; scheduledDate: string; actorLabel: string; reason: string; source: string; recordedAt: string };
export type SessionHistory = { items: SessionRevision[]; page: number; size: number; totalElements: number; totalPages: number };
function base(org: string, program: string) { return `/organizations/${encodeURIComponent(org)}/programs/${encodeURIComponent(program)}`; }
async function request<T>(path: string, method: "GET" | "POST", signal?: AbortSignal, body?: unknown): Promise<T> {
  signal?.throwIfAborted(); const session = await fetchAuthSession(); signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ParticipationRequestError(401);
  const api = process.env.NEXT_PUBLIC_API_BASE_URL; if (!api) throw new ParticipationRequestError(0);
  const response = await fetch(`${api.replace(/\/$/, "")}/api/v1${path}`, { method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const fields = Array.isArray(error?.errors) ? error.errors.map((e: { field?: string }) => e.field).filter((f: string) => ["scheduledDate", "reason", "enrollmentIds"].includes(f)) : [];
    throw new ParticipationRequestError(response.status, fields);
  }
  return response.json() as Promise<T>;
}
export const listSessionAgenda = (org: string, program: string, signal?: AbortSignal) => request<SessionAgenda>(`${base(org, program)}/session-schedules`, "GET", signal);
export const listOwnedSessions = (program: string, signal?: AbortSignal) => request<OwnedSession[]>(`/me/programs/${encodeURIComponent(program)}/sessions`, "GET", signal);
export const scheduleSession = (org: string, program: string, session: string, date: string, people: ScheduledPerson[], reason: string, signal?: AbortSignal) =>
  request<SessionAgenda>(`${base(org, program)}/sessions/${encodeURIComponent(session)}/schedules`, "POST", signal,
    { scheduledDate: date, participants: people.map(p => ({ enrollmentId: p.enrollmentId, version: p.version })), reason: reason.trim() || null });
export const sessionHistory = (org: string, program: string, session: string, enrollment: string, page: number, signal?: AbortSignal) =>
  request<SessionHistory>(`${base(org, program)}/sessions/${encodeURIComponent(session)}/schedule-history?${new URLSearchParams({ enrollmentId: enrollment, page: String(page), size: "20" })}`, "GET", signal);
export function scheduleError(error: unknown) {
  if (error instanceof ParticipationRequestError) {
    if (error.status === 401) return "Tu sesión no está disponible. Inicia sesión de nuevo.";
    if (error.status === 403) return "No tienes permiso para consultar o modificar esta agenda.";
    if (error.status === 404) return "El programa, sesión o participante no está disponible para esta cuenta.";
    if (error.fields.includes("reason")) return "Escribe el motivo de la reprogramación.";
    if (error.fields.includes("scheduledDate")) return "Selecciona una fecha válida, que no sea pasada ni anterior al inicio del programa.";
    if (error.status === 409) return "La agenda o el programa cambió. Actualiza antes de volver a guardar.";
  }
  return "No se pudo confirmar la operación. Actualiza la agenda antes de reintentar.";
}
