import { fetchAuthSession } from "aws-amplify/auth";

export type CurrentIdentity = {
  cognitoSubject: string;
};

export async function fetchCurrentIdentity(): Promise<CurrentIdentity> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("The backend API URL is not configured");
  }

  const session = await fetchAuthSession();
  const accessToken = session.tokens?.accessToken;
  if (!accessToken) {
    throw new Error("No Cognito access token is available");
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken.toString()}`,
    },
  });
  if (!response.ok) {
    throw new Error("The authenticated identity request failed");
  }

  return response.json() as Promise<CurrentIdentity>;
}
