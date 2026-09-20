import type { ReactNode } from "react";

import { AccountWorkspace } from "@/components/auth/account-workspace";

export default function Layout({ children }: { children: ReactNode }) {
  return <AccountWorkspace>{children}</AccountWorkspace>;
}
