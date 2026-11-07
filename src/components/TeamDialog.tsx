import { useState } from "react";
import type { Snapshot } from "../domain/types.ts";
import { api } from "../lib/api.ts";
import { presenceLine } from "../lib/presence.ts";
import { Button } from "./ui/button.tsx";
import { Dialog } from "./ui/dialog.tsx";
import { Input } from "./ui/input.tsx";

export function TeamDialog({
  open,
  onOpenChange,
  snapshot,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: Snapshot;
  onChange: (next: Snapshot) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname}?invite=${snapshot.team.inviteCode}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("没能复制，可以手动选中链接。");
    }
  }

  async function addGuest() {
    setError("");
    try {
      const next = await api<Snapshot>("/api/team/mock-guest", {});
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能加入");
    }
  }

  async function join() {
    setError("");
    try {
      const next = await api<Snapshot & { joinedMemberId: string }>("/api/team/join", {
        code: snapshot.team.inviteCode,
        name,
      });
      sessionStorage.setItem("openclaw-easy-member", next.joinedMemberId);
      onChange(next);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能加入");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="邀请到这只 Gateway"
      description="这是本机的在场演示，不是 OpenClaw 的多人网关。邀请码只在这台电脑的 Easy 状态里。"
    >
      <p className="text-[12px] text-[#6e6e73]">邀请链接</p>
      <p className="mt-1 break-all text-[13px] text-neutral-900">{link}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void copyLink()}>
          {copied ? "已复制" : "复制链接"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void addGuest()}>
          模拟有人加入
        </Button>
      </div>
      <div className="mt-5">
        <div className="text-[12px] text-[#6e6e73]">在看</div>
        <ul className="mt-2 space-y-1 text-[14px]">
          {snapshot.team.members.map((member) => (
            <li key={member.id}>{presenceLine({ ...snapshot.team, members: [member] }, snapshot.claws)[0]}</li>
          ))}
        </ul>
      </div>
      <label className="mt-5 block text-[12px] text-[#6e6e73]">
        用这个邀请码加入
        <Input className="mt-1" value={name} placeholder="你的名字" onChange={(event) => setName(event.target.value)} />
      </label>
      {error && <p className="mt-2 text-[13px] text-[#9a3412]">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button disabled={name.trim().length === 0} onClick={() => void join()}>
          加入
        </Button>
      </div>
    </Dialog>
  );
}
