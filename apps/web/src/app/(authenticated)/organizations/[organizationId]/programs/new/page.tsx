import { AccountWorkspace } from "@/components/auth/account-workspace";
import { ProgramArea } from "@/components/programs/program-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <AccountWorkspace>
    <ProgramArea key={organizationId} organizationId={organizationId} mode="create" />
  </AccountWorkspace>;
}
