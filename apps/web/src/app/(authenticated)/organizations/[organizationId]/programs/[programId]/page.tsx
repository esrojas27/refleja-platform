import { ProgramArea } from "@/components/programs/program-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <main className="flex min-h-screen items-start justify-center p-4 sm:p-8"><ProgramArea key={`${organizationId}/${programId}`} organizationId={organizationId} programId={programId} mode="detail" /></main>;
}
