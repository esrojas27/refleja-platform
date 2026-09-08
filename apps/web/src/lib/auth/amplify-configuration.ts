import { Amplify } from "aws-amplify";

const cognitoConfiguration = {
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID,
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  redirectSignIn: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN,
  redirectSignOut: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT,
};

let configured = false;

export function isAuthenticationConfigured() {
  return Object.values(cognitoConfiguration).every(Boolean);
}

export function configureAmplify() {
  if (configured || !isAuthenticationConfigured()) {
    return;
  }

  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: cognitoConfiguration.userPoolId!,
          userPoolClientId: cognitoConfiguration.userPoolClientId!,
          loginWith: {
            username: true,
            oauth: {
              domain: cognitoConfiguration.domain!,
              scopes: ["openid"],
              redirectSignIn: [cognitoConfiguration.redirectSignIn!],
              redirectSignOut: [cognitoConfiguration.redirectSignOut!],
              responseType: "code",
            },
          },
        },
      },
    },
    { ssr: true },
  );
  configured = true;
}
