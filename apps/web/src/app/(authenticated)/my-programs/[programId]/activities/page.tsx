import { MyProgramArea } from "@/components/participation/my-program-area";

export default async function Page({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <MyProgramArea key={programId} mode="activities" programId={programId} />;
}
