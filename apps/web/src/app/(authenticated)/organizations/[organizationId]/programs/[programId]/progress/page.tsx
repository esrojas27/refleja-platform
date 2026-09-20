import { ProgramProgressArea } from "@/components/programs/program-progress-area";

export default async function Page({ params }: {
  params: Promise<{ organizationId: string; programId: string }>;
}) {
  const { organizationId, programId } = await params;
  return <ProgramProgressArea organizationId={organizationId} programId={programId} />;
}
