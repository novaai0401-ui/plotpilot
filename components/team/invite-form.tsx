"use client";
import { useState } from "react";

type Result =
  | { ok: true; email: string; role: string; link: string; emailDelivered: boolean; emailError?: string | null }
  | { ok: false; error: string };

export function InviteTeammateForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"broker_agent" | "broker_admin">("broker_agent");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setResult({ ok: false, error: j.error || "Invite failed" });
      return;
    }
    setResult(j as Result);
    setName("");
    setEmail("");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border rounded-lg p-4 space-y-3"
    >
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anita Sharma"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anita@firm.in"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="broker_agent">Agent</option>
            <option value="broker_admin">Admin (full org access)</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send invite"}
      </button>

      {result && result.ok && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs space-y-1">
          <div>
            ✓ Invited <strong>{result.email}</strong> as <strong>{result.role}</strong>.
            {result.emailDelivered ? " Email sent." : " (Email not sent — see error below.)"}
          </div>
          {!result.emailDelivered && (
            <div className="text-red-700">
              <strong>Email error:</strong> {result.emailError || "unknown"}. Copy the link below and send it manually.
            </div>
          )}
          <div className="break-all">
            <strong>Link:</strong>{" "}
            <code className="bg-white border px-1 rounded">{result.link}</code>
          </div>
          <div className="text-gray-600">Link expires in 14 days.</div>
        </div>
      )}
      {result && !result.ok && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
          ✗ {result.error}
        </div>
      )}
    </form>
  );
}
