import { denialText, gateUserMessage } from "../domain/policy.ts";
import type { ApprovalDecision, ChatTurnInput, ChatTurnResult, GatewayHealth } from "../domain/types.ts";
import type { GatewayClient } from "./types.ts";

function clip(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

/** In-character demo replies. Nothing here touches a real inbox, calendar, or disk. */
function inCharacter(input: ChatTurnInput): string {
  const name = input.claw.name.trim() || "Claw";
  const duty = input.claw.duty.trim();
  const heard = clip(input.message);

  switch (input.claw.template) {
    case "inbox":
      return [
        `${name}看过这句话了：「${heard}」。`,
        duty ? `我会按「${duty}」来处理收件箱。` : "我会帮你看收件箱、起草回复。",
        "演示收件箱里有 3 封未读：一封要改期，两封是通知。要起草回复可以说收件人；真正发送会先出确认卡。",
      ].join("\n");
    case "calendar":
      return [
        `${name}按日历来接：「${heard}」。`,
        duty ? `职责是${duty}。` : "我会帮你看日程和冲突。",
        "演示日程：明天 10:00 有个同步，下午空着。改期我只起草，不直接改你的日历。",
      ].join("\n");
    case "coding":
      return [
        `${name}接了这件研发上的事：「${heard}」。`,
        duty ? `职责是${duty}。` : "我会帮你看仓库和下一步。",
        "演示里我不会跑会改磁盘的命令。删除文件会先请你确认。",
      ].join("\n");
    case "family":
      return [
        `${name}按家里的安排来听：「${heard}」。`,
        duty ? `职责是${duty}。` : "我会帮你记接送和家事。",
        "演示日程：今天放学由你接，晚饭还没定。要加一件家事，直接说时间。",
      ].join("\n");
    case "blank":
      return [
        `${name}在。你说：「${heard}」。`,
        duty ? `我按这句职责理解：${duty}。` : "你还没写职责，我就先听你交代。",
        "沙箱开着。发送邮件或删除文件时，我会先给你确认卡。",
      ].join("\n");
  }
}

function approvedText(input: ApprovalDecision): string {
  const name = input.claw.name.trim() || "Claw";
  if (input.approval.action === "send_email") {
    return `${name}记下了你的确认。演示网关没有真正发信。连上 OpenClaw 之后，同一步才会交给 Gateway 在它自己的沙箱里执行。`;
  }
  return `${name}记下了你的确认。演示网关没有删除任何文件。`;
}

export class MockGateway implements GatewayClient {
  readonly mode = "mock" as const;

  health(): Promise<GatewayHealth> {
    return Promise.resolve({
      status: "online",
      mode: "mock",
      code: "mock",
      chatReady: true,
    });
  }

  complete(input: ChatTurnInput): Promise<ChatTurnResult> {
    const gated = gateUserMessage(input.claw, input.message);
    if (gated) return Promise.resolve(gated);
    return Promise.resolve({ text: inCharacter(input) });
  }

  resolveApproval(input: ApprovalDecision): Promise<ChatTurnResult> {
    if (input.decision === "deny") {
      return Promise.resolve({ text: denialText(input.approval.action) });
    }
    return Promise.resolve({ text: approvedText(input) });
  }
}
