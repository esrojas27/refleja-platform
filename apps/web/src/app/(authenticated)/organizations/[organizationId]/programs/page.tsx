import { ProgramArea } from "@/components/programs/program-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <main className="flex min-h-screen items-start justify-center p-4 sm:p-8"><ProgramArea key={organizationId} organizationId={organizationId} mode="list" /></main>;
}
