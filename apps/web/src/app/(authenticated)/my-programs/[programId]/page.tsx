import { MyProgramArea } from "@/components/participation/my-program-area";

export default async function Page({ params }: PageProps<"/my-programs/[programId]">) {
  const { programId } = await params;
  return <main className="flex min-h-screen items-start justify-center p-4 sm:p-8"><MyProgramArea key={programId} mode="detail" programId={programId} /></main>;
}
