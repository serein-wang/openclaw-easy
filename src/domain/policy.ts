import type { ApprovalAction, ChatTurnResult, ClawProfile } from "./types.ts";

const SEND_EMAIL =
  /发(?:一封|封)?邮件|发送邮件|邮件发出去|把信发出|发封信|写封邮件|send\s+(?:an\s+)?e-?mail/i;
const DELETE_FILE =
  /删除文件|删掉文件|删文件|把文件删|delete\s+(?:the\s+)?files?|\brm\s+\S+/i;

export interface RiskHit {
  action: ApprovalAction;
  title: "发送邮件" | "删除文件";
  summary: string;
}

function clip(text: string, max = 72): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

/** Easy-mode gate for side effects. Reading mail or talking about files is not a hit. */
export function classifyRisk(message: string): RiskHit | null {
  const checks: Array<{ action: ApprovalAction; title: RiskHit["title"]; re: RegExp }> = [
    {
      action: "send_email",
      title: "发送邮件",
      re: SEND_EMAIL,
    },
    {
      action: "delete_file",
      title: "删除文件",
      re: DELETE_FILE,
    },
  ];

  let best: { hit: RiskHit; index: number } | null = null;
  for (const check of checks) {
    const match = check.re.exec(message);
    if (!match || (best && match.index >= best.index)) continue;
    const summary =
      check.action === "send_email"
        ? `拟发送的内容来自你的这句话：「${clip(message)}」。确认前不会外发。`
        : `拟删除的目标来自你的这句话：「${clip(message)}」。确认前不会动文件。`;
    best = {
      index: match.index,
      hit: { action: check.action, title: check.title, summary },
    };
  }
  return best?.hit ?? null;
}

export function gateUserMessage(claw: ClawProfile, message: string): ChatTurnResult | null {
  const risk = classifyRisk(message);
  if (!risk) return null;
  const text =
    risk.action === "send_email"
      ? `${claw.name}停在确认前。这封邮件还没有发送。`
      : `${claw.name}停在确认前。文件还没有删除。`;
  return {
    text,
    approval: {
      id: `apr_${crypto.randomUUID()}`,
      action: risk.action,
      title: risk.title,
      summary: risk.summary,
    },
  };
}

export function denialText(action: ApprovalAction): string {
  return action === "send_email" ? "好，已取消，没有发送。" : "好，已取消，没有删除。";
}
