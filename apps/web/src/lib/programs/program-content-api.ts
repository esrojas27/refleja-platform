import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";

export type ProgramSession = {
  id: string; organizationId: string; programId: string; dimensionId: string;
  name: string; objective: string | null; scheduledDate: string; position: number; version: number;
};
export type ProgramDimension = {
  id: string; organizationId: string; programId: string; name: string;
  description: string | null; position: number; version: number; sessions: ProgramSession[];
};
export type ProgramDimensionInput = { name: string; description: string; position: number };
export type ProgramSessionInput = { name: string; objective: string; scheduledDate: string; position: number };

type LegacyProgramSession = Omit<ProgramSession, "dimensionId" | "objective"> & {
  moduleId: string; description: string | null; objective?: string | null;
};
type LegacyProgramDimension = Omit<ProgramDimension, "sessions"> & { sessions: LegacyProgramSession[] };

export class ProgramContentRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Program content request failed");
    this.name = "ProgramContentRequestError";
  }
}

// ADR-005 keeps the existing /modules v1 route stable while the product language evolves to dimensions.
export function programDimensionsPath(organizationId: string, programId: string) {
  return `${programsPath(organizationId)}/${encodeURIComponent(programId)}/modules`;
}

async function request<T>(path: string, method: "GET" | "POST", input?: ProgramDimensionInput | ProgramSessionInput,
  signal?: AbortSignal): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProgramContentRequestError(0);
  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken) throw new ProgramContentRequestError(401);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  });
  const expected = method === "POST" ? 201 : 200;
  if (response.status !== expected) {
    const body = await response.json().catch(() => null);
    const allowed = ["name", "description", "objective", "scheduledDate", "position"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field))
      : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new ProgramContentRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<T>;
}

function dimension(data: LegacyProgramDimension): ProgramDimension {
  return { ...data, sessions: data.sessions.map(session => ({
    id: session.id, organizationId: session.organizationId, programId: session.programId,
    dimensionId: session.moduleId, name: session.name,
    objective: session.objective ?? session.description, scheduledDate: session.scheduledDate,
    position: session.position, version: session.version,
  })) };
}

export async function listProgramDimensions(organizationId: string, programId: string, signal?: AbortSignal) {
  const result = await request<{ items: LegacyProgramDimension[] }>(
    programDimensionsPath(organizationId, programId), "GET", undefined, signal);
  return { items: result.items.map(dimension) };
}

export async function createProgramDimension(organizationId: string, programId: string,
  input: ProgramDimensionInput, signal?: AbortSignal) {
  const created = await request<LegacyProgramDimension>(programDimensionsPath(organizationId, programId), "POST",
    { name: input.name, description: input.description, position: input.position }, signal);
  return dimension(created);
}

export async function createProgramSession(organizationId: string, programId: string, dimensionId: string,
  input: ProgramSessionInput, signal?: AbortSignal) {
  const created = await request<LegacyProgramSession>(
    `${programDimensionsPath(organizationId, programId)}/${encodeURIComponent(dimensionId)}/sessions`, "POST",
    { name: input.name, objective: input.objective, scheduledDate: input.scheduledDate, position: input.position }, signal);
  return dimension({ id: dimensionId, organizationId, programId, name: "", description: null,
    position: 1, version: 0, sessions: [created] }).sessions[0];
}

export function programContentErrorMessage(error: unknown) {
  const status = error instanceof ProgramContentRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "Sólo un consultor autorizado puede gestionar el contenido."
    : status === 404 ? "El programa no está disponible en esta organización."
    : status === 400 ? "Revisa los campos indicados."
    : status === 409 ? "El orden cambió. Actualiza el contenido antes de intentarlo de nuevo."
    : "No se pudo completar la operación. Inténtalo de nuevo.";
  return message + (error instanceof ProgramContentRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
