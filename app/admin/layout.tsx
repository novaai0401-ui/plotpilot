import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orgs", label: "Organizations" },
  { href: "/admin/leads", label: "Public leads" },
  { href: "/admin/email-experiments", label: "Email A/B" },
  { href: "/admin/rate-limits", label: "Rate limits" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["super_admin"]);
  return (
    <div className="min-h-screen flex bg-gray-900 text-gray-100">
      <aside className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="text-xs uppercase text-gray-400">Platform</div>
          <div className="font-semibold">PlotBroker · Admin</div>
        </div>
        <nav className="p-2 flex-1 space-y-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block px-3 py-2 rounded hover:bg-gray-700">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700 text-xs">
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-400">super_admin</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto bg-gray-950">{children}</main>
    </div>
  );
}
