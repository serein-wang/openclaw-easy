import { describe, expect, test } from "vitest";
import type { ClawProfile } from "../src/domain/types.ts";
import { createGateway, MockGateway } from "../src/gateway/index.ts";

const inbox: ClawProfile = {
  id: "claw_inbox",
  name: "小邮",
  duty: "盯未读邮件",
  template: "inbox",
};

const coding: ClawProfile = {
  id: "claw_code",
  name: "跑腿",
  duty: "看仓库",
  template: "coding",
};

describe("MockGateway", () => {
  test("createGateway uses the mock client when no URL is set", () => {
    expect(createGateway({}).mode).toBe("mock");
    expect(createGateway({ OPENCLAW_GATEWAY_URL: "  " }).mode).toBe("mock");
  });

  test("replies in character and does not invent a sent email", async () => {
    const gateway = new MockGateway();
    const health = await gateway.health();
    expect(health).toMatchObject({ status: "online", mode: "mock", code: "mock", chatReady: true });

    const reply = await gateway.complete({
      claw: inbox,
      model: "claude",
      history: [],
      message: "今天有什么邮件？",
    });
    expect(reply.approval).toBeUndefined();
    expect(reply.text).toContain("小邮");
    expect(reply.text).toContain("收件箱");
    expect(reply.text).not.toContain("已经发送");
  });

  test("holds 发送邮件 until the user confirms", async () => {
    const gateway = new MockGateway();
    const held = await gateway.complete({
      claw: inbox,
      model: "claude",
      history: [],
      message: "帮我发一封邮件给财务，说明发票晚两天",
    });
    expect(held.approval?.title).toBe("发送邮件");
    expect(held.approval?.action).toBe("send_email");
    expect(held.text).toContain("还没有发送");

    const denied = await gateway.resolveApproval({
      claw: inbox,
      model: "claude",
      approval: held.approval!,
      decision: "deny",
    });
    expect(denied.text).toContain("取消");
    expect(denied.text).not.toContain("已经发送");

    const approved = await gateway.resolveApproval({
      claw: inbox,
      model: "claude",
      approval: held.approval!,
      decision: "approve",
    });
    expect(approved.text).toContain("没有真正发信");
  });

  test("holds 删除文件 for a coding Claw", async () => {
    const gateway = new MockGateway();
    const held = await gateway.complete({
      claw: coding,
      model: "local",
      history: [],
      message: "帮我删除文件 dist/old.log",
    });
    expect(held.approval?.title).toBe("删除文件");
    expect(held.text).toContain("还没有删除");

    const approved = await gateway.resolveApproval({
      claw: coding,
      model: "local",
      approval: held.approval!,
      decision: "approve",
    });
    expect(approved.text).toContain("没有删除任何文件");
  });
});
