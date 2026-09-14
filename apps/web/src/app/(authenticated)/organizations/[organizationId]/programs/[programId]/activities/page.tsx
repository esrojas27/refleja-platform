import { ProgramActivityArea } from "@/components/programs/program-activity-area";

export default async function Page({ params }: {
  params: Promise<{ organizationId: string; programId: string }>;
}) {
  const { organizationId, programId } = await params;
  return <ProgramActivityArea organizationId={organizationId} programId={programId} />;
}
