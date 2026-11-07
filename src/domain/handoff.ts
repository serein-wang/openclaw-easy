import type { ChatMessage, Claw } from "./types.ts";

export interface ResolvedHandoff {
  target: Claw;
  task: string;
  mention: string;
}

/** `@Name` hands work to another Claw. No bridge rules. Unknown names stay ordinary chat. */
export function resolveHandoff(text: string, claws: readonly Claw[], fromId: string): ResolvedHandoff | null {
  const others = claws
    .filter((claw) => claw.id !== fromId && claw.name.trim().length > 0)
    .slice()
    .sort((a, b) => b.name.length - a.name.length || a.id.localeCompare(b.id));
  const pattern = /(^|\s)@([^\s@]+)/g;
  for (const match of text.matchAll(pattern)) {
    const token = match[2] ?? "";
    const target = others.find((claw) => token === claw.name || token.startsWith(claw.name));
    if (!target || match.index === undefined) continue;
    const at = match.index + (match[1]?.length ?? 0);
    const task = `${text.slice(0, at)} ${text.slice(at + 1 + target.name.length)}`.replace(/\s+/g, " ").trim();
    return {
      target,
      task: task || "请按你的职责看一下刚才的对话。",
      mention: `@${target.name}`,
    };
  }
  return null;
}

export function contextPreview(messages: readonly ChatMessage[], clawId: string, limit = 4): string {
  const recent = messages.filter((message) => message.clawId === clawId).slice(-limit);
  if (recent.length === 0) return "（这段对话还没有更早的内容）";
  return recent
    .map((message) => {
      const who = message.role === "user" ? "用户" : "Claw";
      const text = message.content.replace(/\s+/g, " ").trim().slice(0, 80);
      return `${who}：${text}`;
    })
    .join("\n");
}
