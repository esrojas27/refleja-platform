import { EnrollmentArea } from "@/components/participation/enrollment-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <main className="flex min-h-screen items-start justify-center p-4 sm:p-8"><EnrollmentArea organizationId={organizationId} programId={programId} /></main>;
}
