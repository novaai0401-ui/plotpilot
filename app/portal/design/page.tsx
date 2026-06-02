import { requireUser } from "@/lib/auth/session";
import { RequirementsWizard } from "@/components/architect/requirements-wizard";

export default async function ClientDesignPage() {
  await requireUser(["client"]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Design a building</h1>
      <p className="text-sm text-gray-500">
        Answer a few questions and we'll auto-generate a floor plan, design brief, and concept image.
      </p>
      <RequirementsWizard source="client" />
    </div>
  );
}
