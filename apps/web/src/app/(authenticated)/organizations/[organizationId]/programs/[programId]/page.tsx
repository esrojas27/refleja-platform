import { ProgramArea } from "@/components/programs/program-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <ProgramArea key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} mode="detail" />;
}
