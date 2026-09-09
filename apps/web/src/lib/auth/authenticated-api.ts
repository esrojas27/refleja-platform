import { fetchAuthSession } from "aws-amplify/auth";

export type CurrentIdentity = {
  cognitoSubject: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  organizations: { id: string; name: string; roles: string[] }[];
  activeOrganizationId: string | null;
  roles: string[];
  canCreateOrganizations?: boolean;
};

export class IdentityRequestError extends Error {
  constructor(public readonly status: number, message = "The authenticated identity request failed") {
    super(message);
    this.name = "IdentityRequestError";
  }
}

export async function fetchCurrentIdentity(organizationId?: string, signal?: AbortSignal): Promise<CurrentIdentity> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("The backend API URL is not configured");
  }

  const session = await fetchAuthSession();
  const accessToken = session.tokens?.accessToken;
  if (!accessToken) {
    throw new IdentityRequestError(401, "No Cognito access token is available");
  }

  const url = new URL(`${apiBaseUrl.replace(/\/$/, "")}/api/v1/me`);
  if (organizationId) url.searchParams.set("organizationId", organizationId);
  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal,
    headers: {
      Authorization: `Bearer ${accessToken.toString()}`,
    },
  });
  if (!response.ok) {
    throw new IdentityRequestError(response.status);
  }

  return response.json() as Promise<CurrentIdentity>;
}
