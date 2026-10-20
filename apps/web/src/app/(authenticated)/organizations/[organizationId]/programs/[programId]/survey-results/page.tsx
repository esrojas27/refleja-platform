import { ProgramSurveyResultsArea } from "@/components/programs/program-survey-results-area";

export default async function Page({ params }: {
  params: Promise<{ organizationId: string; programId: string }>;
}) {
  const { organizationId, programId } = await params;
  return <ProgramSurveyResultsArea organizationId={organizationId} programId={programId} />;
}
