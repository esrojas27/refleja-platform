import type { ReactNode } from "react";
import { ProgramWorkspace } from "@/components/programs/program-workspace";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string; programId: string }>;
}) {
  const { organizationId, programId } = await params;

  return (
    <ProgramWorkspace organizationId={organizationId} programId={programId}>
      {children}
    </ProgramWorkspace>
  );
}
