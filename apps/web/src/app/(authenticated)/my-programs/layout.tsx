import type { ReactNode } from "react";

import { AccountWorkspace } from "@/components/auth/account-workspace";
import { CollaboratorProfileGate } from "@/components/auth/collaborator-profile-gate";

export default function Layout({ children }: { children: ReactNode }) {
  return <CollaboratorProfileGate><AccountWorkspace>{children}</AccountWorkspace></CollaboratorProfileGate>;
}
