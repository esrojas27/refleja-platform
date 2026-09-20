import type { ReactNode } from "react";

import { CollaboratorProgramWorkspace } from "@/components/participation/collaborator-program-workspace";

export default async function Layout({ children, params }: {
  children: ReactNode;
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  return <CollaboratorProgramWorkspace programId={programId}>{children}</CollaboratorProgramWorkspace>;
}
