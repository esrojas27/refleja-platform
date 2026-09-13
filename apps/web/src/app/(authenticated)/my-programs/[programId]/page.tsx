import { MyProgramArea } from "@/components/participation/my-program-area";

export default async function Page({ params }: PageProps<"/my-programs/[programId]">) {
  const { programId } = await params;
  return <MyProgramArea key={programId} mode="detail" programId={programId} />;
}
