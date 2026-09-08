"use client";

import { useCallback, useState } from "react";
import { signOut } from "aws-amplify/auth";

import {
  fetchCurrentIdentity,
  type CurrentIdentity,
} from "@/lib/auth/authenticated-api";

export function AccountSession() {
  const [identity, setIdentity] = useState<CurrentIdentity>();
  const [message, setMessage] = useState(
    "Comprueba la sesión después de volver de Cognito.",
  );

  const refreshIdentity = useCallback(async () => {
    setMessage("Comprobando la sesión…");
    try {
      const currentIdentity = await fetchCurrentIdentity();
      setIdentity(currentIdentity);
      setMessage("Sesión autenticada.");
    } catch {
      setIdentity(undefined);
      setMessage("No hay una sesión autenticada disponible.");
    }
  }, []);

  async function endSession() {
    await signOut();
  }

  return (
    <section className="w-full rounded-xl border bg-background p-6 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-muted-foreground">
        Área autenticada mínima
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Cuenta</h1>
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        {message}
      </p>
      {identity ? (
        <dl className="mt-4">
          <dt className="text-sm font-medium">Identificador Cognito</dt>
          <dd className="mt-1 break-all text-sm text-muted-foreground">
            {identity.cognitoSubject}
          </dd>
        </dl>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={refreshIdentity}
          className="min-h-10 rounded-md border px-4 py-2 text-sm font-medium"
        >
          Comprobar sesión
        </button>
        <button
          type="button"
          onClick={endSession}
          className="min-h-10 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
