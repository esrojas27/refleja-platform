"use client";

import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

const HomeSession = createContext<boolean | null>(null);

export function HomeSessionProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function check() {
      const current = ++revision;
      try {
        const session = await fetchAuthSession();
        if (active && current === revision) setAuthenticated(Boolean(session.tokens?.accessToken));
      } catch {
        if (active && current === revision) setAuthenticated(false);
      }
    }
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedOut" || payload.event === "tokenRefresh_failure") {
        revision++; setAuthenticated(false);
      } else if (["signedIn", "tokenRefresh"].includes(payload.event)) void check();
    });
    void check();
    window.addEventListener("focus", check);
    return () => { active = false; revision++; stop(); window.removeEventListener("focus", check); };
  }, []);
  return <HomeSession.Provider value={authenticated}>{children}</HomeSession.Provider>;
}

export function HomeAccountLink({ className, children }: { className: string; children: ReactNode }) {
  const authenticated = useContext(HomeSession);
  if (authenticated === null) return <span className={className} aria-busy="true">Comprobando sesión…</span>;
  return <Link href={authenticated ? "/account" : "/login"} className={className}>
    {authenticated ? "Volver a mi cuenta" : children}
  </Link>;
}
