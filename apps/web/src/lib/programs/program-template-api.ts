import { fetchAuthSession } from "aws-amplify/auth";
import type { Program, ProgramInput } from "@/lib/programs/program-api";

export type ProgramTemplate = {
  id: string;
  sourceOrganizationId: string;
  sourceProgramId: string;
  name: string;
  description: string | null;
  sourceProgramName: string;
  durationDays: number;
  dimensionCount: number;
  sessionCount: number;
  activityCount: number;
  surveyCount: number;
  createdAt: string;
  version: number;
};

export type ProgramTemplateReadiness = {
  eligible: boolean;
  dimensionCount: number;
  sessionCount: number;
  activityCount: number;
  surveyCount: number;
  issues: string[];
};

export type ProgramTemplateInput = { sourceProgramId: string; name: string; description: string };

export class ProgramTemplateRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [],
    public readonly issues: string[] = [], public readonly requestId?: string) {
    super("Program template request failed");
    this.name = "ProgramTemplateRequestError";
  }
}

function basePath(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/program-templates`;
}

async function request<T>(path: string, method: "GET" | "POST", expectedStatus: number,
  signal?: AbortSignal, input?: object): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProgramTemplateRequestError(0);
  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken) throw new ProgramTemplateRequestError(401);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
    method, signal, cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.tokens.accessToken.toString()}`,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (response.status !== expectedStatus) {
    const body = await response.json().catch(() => null);
    const allowedFields = ["name", "description", "startDate", "endDate", "sourceProgramId"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((item: { field?: unknown }) => item?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowedFields.includes(field))
      : [];
    const issues = body?.code === "PROGRAM_TEMPLATE_INCOMPLETE" && Array.isArray(body.issues)
      ? body.issues.filter((issue: unknown): issue is string => typeof issue === "string") : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new ProgramTemplateRequestError(response.status, fields, issues, requestId);
  }
  return response.json() as Promise<T>;
}

export const listProgramTemplates = (organizationId: string, signal?: AbortSignal) =>
  request<{ items: ProgramTemplate[]; page: number; size: number; totalElements: number; totalPages: number }>(
    `${basePath(organizationId)}?page=0&size=100`, "GET", 200, signal);

export const getProgramTemplateReadiness = (organizationId: string, programId: string, signal?: AbortSignal) =>
  request<ProgramTemplateReadiness>(
    `/organizations/${encodeURIComponent(organizationId)}/programs/${encodeURIComponent(programId)}/template-readiness`,
    "GET", 200, signal);

export const createProgramTemplate = (organizationId: string, input: ProgramTemplateInput, signal?: AbortSignal) =>
  request<ProgramTemplate>(basePath(organizationId), "POST", 201, signal, {
    sourceProgramId: input.sourceProgramId,
    name: input.name,
    description: input.description,
  });

export const createProgramFromTemplate = (organizationId: string, templateId: string,
  input: ProgramInput, signal?: AbortSignal) =>
  request<Program>(`${basePath(organizationId)}/${encodeURIComponent(templateId)}/programs`,
    "POST", 201, signal, input);

export function programTemplateErrorMessage(error: unknown) {
  const status = error instanceof ProgramTemplateRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 ? "Solo un consultor autorizado puede administrar plantillas."
    : status === 404 ? "La plantilla o el programa ya no está disponible."
    : status === 400 ? "Revisa los campos y las fechas ingresadas."
    : status === 409 ? "No se pudo completar la operación. Revisa los requisitos o el nombre de la plantilla."
    : "No se pudo completar la operación con plantillas. Inténtalo de nuevo.";
  return message + (error instanceof ProgramTemplateRequestError && error.requestId
    ? ` Referencia: ${error.requestId}` : "");
}
