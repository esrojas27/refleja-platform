import { SessionAgendaArea } from "@/components/programs/session-agenda";
export default async function Page({ params, searchParams }: {
  params: Promise<{ organizationId: string; programId: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { organizationId, programId } = await params;
  const { session } = await searchParams;
  return <SessionAgendaArea organizationId={organizationId} programId={programId} sessionId={typeof session === "string" ? session : undefined} />;
}
