import { useState } from "react";
import { CHANNELS } from "../domain/channels.ts";
import type { ChannelId } from "../domain/channels.ts";
import type { ChannelRecord, Snapshot } from "../domain/types.ts";
import { api } from "../lib/api.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./ui/button.tsx";
import { Dialog } from "./ui/dialog.tsx";

export function ConnectDialog({
  open,
  onOpenChange,
  channels,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: ChannelRecord[];
  onChange: (next: Snapshot) => void;
}) {
  const [current, setCurrent] = useState<ChannelId>("telegram");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const channel = CHANNELS.find((item) => item.id === current) ?? CHANNELS[0];
  const record = channels.find((item) => item.id === channel.id);

  async function save(markReady: boolean) {
    setSaving(true);
    setError("");
    try {
      const next = await api<Snapshot>("/api/channels", { id: channel.id, markReady });
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能写下占位");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="连接渠道"
      description="向导只在本机写下 OpenClaw 的配置形状。不会登录 Telegram、WhatsApp 或 Slack，也不会把令牌放进聊天。"
    >
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrent(item.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px]",
              item.id === channel.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-black/10 bg-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-[#3a3a3c]">{channel.summary}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-[#6e6e73]">
        {channel.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#f5f5f7] p-3 text-[12px] leading-relaxed">{channel.command}</pre>
      <p className="mt-3 text-[12px] text-[#86868b]">
        {record?.status === "placeholder" ? "本机已有占位文件 channels.json。" : "还没有写下占位。"}
        {record?.markedReady ? " 你标记过：Gateway 侧已配置。" : ""}
      </p>
      <a className="mt-2 inline-block text-[12px] text-[#0066cc]" href={channel.docs} target="_blank" rel="noreferrer">
        OpenClaw 文档
      </a>
      {error && <p className="mt-3 text-[13px] text-[#9a3412]">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={() => void save(true)}>
          标记已在 Gateway 配好
        </Button>
        <Button disabled={saving} onClick={() => void save(false)}>
          {saving ? "正在写" : "保存占位"}
        </Button>
      </div>
    </Dialog>
  );
}
