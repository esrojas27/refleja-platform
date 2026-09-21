import { ProgramDiscArea } from "@/components/programs/program-disc-area";

export default async function Page({ params }: {
  params: Promise<{ organizationId: string; programId: string }>;
}) {
  const { organizationId, programId } = await params;
  return <ProgramDiscArea organizationId={organizationId} programId={programId} />;
}
