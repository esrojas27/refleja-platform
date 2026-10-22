import { ProgramReportArea } from "@/components/programs/program-report-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <ProgramReportArea organizationId={organizationId} programId={programId} />;
}
