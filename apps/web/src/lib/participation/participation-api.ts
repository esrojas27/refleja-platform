import { fetchAuthSession } from "aws-amplify/auth";

export type PageResult<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number };
export type EnrollmentInput = { email: string; firstName: string; lastName: string };
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
export type Enrollment = {
  id: string; organizationId: string; programId: string; status: "INVITED" | "ACTIVE";
  participant: { userId: string; membershipId: string; email: string; firstName: string | null; lastName: string | null };
  invitation: { id: string; status: InvitationStatus; expiresAt: string; deliveryStatus: "PENDING" | "SENDING" | "SENT" | "FAILED" } | null;
};
export type Invitation = {
  id: string; organizationId: string; organizationName: string; programId: string; programName: string;
  status: InvitationStatus; expiresAt: string;
};
export type AcceptedInvitation = { invitationId: string; status: "ACCEPTED"; enrollmentId: string; enrollmentStatus: "ACTIVE" };

export class ParticipationRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Participation request failed"); this.name = "ParticipationRequestError";
  }
}

export function enrollmentsPath(organizationId: string, programId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}/enrollments`;
}

async function request<T>(path: string, method: "GET" | "POST", expectedStatus: number, signal?: AbortSignal, input?: EnrollmentInput): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ParticipationRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ParticipationRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    // No client-chosen user, role, status, invitation or tenant fields.
    body: input ? JSON.stringify({ email: input.email, firstName: input.firstName, lastName: input.lastName }) : undefined,
  });
  if (response.status !== expectedStatus) {
    const body = await response.json().catch(() => null);
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field).filter((field: unknown): field is string =>
        typeof field === "string" && ["email", "firstName", "lastName"].includes(field)) : [];
    const id = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new ParticipationRequestError(response.status, fields, id);
  }
  return response.json() as Promise<T>;
}

export const listEnrollments = (org: string, program: string, page = 0, signal?: AbortSignal) =>
  request<PageResult<Enrollment>>(`${enrollmentsPath(org, program)}?page=${page}&size=20`, "GET", 200, signal);
export const createEnrollment = (org: string, program: string, input: EnrollmentInput, signal?: AbortSignal) =>
  request<Enrollment>(enrollmentsPath(org, program), "POST", 201, signal, input);
export const retryInvitationDelivery = (org: string, program: string, enrollment: string, signal?: AbortSignal) =>
  request<Enrollment>(`${enrollmentsPath(org, program)}/${encodeURIComponent(enrollment)}/invitation-delivery`, "POST", 200, signal);
// Invited users can receive 403 from /me. Invitations require Cognito identity, not an already-active membership.
export const listInvitations = (page = 0, signal?: AbortSignal) =>
  request<PageResult<Invitation>>(`/invitations?page=${page}&size=20`, "GET", 200, signal);
export const acceptInvitation = (id: string, signal?: AbortSignal) =>
  request<AcceptedInvitation>(`/invitations/${encodeURIComponent(id)}/accept`, "POST", 200, signal);

export function participationErrorMessage(error: unknown) {
  const status = error instanceof ParticipationRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para realizar esta operación."
    : status === 404 ? "La invitación o el recurso no está disponible para esta cuenta."
    : status === 400 ? "Revisa el correo, el nombre y el apellido."
    : status === 409 ? "Ya existe un registro o su estado cambió. Actualiza el listado antes de reintentar."
    : status === 410 ? "La invitación venció. Solicita al consultor que revise tu acceso."
    : status === 503 ? "El servicio de invitaciones no está disponible. Revisa el listado antes de reintentar."
    : "No se pudo completar la consulta. Inténtalo de nuevo.";
  return message + (error instanceof ParticipationRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}

export function deliveryMessage(status: NonNullable<Enrollment["invitation"]>["deliveryStatus"]) {
  return status === "SENT" ? "Envío solicitado al proveedor; no confirma recepción del correo."
    : status === "SENDING" ? "Envío en curso. Actualiza el listado para consultar el resultado."
    : status === "FAILED" ? "No se pudo solicitar el envío. Puedes reintentarlo."
    : "Envío pendiente. Puedes solicitarlo.";
}
