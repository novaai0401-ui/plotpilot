/**
 * HTML email templates. Inline styles only — most clients strip <style> blocks.
 */

export type LeadFollowupVars = {
  name: string;
  projectType: string;
  totalSqft: number;
  designUrl: string;
  appName: string;
};

// ----- A/B subject variants -----
// Add/remove variants here. Picked deterministically from designId so a given
// lead always gets the same variant (important for honest measurement).

export const SUBJECT_VARIANTS = {
  v1: (v: LeadFollowupVars) =>
    `Your ${v.projectType.replace(/_/g, " ")} design is saved`,
  v2: (v: LeadFollowupVars) =>
    `${v.name}, your ${v.totalSqft} sqft plan is ready — open it before it expires`,
  v3: (v: LeadFollowupVars) =>
    `Quick — your building design + cost estimate`,
} as const;

export type SubjectVariant = keyof typeof SUBJECT_VARIANTS;

/** Deterministic bucket: hash designId into one of the variant keys. */
export function pickSubjectVariant(designId: string): SubjectVariant {
  const keys = Object.keys(SUBJECT_VARIANTS) as SubjectVariant[];
  let h = 0;
  for (let i = 0; i < designId.length; i++) h = (h * 31 + designId.charCodeAt(i)) >>> 0;
  return keys[h % keys.length];
}

export function renderSubject(variant: SubjectVariant, v: LeadFollowupVars): string {
  return SUBJECT_VARIANTS[variant](v);
}

/**
 * Renders the follow-up email body. `trackingUrls`, when provided, wraps the CTA
 * with a redirect endpoint and embeds a 1×1 open-tracking pixel.
 */
export function leadFollowupHtml(
  v: LeadFollowupVars,
  trackingUrls?: { clickUrl: string; pixelUrl: string }
): string {
  const ctaHref = trackingUrls?.clickUrl || v.designUrl;
  const pixelTag = trackingUrls
    ? `<img src="${escapeHtml(trackingUrls.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;"/>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f8f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr><td style="padding:32px 32px 16px;">
          <div style="font-size:14px;color:#0f766e;font-weight:700;">${escapeHtml(v.appName)}</div>
          <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Hi ${escapeHtml(v.name)}, your design is still ready.</h1>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#374151;">
            Yesterday you generated a ${escapeHtml(v.projectType.replace(/_/g, " "))} design on a ${v.totalSqft} sqft plot.
            We've saved it — view the full floor plans, brief, and concept render any time:
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#0f766e;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
            Open my design →
          </a>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#6b7280;">
            We've also attached a PDF copy to this email for your records.
          </p>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#6b7280;">
            Want help turning this into a real build? Reply to this email — a broker in your area can walk you through next steps.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
          You're receiving this because you used the free design tool. We won't follow up again unless you reply.
          ${pixelTag}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function leadFollowupText(v: LeadFollowupVars): string {
  return `Hi ${v.name},

Yesterday you generated a ${v.projectType.replace(/_/g, " ")} design on a ${v.totalSqft} sqft plot. We've saved it — view it any time:

${v.designUrl}

(A PDF copy is attached.)

Want help turning this into a real build? Reply to this email and a broker in your area can walk you through next steps.

— ${v.appName}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
