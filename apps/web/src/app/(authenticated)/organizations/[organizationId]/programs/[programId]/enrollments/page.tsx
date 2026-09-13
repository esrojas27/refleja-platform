import { EnrollmentArea } from "@/components/participation/enrollment-area";

export default async function Page({ params }: { params: Promise<{ organizationId: string; programId: string }> }) {
  const { organizationId, programId } = await params;
  return <EnrollmentArea organizationId={organizationId} programId={programId} />;
}
