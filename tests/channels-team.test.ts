import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { invoke } from "./http.ts";

const home = mkdtempSync(join(tmpdir(), "openclaw-easy-channels-"));
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

describe("channel placeholders and team presence", () => {
  test("writes OpenClaw-shaped placeholders without keeping a pasted token", async () => {
    await invoke("POST", "/api/onboarding", {
      model: "local",
      name: "小邮",
      duty: "盯邮件",
      template: "inbox",
    });

    const saved = await invoke("POST", "/api/channels", {
      id: "telegram",
      botToken: "123:SUPERSECRET",
    });
    expect(JSON.stringify(saved.json)).not.toContain("SUPERSECRET");
    expect(saved.json.channels.find((item) => item.id === "telegram")?.status).toBe("placeholder");

    const slack = await invoke("POST", "/api/channels", { id: "slack", markReady: true });
    await invoke("POST", "/api/channels", { id: "whatsapp" });
    const file = JSON.parse(readFileSync(join(home, "channels.json"), "utf8")) as {
      channels: {
        telegram: { dmPolicy: string; botToken: string };
        whatsapp: { dmPolicy: string };
        slack: { mode: string; appToken: { id: string }; botToken: { id: string } };
      };
    };
    expect(JSON.stringify(file)).not.toContain("SUPERSECRET");
    expect(file.channels.telegram.dmPolicy).toBe("pairing");
    expect(file.channels.telegram.botToken).toContain("openclaw channels add");
    expect(file.channels.whatsapp.dmPolicy).toBe("pairing");
    expect(file.channels.slack.mode).toBe("socket");
    expect(file.channels.slack.appToken.id).toBe("SLACK_APP_TOKEN");
    expect(file.channels.slack.botToken.id).toBe("SLACK_BOT_TOKEN");
    expect(slack.json.channels.find((item) => item.id === "slack")?.markedReady).toBe(true);
  });

  test("invite code admits a guest and a mock presence shows up", async () => {
    const state = await invoke("GET", "/api/state");
    const code = state.json.team.inviteCode;
    expect(state.json.team.members.some((member) => member.role === "owner")).toBe(true);

    const wrong = await invoke("POST", "/api/team/join", { code: "nope", name: "李四" });
    expect(wrong.status).toBe(403);

    const joined = await invoke("POST", "/api/team/join", { code, name: "李四" });
    expect(joined.status).toBe(200);
    expect(joined.json.joinedMemberId).toBeTruthy();
    expect(joined.json.team.members.some((member) => member.name === "李四" && member.role === "guest")).toBe(true);

    const guest = await invoke("POST", "/api/team/mock-guest");
    expect(guest.json.team.members.some((member) => member.name === "同事")).toBe(true);

    const clawId = state.json.activeClawId ?? "";
    const pulsed = await invoke("POST", "/api/team/pulse", { memberId: joined.json.joinedMemberId, clawId });
    const member = pulsed.json.team.members.find((item) => item.id === joined.json.joinedMemberId);
    expect(member?.viewingClawId).toBe(clawId);
  });
});
