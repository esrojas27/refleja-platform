"use client";

import { useState } from "react";
import { signInWithRedirect } from "aws-amplify/auth";

import { isAuthenticationConfigured } from "@/lib/auth/amplify-configuration";

export function LoginButton() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function startSignIn() {
    if (!isAuthenticationConfigured()) {
      setError("La autenticación de desarrollo aún no está configurada.");
      return;
    }

    setError(undefined);
    setPending(true);
    try {
      await signInWithRedirect();
    } catch {
      setError("No fue posible iniciar la autenticación.");
      setPending(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={startSignIn}
        disabled={pending}
        className="rti-button-primary w-full sm:w-auto"
      >
        {pending ? "Redirigiendo…" : "Continuar con Cognito"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
