import { describe, expect, test, vi } from "vitest";
import type { ClawProfile } from "../src/domain/types.ts";
import { createGateway } from "../src/gateway/index.ts";
import { OpenClawGateway, type SocketProbe } from "../src/gateway/openclaw.ts";

const claw: ClawProfile = {
  id: "claw_1",
  name: "小邮",
  duty: "盯邮件",
  template: "inbox",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenClawGateway", () => {
  test("createGateway selects it when a URL is set", () => {
    expect(createGateway({ OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789" }).mode).toBe("openclaw");
  });

  test("health is online when /v1/models lists agents", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      void url;
      return jsonResponse({ data: [{ id: "openclaw/default" }] });
    });
    const probeSocket = vi.fn(async (): Promise<SocketProbe> => ({ opened: true, challenged: true }));
    const gateway = new OpenClawGateway({
      baseUrl: "http://127.0.0.1:18789/v1",
      fetchImpl,
      probeSocket,
    });

    const health = await gateway.health();
    expect(health).toMatchObject({ status: "online", code: "http_ready", chatReady: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("http://127.0.0.1:18789/v1/models");
    expect(probeSocket).not.toHaveBeenCalled();
  });

  test("missing token is needs_you and a dead port is offline", async () => {
    const denied = new OpenClawGateway({
      baseUrl: "127.0.0.1:18789",
      fetchImpl: vi.fn(async () => jsonResponse({ error: "nope" }, 401)),
      probeSocket: vi.fn(async () => ({ opened: false, challenged: false })),
    });
    expect(await denied.health()).toMatchObject({ status: "needs_you", code: "unauthorized" });

    const down = new OpenClawGateway({
      baseUrl: "http://127.0.0.1:9",
      fetchImpl: vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
      probeSocket: vi.fn(async () => ({ opened: false, challenged: false })),
    });
    expect(await down.health()).toMatchObject({ status: "offline", code: "offline", chatReady: false });
  });

  test("a connect.challenge keeps the shell online when HTTP chat is closed", async () => {
    const gateway = new OpenClawGateway({
      baseUrl: "http://127.0.0.1:18789",
      fetchImpl: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
      probeSocket: vi.fn(async () => ({ opened: true, challenged: true })),
    });
    expect(await gateway.health()).toMatchObject({ status: "online", code: "ws_only", chatReady: false });
  });

  test("chat posts to /v1/chat/completions and dangerous text never leaves the shell", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      expect(body.messages[0]?.content).toContain("小邮");
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe("Bearer secret");
      expect(headers["x-openclaw-session-key"]).toBe("easy:claw_1");
      expect(headers["x-openclaw-model"]).toBe("openai/gpt-5");
      return jsonResponse({ choices: [{ message: { content: "三封未读。" } }] });
    });
    const gateway = new OpenClawGateway({
      baseUrl: "http://127.0.0.1:18789",
      token: "secret",
      modelHeader: "openai/gpt-5",
      fetchImpl,
      probeSocket: vi.fn(async () => ({ opened: false, challenged: false })),
    });

    const reply = await gateway.complete({
      claw,
      model: "gpt",
      history: [{ role: "assistant", content: "在。" }],
      message: "今天要回哪些信？",
    });
    expect(reply.text).toBe("三封未读。");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("http://127.0.0.1:18789/v1/chat/completions");

    fetchImpl.mockClear();
    const held = await gateway.complete({
      claw,
      model: "gpt",
      history: [],
      message: "帮我发一封邮件给李四",
    });
    expect(held.approval?.title).toBe("发送邮件");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
