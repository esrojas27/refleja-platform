import { fetchAuthSession } from "aws-amplify/auth";

export type Organization = { id: string; name: string; status: "ACTIVE"; defaultTimeZone: string; version: number };
export type OrganizationInput = { name: string; defaultTimeZone: string };

export class OrganizationRequestError extends Error {
  constructor(public readonly status: number, public readonly fields: string[] = [], public readonly requestId?: string) {
    super("Organization creation failed");
    this.name = "OrganizationRequestError";
  }
}

export async function createOrganization(input: OrganizationInput, signal?: AbortSignal): Promise<Organization> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new OrganizationRequestError(0);
  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken) throw new OrganizationRequestError(401);
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/organizations`, {
    method: "POST", cache: "no-store", signal,
    headers: { Authorization: `Bearer ${session.tokens.accessToken.toString()}`, "Content-Type": "application/json" },
    // Never send caller-supplied IDs, roles, status, owner or version.
    body: JSON.stringify({ name: input.name, defaultTimeZone: input.defaultTimeZone }),
  });
  if (response.status !== 201) {
    const body = await response.json().catch(() => null);
    const fields = body?.code === "VALIDATION_ERROR" && Array.isArray(body.errors)
      ? body.errors.map((e: { field?: unknown }) => e?.field).filter((f: unknown): f is string => f === "name" || f === "defaultTimeZone") : [];
    const requestId = typeof body?.requestId === "string" && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : undefined;
    throw new OrganizationRequestError(response.status, fields, requestId);
  }
  return response.json() as Promise<Organization>;
}
