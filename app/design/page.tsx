import Link from "next/link";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";

// Public, no-auth lead-gen page
export default function PublicDesignPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-teal-50">
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="font-bold text-xl text-brand">PlotBroker</Link>
        <nav className="text-sm">
          <Link href="/login" className="hover:text-brand">Brokers login</Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900">
          Design your dream building in 60 seconds.
        </h1>
        <p className="mt-4 text-gray-600">
          Answer a few questions about your plot and preferences — get an AI-generated floor plan,
          design brief, and concept render. Free. No signup needed.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <RequirementsWizard source="public_lead" />
      </section>

      <footer className="text-center text-xs text-gray-500 py-10">
        Looking to list properties or invite clients? <Link href="/signup" className="text-brand">Start a free org</Link>.
      </footer>
    </main>
  );
}
