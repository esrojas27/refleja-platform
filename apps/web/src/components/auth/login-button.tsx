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
    <div className="mt-6">
      <button
        type="button"
        onClick={startSignIn}
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
