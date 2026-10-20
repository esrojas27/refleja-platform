"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getProgram, type Program } from "@/lib/programs/program-api";
import { isProgramClosed, programStatusLabels } from "@/lib/programs/program-lifecycle";

type ProgramState = { program?: Program; canEdit: boolean; canExecute: boolean; update: (program: Program) => void };
export const ProgramStateContext = createContext<ProgramState | null>(null);
export function useProgramState() {
  return useContext(ProgramStateContext);
}

export function ProgramStateProvider({ organizationId, programId, pathname, children }: {
  organizationId: string; programId: string; pathname: string; children: ReactNode;
}) {
  const [loaded, setLoaded] = useState<Program>();
  const program = loaded?.id === programId && loaded.organizationId === organizationId ? loaded : undefined;
  useEffect(() => {
    const controller = new AbortController();
    getProgram(organizationId, programId, controller.signal).then(value => {
      if (!controller.signal.aborted) setLoaded(value);
    }).catch(() => { if (!controller.signal.aborted) setLoaded(undefined); });
    return () => controller.abort();
  }, [organizationId, programId, pathname]);
  return <ProgramStateContext.Provider value={{ program,
    canEdit: program !== undefined && !isProgramClosed(program.status),
    canExecute: program?.status === "ACTIVE", update: setLoaded }}>
    {program && isProgramClosed(program.status) && <aside className="mb-5 rounded-2xl border border-border bg-muted/50 p-4 text-sm">
      <strong>{programStatusLabels[program.status]} · Solo consulta.</strong> Se conservan el contenido, las personas, las entregas y el progreso.
    </aside>}
    {children}
  </ProgramStateContext.Provider>;
}
