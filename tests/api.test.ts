import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { handleApi } from "../server/api.ts";
import type { Snapshot } from "../src/domain/types.ts";

const home = mkdtempSync(join(tmpdir(), "openclaw-easy-"));
const previousHome = process.env.OPENCLAW_EASY_HOME;
const previousUrl = process.env.OPENCLAW_GATEWAY_URL;

beforeAll(() => {
  process.env.OPENCLAW_EASY_HOME = home;
  delete process.env.OPENCLAW_GATEWAY_URL;
});

afterAll(() => {
  if (previousHome === undefined) delete process.env.OPENCLAW_EASY_HOME;
  else process.env.OPENCLAW_EASY_HOME = previousHome;
  if (previousUrl === undefined) delete process.env.OPENCLAW_GATEWAY_URL;
  else process.env.OPENCLAW_GATEWAY_URL = previousUrl;
});

async function invoke(method: string, url: string, body?: unknown): Promise<{ status: number; json: Snapshot & { error?: string } }> {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(payload) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { host: "127.0.0.1" };
  const res = new EventEmitter() as ServerResponse;
  res.statusCode = 200;
  res.setHeader = () => res;
  const done = new Promise<{ status: number; json: Snapshot & { error?: string } }>((resolve) => {
    res.end = ((chunk?: unknown) => {
      const text = typeof chunk === "string" ? chunk : "";
      resolve({ status: res.statusCode, json: text ? JSON.parse(text) : {} });
      return res;
    }) as ServerResponse["end"];
  });
  await handleApi(req, res);
  return done;
}

describe("Easy API with the mock gateway", () => {
  test("onboarding, chat, and an approval card", async () => {
    const fresh = await invoke("GET", "/api/state");
    expect(fresh.status).toBe(200);
    expect(fresh.json.onboarded).toBe(false);
    expect(fresh.json.health.mode).toBe("mock");
    expect(fresh.json.health.sandbox).toBe(true);

    const started = await invoke("POST", "/api/onboarding", {
      model: "grok",
      name: "小邮",
      duty: "盯未读邮件",
      template: "inbox",
    });
    expect(started.status).toBe(200);
    expect(started.json.onboarded).toBe(true);
    expect(started.json.claws[0]?.name).toBe("小邮");
    expect(started.json.messages[0]?.content).toContain("沙箱开着");

    const clawId = started.json.claws[0]?.id ?? "";
    const chat = await invoke("POST", "/api/chat", { clawId, text: "今天有什么邮件？" });
    expect(chat.status).toBe(200);
    const reply = chat.json.messages.at(-1);
    expect(reply?.content).toContain("收件箱");
    expect(reply?.approval).toBeUndefined();

    const held = await invoke("POST", "/api/chat", {
      clawId,
      text: "帮我发一封邮件给同事，说会议改到三点",
    });
    const card = held.json.messages.at(-1);
    expect(card?.approval?.title).toBe("发送邮件");
    expect(card?.approval?.status).toBe("pending");
    expect(held.json.health.pendingApprovals).toBe(1);

    const denied = await invoke("POST", `/api/approvals/${card?.approval?.id}`, { decision: "deny" });
    expect(denied.status).toBe(200);
    expect(denied.json.messages.at(-1)?.content).toContain("没有发送");
    expect(denied.json.health.pendingApprovals).toBe(0);

    const again = await invoke("POST", `/api/approvals/${card?.approval?.id}`, { decision: "approve" });
    expect(again.status).toBe(409);
  });
});
