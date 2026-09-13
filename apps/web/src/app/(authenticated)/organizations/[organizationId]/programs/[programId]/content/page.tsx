import { ProgramContentArea } from "@/components/programs/program-content-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <ProgramContentArea organizationId={organizationId} programId={programId} />;
}
