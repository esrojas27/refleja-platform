import { fetchAuthSession } from "aws-amplify/auth";
import { programsPath } from "@/lib/programs/program-api";

export type ProgramSession = {
  id: string; organizationId: string; programId: string; moduleId: string;
  name: string; description: string | null; scheduledDate: string; position: number; version: number;
};
export type ProgramModule = {
  id: string; organizationId: string; programId: string; name: string;
  description: string | null; position: number; version: number; sessions: ProgramSession[];
};
export type ProgramModuleInput = { name: string; description: string; position: number };
export type ProgramSessionInput = { name: string; description: string; scheduledDate: string; position: number };

export class ProgramContentRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Program content request failed");
    this.name = "ProgramContentRequestError";
  }
}

export function programModulesPath(organizationId: string, programId: string) {
  return `${programsPath(organizationId)}/${encodeURIComponent(programId)}/modules`;
}

async function request<T>(path: string, method: "GET" | "POST", input?: ProgramModuleInput | ProgramSessionInput,
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
    const allowed = ["name", "description", "scheduledDate", "position"];
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

export const listProgramModules = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<{ items: ProgramModule[] }>(programModulesPath(organizationId, programId), "GET", undefined, signal);

export const createProgramModule = (organizationId: string, programId: string, input: ProgramModuleInput,
  signal?: AbortSignal) => request<ProgramModule>(programModulesPath(organizationId, programId), "POST",
    { name: input.name, description: input.description, position: input.position }, signal);

export const createProgramSession = (organizationId: string, programId: string, moduleId: string,
  input: ProgramSessionInput, signal?: AbortSignal) => request<ProgramSession>(
    `${programModulesPath(organizationId, programId)}/${encodeURIComponent(moduleId)}/sessions`, "POST",
    { name: input.name, description: input.description, scheduledDate: input.scheduledDate, position: input.position }, signal);

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
