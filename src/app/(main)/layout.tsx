import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 lg:px-6">{children}</main>
    </>
  );
}
