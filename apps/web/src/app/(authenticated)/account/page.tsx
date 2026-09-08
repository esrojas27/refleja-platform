import { AccountSession } from "@/components/auth/account-session";

export default function AccountPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-12 sm:px-8">
      <AccountSession />
    </main>
  );
}
