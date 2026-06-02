import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/visits", label: "My visits" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/design", label: "Design a building" },
  { href: "/portal/profile", label: "Profile" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["client"]);
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-brand">PlotBroker</div>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-brand">
                {n.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-2 text-xs text-gray-500">
          Welcome, {user.name}
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
