import { MySessionAgenda } from "@/components/participation/my-session-agenda";
export default async function Page({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  return <MySessionAgenda programId={programId} />;
}
