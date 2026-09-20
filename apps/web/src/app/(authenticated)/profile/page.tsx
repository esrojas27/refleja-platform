import { CollaboratorProfileForm } from "@/components/auth/collaborator-profile-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId = "" } = await searchParams;
  return <CollaboratorProfileForm organizationId={organizationId} />;
}
