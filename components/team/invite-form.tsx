"use client";
import { useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useT } from "@/lib/i18n/client";

type Result =
  | { ok: true; email: string; role: string; link: string; emailDelivered: boolean }
  | { ok: false; error: string };

export function InviteTeammateForm() {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"broker_agent" | "broker_admin">("broker_agent");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await csrfFetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setResult({ ok: false, error: j.error || t("broker.team.inviteFailed") });
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
          <label className="block text-xs font-medium mb-1">{t("common.name")}</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anita Sharma"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">{t("common.email")}</label>
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
          <label className="block text-xs font-medium mb-1">{t("broker.team.role")}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="broker_agent">{t("role.broker_agent")}</option>
            <option value="broker_admin">{t("broker.team.adminFull")}</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-brand text-white px-4 py-2 rounded text-sm hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? t("common.sending") : t("broker.team.sendInvite")}
      </button>

      {result && result.ok && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-xs space-y-1">
          <div>
            {t("broker.team.invitedAs")
              .split(/(\{email\}|\{role\})/)
              .map((part, i) =>
                part === "{email}" ? (
                  <strong key={i}>{result.email}</strong>
                ) : part === "{role}" ? (
                  <strong key={i}>{t(`role.${result.role}`)}</strong>
                ) : (
                  part
                )
              )}
            {result.emailDelivered ? t("broker.team.emailSent") : t("broker.team.emailNotSent")}
          </div>
          {!result.emailDelivered && <div className="text-red-700">{t("broker.team.emailErrorHelp")}</div>}
          <div className="break-all">
            <strong>{t("broker.team.link")}</strong>{" "}
            <code className="bg-white border px-1 rounded">{result.link}</code>
          </div>
          <div className="text-gray-600">{t("broker.team.linkExpires")}</div>
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
