import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { resolveHandoff } from "../src/domain/handoff.ts";
import type { Claw } from "../src/domain/types.ts";
import { invoke } from "./http.ts";

const home = mkdtempSync(join(tmpdir(), "openclaw-easy-handoff-"));
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

const claws: Claw[] = [
  { id: "a", name: "小邮", duty: "邮件", template: "inbox", createdAt: "" },
  { id: "b", name: "跑腿", duty: "日程", template: "calendar", createdAt: "" },
  { id: "c", name: "跑腿助手", duty: "", template: "blank", createdAt: "" },
];

describe("resolveHandoff", () => {
  test("matches another Claw and keeps the task", () => {
    const hit = resolveHandoff("@跑腿 明天有什么安排？", claws, "a");
    expect(hit?.target.name).toBe("跑腿");
    expect(hit?.task).toBe("明天有什么安排？");
  });

  test("prefers the longer name and ignores a self mention", () => {
    expect(resolveHandoff("@跑腿助手 看一下", claws, "a")?.target.id).toBe("c");
    expect(resolveHandoff("@小邮 自己做", claws, "a")).toBeNull();
    expect(resolveHandoff("邮箱是 a@b.com", claws, "a")).toBeNull();
  });
});

describe("handoff API", () => {
  test("moves a task with context and still holds delete behind a card", async () => {
    const started = await invoke("POST", "/api/onboarding", {
      model: "claude",
      name: "小邮",
      duty: "盯未读邮件",
      template: "inbox",
    });
    const sourceId = started.json.claws[0]?.id ?? "";
    const created = await invoke("POST", "/api/claws", {
      name: "跑腿",
      duty: "看日程",
      template: "calendar",
    });
    const targetId = created.json.claws.find((claw) => claw.name === "跑腿")?.id ?? "";

    await invoke("POST", "/api/active", { clawId: sourceId });
    await invoke("POST", "/api/chat", { clawId: sourceId, text: "今天有什么邮件？" });

    const handed = await invoke("POST", "/api/chat", {
      clawId: sourceId,
      text: "@跑腿 明天有什么安排？",
    });
    const sourceNote = handed.json.messages.filter((message) => message.clawId === sourceId).at(-1);
    const targetNote = handed.json.messages.filter((message) => message.clawId === targetId).at(-1);
    expect(sourceNote?.handoff?.direction).toBe("out");
    expect(sourceNote?.handoff?.toName).toBe("跑腿");
    expect(sourceNote?.content).toContain("已交给跑腿");
    expect(sourceNote?.handoff?.contextPreview).toContain("今天有什么邮件");
    expect(targetNote?.handoff?.direction).toBe("in");
    expect(targetNote?.handoff?.task).toBe("明天有什么安排？");
    expect(targetNote?.content).toContain("日历");
    expect(targetNote?.approval).toBeUndefined();

    const danger = await invoke("POST", "/api/chat", {
      clawId: sourceId,
      text: "@跑腿 帮我删除文件 dist/old.log",
    });
    const card = danger.json.messages.filter((message) => message.clawId === targetId).at(-1);
    expect(card?.approval?.title).toBe("删除文件");
    expect(card?.approval?.status).toBe("pending");
    expect(card?.content).toContain("还没有删除");
    expect(danger.json.messages.filter((message) => message.clawId === sourceId).at(-1)?.content).toContain("要确认");

    const unknown = await invoke("POST", "/api/chat", { clawId: sourceId, text: "@没有这只 你好" });
    const last = unknown.json.messages.filter((message) => message.clawId === sourceId).at(-1);
    expect(last?.handoff).toBeUndefined();
    expect(last?.content).toContain("收件箱");
  });
});
