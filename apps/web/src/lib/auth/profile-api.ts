import { fetchAuthSession } from "aws-amplify/auth";

export type CollaboratorProfileStatus = "PENDING" | "COMPLETE";
export type CollaboratorProfile = {
  organizationId: string;
  company: string;
  email: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  jobTitle: string | null;
  status: CollaboratorProfileStatus;
};
export type CollaboratorProfileInput = {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  city: string;
  country: string;
  jobTitle: string;
};

export class ProfileRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Collaborator profile request failed");
    this.name = "ProfileRequestError";
  }
}

async function request(organizationId: string, method: "GET" | "PUT", input?: CollaboratorProfileInput,
  signal?: AbortSignal): Promise<CollaboratorProfile> {
  signal?.throwIfAborted();
  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  if (!session.tokens?.accessToken) throw new ProfileRequestError(401);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new ProfileRequestError(0);
  const url = new URL(`${base.replace(/\/$/, "")}/api/v1/me/profile`);
  url.searchParams.set("organizationId", organizationId);
  const response = await fetch(url, {
    method,
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.tokens.accessToken.toString()}`,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const allowed = ["fullName", "dateOfBirth", "phone", "city", "country", "jobTitle"];
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((error: { field?: unknown }) => error?.field)
        .filter((field: unknown): field is string => typeof field === "string" && allowed.includes(field))
      : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId)
      ? body.requestId : undefined;
    throw new ProfileRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<CollaboratorProfile>;
}

export const getCollaboratorProfile = (organizationId: string, signal?: AbortSignal) =>
  request(organizationId, "GET", undefined, signal);

export const completeCollaboratorProfile = (organizationId: string, input: CollaboratorProfileInput,
  signal?: AbortSignal) => request(organizationId, "PUT", input, signal);

export function profileErrorMessage(error: unknown) {
  const status = error instanceof ProfileRequestError ? error.status : 0;
  const message = status === 401 ? "Tu sesión no está disponible. Inicia sesión de nuevo."
    : status === 403 || status === 404 ? "El perfil no está disponible para esta cuenta y organización."
      : status === 400 ? "Revisa los campos marcados y vuelve a intentarlo."
        : status === 409 ? "El perfil cambió. Actualiza la página antes de intentarlo de nuevo."
          : "No se pudo completar el perfil. Inténtalo de nuevo.";
  return message + (error instanceof ProfileRequestError && error.requestId ? ` Referencia: ${error.requestId}` : "");
}
