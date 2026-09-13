import { ProgramArea } from "@/components/programs/program-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <ProgramArea key={organizationId} organizationId={organizationId} mode="create" />;
}
