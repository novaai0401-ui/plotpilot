/**
 * WhatsApp Cloud API webhook coverage.
 *
 * Replays the documented Meta payload shapes against our receiver and asserts
 * the resulting DB state. These payloads were transcribed from Meta's developer
 * docs and observed live test deliveries, so a green pass here means we won't
 * silently mishandle real Meta deliveries in prod.
 *
 * Source: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 *
 * Coverage:
 *   - GET verification handshake (token match + mismatch)
 *   - status: sent → delivered → read transitions
 *   - status: failed with error code
 *   - inbound text message
 *   - inbound non-text message (image / sticker / etc.)
 *   - inbound from unknown phone (no client row) — must not 500
 *   - malformed payloads (missing entry, missing changes) — must not 500
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { prisma } from "@/lib/db/prisma";
import {
  SKIP_INTEGRATION,
  createTestOrg,
  createTestUser,
  resetDb,
  teardown,
} from "./setup";

const VERIFY_TOKEN = "ci-verify-token-stable";

beforeAll(() => {
  process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await teardown();
});

function metaPostBody(value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15555551234", phone_number_id: "PNID" },
              ...value,
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

function asNextRequest(body: unknown): Request {
  return new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe.skipIf(SKIP_INTEGRATION)("GET /api/webhooks/whatsapp (verification handshake)", () => {
  it("echoes hub.challenge when verify token matches", async () => {
    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "1234567890");
    const res = await GET(new Request(url) as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1234567890");
  });

  it("rejects when verify token mismatches", async () => {
    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "1234567890");
    const res = await GET(new Request(url) as any);
    expect(res.status).toBe(403);
  });

  it("rejects when hub.mode is missing or wrong", async () => {
    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    const res = await GET(new Request(url) as any);
    expect(res.status).toBe(403);
  });
});

describe.skipIf(SKIP_INTEGRATION)("POST /api/webhooks/whatsapp — status updates", () => {
  it("flips Message status sent → delivered → read", async () => {
    const org = await createTestOrg();
    const agent = await createTestUser(org.id, { role: "broker_admin" });
    const client = await createTestUser(org.id, {
      role: "client",
      phone: `+9199${Math.floor(Math.random() * 100_000_000)}`,
    });
    const messageId = `wamid.${Math.random().toString(36).slice(2)}`;
    const msg = await prisma.message.create({
      data: {
        orgId: org.id,
        senderId: agent.id,
        recipientId: client.id,
        channel: "whatsapp_api",
        body: "Test outbound",
        externalRef: messageId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // delivered
    let res = await POST(
      asNextRequest(
        metaPostBody({
          statuses: [
            {
              id: messageId,
              recipient_id: client.phone.replace(/^\+/, ""),
              status: "delivered",
              timestamp: String(Math.floor(Date.now() / 1000)),
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(1);
    expect((await prisma.message.findUnique({ where: { id: msg.id } }))?.status).toBe("delivered");

    // read
    res = await POST(
      asNextRequest(
        metaPostBody({
          statuses: [
            {
              id: messageId,
              recipient_id: client.phone.replace(/^\+/, ""),
              status: "read",
              timestamp: String(Math.floor(Date.now() / 1000)),
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);
    expect((await prisma.message.findUnique({ where: { id: msg.id } }))?.status).toBe("read");

    // Analytics events should exist for each transition.
    const events = await prisma.analyticsEvent.findMany({
      where: { orgId: org.id, type: { in: ["message.delivered", "message.read"] } },
    });
    expect(events.length).toBe(2);
  });

  it("captures error message when Meta sends a 'failed' status", async () => {
    const org = await createTestOrg();
    const agent = await createTestUser(org.id);
    const client = await createTestUser(org.id, { role: "client" });
    const messageId = `wamid.${Math.random().toString(36).slice(2)}`;
    const msg = await prisma.message.create({
      data: {
        orgId: org.id,
        senderId: agent.id,
        recipientId: client.id,
        channel: "whatsapp_api",
        body: "Test outbound",
        externalRef: messageId,
        status: "sent",
        sentAt: new Date(),
      },
    });

    const res = await POST(
      asNextRequest(
        metaPostBody({
          statuses: [
            {
              id: messageId,
              recipient_id: client.phone.replace(/^\+/, ""),
              status: "failed",
              timestamp: String(Math.floor(Date.now() / 1000)),
              errors: [
                {
                  code: 131_026,
                  title: "Receiver is incapable of receiving this message",
                  message: "Re-engagement message",
                },
              ],
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const updated = await prisma.message.findUnique({ where: { id: msg.id } });
    expect(updated?.status).toBe("failed");
    expect(updated?.errorMessage).toContain("Re-engagement");
  });

  it("silently ignores status updates for messages we don't have", async () => {
    const res = await POST(
      asNextRequest(
        metaPostBody({
          statuses: [
            {
              id: "wamid.never_seen_this_one",
              recipient_id: "919876543210",
              status: "delivered",
              timestamp: String(Math.floor(Date.now() / 1000)),
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(0);
  });
});

describe.skipIf(SKIP_INTEGRATION)("POST /api/webhooks/whatsapp — inbound messages", () => {
  it("creates a Message row for an inbound text message", async () => {
    const org = await createTestOrg();
    const agent = await createTestUser(org.id, { role: "broker_admin" });
    // Need a client linked to an owning agent (ownerAgentId) for inbound to route.
    const clientPhone = `+9199${Math.floor(Math.random() * 100_000_000)}`;
    const client = await prisma.user.create({
      data: {
        authId: `auth-c-${Math.random()}`,
        orgId: org.id,
        role: "client",
        name: "Inbound Client",
        email: `inbound-${Math.random()}@example.com`,
        phone: clientPhone,
        ownerAgentId: agent.id,
      },
    });

    const messageId = `wamid.${Math.random().toString(36).slice(2)}`;
    const res = await POST(
      asNextRequest(
        metaPostBody({
          contacts: [{ profile: { name: "Inbound Client" }, wa_id: clientPhone.replace(/^\+/, "") }],
          messages: [
            {
              from: clientPhone.replace(/^\+/, ""),
              id: messageId,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "text",
              text: { body: "Hi, is plot #7 still available?" },
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const inbound = await prisma.message.findFirst({
      where: { senderId: client.id, recipientId: agent.id, externalRef: messageId },
    });
    expect(inbound).not.toBeNull();
    expect(inbound?.body).toContain("plot #7");
    expect(inbound?.channel).toBe("whatsapp_api");
    expect(inbound?.status).toBe("delivered");
  });

  it("renders a placeholder body for non-text inbound (image / sticker / location etc.)", async () => {
    const org = await createTestOrg();
    const agent = await createTestUser(org.id, { role: "broker_admin" });
    const clientPhone = `+9199${Math.floor(Math.random() * 100_000_000)}`;
    const client = await prisma.user.create({
      data: {
        authId: `auth-c-${Math.random()}`,
        orgId: org.id,
        role: "client",
        name: "Image Client",
        email: `img-${Math.random()}@example.com`,
        phone: clientPhone,
        ownerAgentId: agent.id,
      },
    });

    const res = await POST(
      asNextRequest(
        metaPostBody({
          messages: [
            {
              from: clientPhone.replace(/^\+/, ""),
              id: `wamid.${Math.random().toString(36).slice(2)}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "image",
              image: { mime_type: "image/jpeg", sha256: "abc", id: "media_id_123" },
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);

    const msg = await prisma.message.findFirst({
      where: { senderId: client.id, recipientId: agent.id },
    });
    expect(msg?.body).toContain("image");
    expect(msg?.body).toMatch(/open WhatsApp/i);
  });

  it("ignores inbound from a phone that doesn't match any client (no 500)", async () => {
    const res = await POST(
      asNextRequest(
        metaPostBody({
          messages: [
            {
              from: "919999999999", // never seen
              id: `wamid.${Math.random().toString(36).slice(2)}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "text",
              text: { body: "Hello?" },
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);
    // No Message row should have been created.
    expect(await prisma.message.count()).toBe(0);
  });

  it("ignores inbound from a client with no owner agent (orphaned data)", async () => {
    const org = await createTestOrg();
    const clientPhone = `+9199${Math.floor(Math.random() * 100_000_000)}`;
    await prisma.user.create({
      data: {
        authId: `auth-orphan-${Math.random()}`,
        orgId: org.id,
        role: "client",
        name: "Orphan",
        email: `orphan-${Math.random()}@example.com`,
        phone: clientPhone,
        // ownerAgentId omitted on purpose
      },
    });

    const res = await POST(
      asNextRequest(
        metaPostBody({
          messages: [
            {
              from: clientPhone.replace(/^\+/, ""),
              id: `wamid.${Math.random().toString(36).slice(2)}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: "text",
              text: { body: "ping" },
            },
          ],
        })
      ) as any
    );
    expect(res.status).toBe(200);
    expect(await prisma.message.count()).toBe(0);
  });
});

describe.skipIf(SKIP_INTEGRATION)("POST /api/webhooks/whatsapp — malformed payloads", () => {
  it("returns 400 on non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/webhooks/whatsapp", {
        method: "POST",
        body: "not-json",
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("handles payload with no entry array (returns 200, updated=0)", async () => {
    const res = await POST(asNextRequest({ object: "whatsapp_business_account" }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(0);
  });

  it("handles payload with empty changes array", async () => {
    const res = await POST(
      asNextRequest({
        object: "whatsapp_business_account",
        entry: [{ id: "WBA", changes: [] }],
      }) as any
    );
    expect(res.status).toBe(200);
  });
});
