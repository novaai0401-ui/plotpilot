import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DeeplinkProvider, buildWaMeUrl } from "@/lib/whatsapp/deeplink-provider";
import { BusinessApiProvider } from "@/lib/whatsapp/business-api-provider";

describe("DeeplinkProvider", () => {
  it("strips non-digit characters from phone", async () => {
    const p = new DeeplinkProvider();
    const r = await p.send({ to: "+91 (987) 654-3210", body: "hi" });
    expect(r.kind).toBe("deeplink");
    if (r.kind === "deeplink") {
      expect(r.url).toContain("https://wa.me/919876543210");
    }
  });

  it("URL-encodes the message body (including spaces and unicode)", async () => {
    const p = new DeeplinkProvider();
    const r = await p.send({ to: "+919876543210", body: "Hi नमस्ते & welcome!" });
    if (r.kind !== "deeplink") throw new Error("expected deeplink");
    expect(r.url).toContain(encodeURIComponent("Hi नमस्ते & welcome!"));
    expect(r.url).not.toContain(" "); // no raw spaces
  });

  it("buildWaMeUrl helper produces the same shape", () => {
    const url = buildWaMeUrl("+919876543210", "test message");
    expect(url).toBe(`https://wa.me/919876543210?text=${encodeURIComponent("test message")}`);
  });
});

describe("BusinessApiProvider", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("posts to the correct Meta Cloud API endpoint with auth + JSON payload", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [{ id: "wamid.XYZ" }] }), { status: 200 })
    );
    const p = new BusinessApiProvider({ phoneNumberId: "123", accessToken: "secret" });
    const r = await p.send({ to: "+91 9876543210", body: "hello" });
    expect(r.kind).toBe("api");
    if (r.kind === "api") {
      expect(r.messageId).toBe("wamid.XYZ");
      expect(r.status).toBe("sent");
    }
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("graph.facebook.com");
    expect(String(url)).toContain("/123/messages");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(init?.body));
    expect(body.to).toBe("919876543210");
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("hello");
  });

  it("returns an error result on 4xx response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("invalid token", { status: 401 })
    );
    const p = new BusinessApiProvider({ phoneNumberId: "123", accessToken: "bad" });
    const r = await p.send({ to: "+919876543210", body: "hi" });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.error).toContain("401");
    }
  });

  it("returns an error result on network failure", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const p = new BusinessApiProvider({ phoneNumberId: "123", accessToken: "x" });
    const r = await p.send({ to: "+919876543210", body: "hi" });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.error).toMatch(/ECONNREFUSED/);
    }
  });
});
