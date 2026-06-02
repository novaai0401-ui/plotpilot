import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { BusinessApiProvider } from "@/lib/whatsapp/business-api-provider";

/**
 * One-shot connection test for WhatsApp Business credentials.
 *
 * Hits the Meta Graph `/me` endpoint (the lowest-privilege call we can make) with
 * the user-supplied access token. If it succeeds, the token is at least live and
 * the phone-number-id is well-formed. If it fails, we surface Meta's exact error
 * message so the broker can fix it without leaving the page.
 *
 * Does NOT send an actual WhatsApp message — that would risk billing the org for
 * a test call. The /me probe is free.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(["broker_admin"]);
  const { phoneNumberId, accessToken } = await req.json();
  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { ok: false, error: "Provide both phoneNumberId and accessToken." },
      { status: 400 }
    );
  }

  try {
    // Step 1: validate the access token itself
    const meRes = await fetch("https://graph.facebook.com/v20.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      const err = await meRes.text();
      return NextResponse.json(
        {
          ok: false,
          step: "token",
          error: `Meta rejected the access token (HTTP ${meRes.status}). Detail: ${err.slice(0, 300)}`,
        },
        { status: 200 }
      );
    }

    // Step 2: validate the phone number id by fetching its display info
    const phoneRes = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!phoneRes.ok) {
      const err = await phoneRes.text();
      return NextResponse.json(
        {
          ok: false,
          step: "phone_number",
          error: `Meta rejected the phone-number ID (HTTP ${phoneRes.status}). Detail: ${err.slice(0, 300)}`,
        },
        { status: 200 }
      );
    }
    const phoneJson = (await phoneRes.json()) as { display_phone_number?: string; verified_name?: string };

    return NextResponse.json({
      ok: true,
      phoneNumber: phoneJson.display_phone_number,
      verifiedName: phoneJson.verified_name,
      message: "Credentials look healthy. Save settings to start sending real messages.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Network error reaching Meta Graph API." },
      { status: 200 }
    );
  }
}
