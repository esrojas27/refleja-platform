import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";

export type DiscProfile = {
  id: string;
  dominant: string;
  influential: string;
  serene: string;
  conscientious: string;
  updatedAt: string;
  version: number;
};

export type ProgramDiscParticipant = {
  enrollmentId: string;
  enrollmentStatus: "ACTIVE" | "COMPLETED";
  email: string;
  firstName: string | null;
  lastName: string | null;
  profile: DiscProfile | null;
};

export type DiscProfileInput = {
  dominant: string;
  influential: string;
  serene: string;
  conscientious: string;
  version: number | null;
};

export class DiscRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("DISC request failed");
    this.name = "DiscRequestError";
  }
}

export function discProfilesPath(organizationId: string, programId: string) {
  return `${programsPath(organizationId)}/${encodeURIComponent(programId)}/disc-profiles`;
}

async function request<T>(path: string, method: "GET" | "PUT", expected: number,
  input?: DiscProfileInput, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new DiscRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new DiscRequestError(0);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method,
    signal,
    cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`,
      ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (response.status !== expected) {
    const body = await response.json().catch(() => null);
    const allowed = ["dominant", "influential", "serene", "conscientious", "version"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field)) : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new DiscRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<T>;
}

export const listProgramDiscProfiles = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<{ items: ProgramDiscParticipant[] }>(discProfilesPath(organizationId, programId), "GET", 200, undefined, signal);

export const saveProgramDiscProfile = (organizationId: string, programId: string, enrollmentId: string,
  input: DiscProfileInput, signal?: AbortSignal) => request<ProgramDiscParticipant>(
    `${discProfilesPath(organizationId, programId)}/${encodeURIComponent(enrollmentId)}`, "PUT", 200, input, signal);

export function discErrorMessage(error: unknown) {
  const status = error instanceof DiscRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para consultar o editar las fichas DISC de este programa."
    : status === 404 ? "El programa o el colaborador ya no está disponible."
    : status === 400 ? "Completa los cuatro campos de la ficha DISC."
    : status === 409 ? "La ficha cambió. Actualiza el listado antes de guardar nuevamente."
    : "No se pudo completar la operación. Inténtalo de nuevo.";
  return message + (error instanceof DiscRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
