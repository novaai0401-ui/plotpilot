import { Resend } from "resend";

let cached: Resend | null = null;
function client(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | Uint8Array }>;
};

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Thin wrapper around Resend. Returns { ok: false } if RESEND_API_KEY is missing
 * (so cron jobs can no-op gracefully in dev).
 */
export async function sendEmail(p: SendEmailParams): Promise<SendResult> {
  const c = client();
  if (!c) {
    console.warn("[email] RESEND_API_KEY missing; skipping send");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const from = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
  try {
    // Resend's `attachments` expects content as base64 string OR Buffer
    const attachments = p.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
    }));
    const res = await c.emails.send({
      from,
      to: p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
      attachments,
    } as any);
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id || "unknown" };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
