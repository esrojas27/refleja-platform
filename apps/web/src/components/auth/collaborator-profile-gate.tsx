"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { fetchCurrentIdentity } from "@/lib/auth/authenticated-api";

export function CollaboratorProfileGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentIdentity(undefined, controller.signal).then(identity => {
      if (controller.signal.aborted) return;
      const pending = identity.organizations.find(organization =>
        organization.roles.includes("COLLABORATOR") && organization.profileStatus === "PENDING");
      if (pending) {
        router.replace(`/profile?organizationId=${encodeURIComponent(pending.id)}`);
      } else {
        setReady(true);
      }
    }).catch(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, [router]);

  if (!ready) return <section className="rti-surface mx-auto w-full max-w-5xl p-6 sm:p-8">
    <p role="status" className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">Comprobando el estado de tu perfil…</p>
  </section>;
  return children;
}
