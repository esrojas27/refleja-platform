import { fetchAuthSession } from "aws-amplify/auth";

export type Program = {
  id: string; organizationId: string; name: string; description: string | null;
  status: "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string | null; endDate: string | null; version: number;
};
export type ProgramInput = { name: string; description: string; startDate: string; endDate: string };
export type ProgramPage = { items: Program[]; page: number; size: number; totalElements: number; totalPages: number };

export class ProgramRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Program request failed"); this.name = "ProgramRequestError";
  }
}

export function programsPath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/programs`;
}

async function request<T>(path: string, method: "GET" | "POST", signal?: AbortSignal, input?: ProgramInput): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProgramRequestError(0);
  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken) throw new ProgramRequestError(401);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, ...(input ? { "Content-Type": "application/json" } : {}) },
    // Explicit write contract: no tenant, ID, status, role, consultant assignment or version from the client.
    body: input ? JSON.stringify({ name: input.name, description: input.description, startDate: input.startDate, endDate: input.endDate }) : undefined,
  });
  if (response.status !== (method === "POST" ? 201 : 200)) {
    const body = await response.json().catch(() => null);
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((e: { field?: unknown }) => e?.field).filter((field: unknown): field is string =>
        typeof field === "string" && ["name", "description", "startDate", "endDate"].includes(field)) : [];
    const id = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new ProgramRequestError(response.status, fields, id);
  }
  return response.json() as Promise<T>;
}

export const listPrograms = (org: string, page = 0, signal?: AbortSignal) =>
  request<ProgramPage>(`${programsPath(org)}?page=${page}&size=20`, "GET", signal);
export const getProgram = (org: string, id: string, signal?: AbortSignal) =>
  request<Program>(`${programsPath(org)}/${encodeURIComponent(id)}`, "GET", signal);
export const createProgram = (org: string, input: ProgramInput, signal?: AbortSignal) =>
  request<Program>(programsPath(org), "POST", signal, input);

export function programErrorMessage(error: unknown) {
  const status = error instanceof ProgramRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "No tienes permiso para realizar esta operación."
    : status === 404 ? "El recurso no está disponible. Vuelve a Cuenta y comprueba la organización."
    : status === 400 ? "Revisa los campos y las fechas: el inicio no puede ser posterior al fin."
    : status === 409 ? "Hubo un conflicto. Comprueba el listado antes de reintentar."
    : "No se pudo completar la consulta. Inténtalo de nuevo.";
  return message + (error instanceof ProgramRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
