import { ArrowUp, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MODELS, SUGGESTIONS, templateById } from "../domain/catalog.ts";
import type { ModelId } from "../domain/catalog.ts";
import type { Claw, HealthView, Snapshot } from "../domain/types.ts";
import { api } from "../lib/api.ts";
import { presenceLine } from "../lib/presence.ts";
import { displayStatus } from "../lib/status.ts";
import { cn } from "../lib/utils.ts";
import { ApprovalCard } from "./ApprovalCard.tsx";
import { ClawFields, type ClawDraft } from "./ClawFields.tsx";
import { ConnectDialog } from "./ConnectDialog.tsx";
import { HandoffNote } from "./HandoffNote.tsx";
import { HealthPill } from "./HealthPill.tsx";
import { TeamDialog } from "./TeamDialog.tsx";
import { Button } from "./ui/button.tsx";
import { Dialog } from "./ui/dialog.tsx";
import { Textarea } from "./ui/textarea.tsx";

export function ChatApp({
  snapshot,
  onChange,
}: {
  snapshot: Snapshot;
  onChange: (next: Snapshot) => void;
}) {
  const [health, setHealth] = useState(snapshot.health);
  const [healthSource, setHealthSource] = useState(snapshot.health);
  const [activeId, setActiveId] = useState(snapshot.activeClawId ?? snapshot.claws[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [clawDraft, setClawDraft] = useState<ClawDraft>({ name: "", duty: "", template: null });
  const [expertOpen, setExpertOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    return invite !== null && invite === snapshot.team.inviteCode && !sessionStorage.getItem("openclaw-easy-member");
  });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const active = snapshot.claws.find((claw) => claw.id === activeId) ?? snapshot.claws[0];
  const messages = useMemo(
    () => snapshot.messages.filter((message) => message.clawId === active?.id),
    [snapshot.messages, active?.id],
  );
  const pending = snapshot.messages.filter((message) => message.approval?.status === "pending").length;

  useEffect(() => {
    const timer = setInterval(() => {
      void api<HealthView>("/api/health")
        .then(setHealth)
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy, pendingId]);

  useEffect(() => {
    const owner = snapshot.team.members.find((member) => member.role === "owner");
    const saved = sessionStorage.getItem("openclaw-easy-member");
    const known = saved && snapshot.team.members.some((member) => member.id === saved) ? saved : owner?.id;
    if (!known || !active) return;
    if (!saved) sessionStorage.setItem("openclaw-easy-member", known);
    void api("/api/team/pulse", { memberId: known, clawId: active.id }).catch(() => undefined);
  }, [active, snapshot.team.members]);

  if (healthSource !== snapshot.health) {
    setHealthSource(snapshot.health);
    setHealth(snapshot.health);
  }
  const shownHealth = healthSource === snapshot.health ? health : snapshot.health;
  const status = displayStatus(shownHealth, busy, pending);

  async function selectClaw(claw: Claw) {
    setActiveId(claw.id);
    setError("");
    try {
      const next = await api<Snapshot>("/api/active", { clawId: claw.id });
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能切换 Claw");
    }
  }

  async function send(text = draft) {
    const content = text.trim();
    if (!content || !active || busy) return;
    setBusy(true);
    setError("");
    setDraft("");
    setPendingText(content);
    try {
      const next = await api<Snapshot>("/api/chat", { clawId: active.id, text: content });
      onChange(next);
    } catch (err) {
      setDraft(content);
      setError(err instanceof Error ? err.message : "没发出去");
    } finally {
      setPendingText(null);
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approve" | "deny") {
    setPendingId(id);
    setError("");
    try {
      const next = await api<Snapshot>(`/api/approvals/${encodeURIComponent(id)}`, { decision });
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能处理确认卡");
    } finally {
      setPendingId(null);
    }
  }

  async function createClaw() {
    if (!clawDraft.template || clawDraft.name.trim().length === 0) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<Snapshot>("/api/claws", {
        name: clawDraft.name,
        duty: clawDraft.duty,
        template: clawDraft.template,
      });
      onChange(next);
      setActiveId(next.activeClawId ?? "");
      setCreating(false);
      setClawDraft({ name: "", duty: "", template: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能新建 Claw");
    } finally {
      setBusy(false);
    }
  }

  async function changeModel(model: ModelId) {
    try {
      const next = await api<Snapshot>("/api/model", { model });
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能记下模型偏好");
    }
  }

  async function repair() {
    setError("");
    try {
      onChange(await api<Snapshot>("/api/watchdog/repair", {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能重新检查");
    }
  }

  async function trip() {
    setError("");
    try {
      onChange(await api<Snapshot>("/api/watchdog/trip", {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能模拟中断");
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const next = await api<Snapshot>("/api/reset", {});
      onChange(next);
      setResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能清除");
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-[15px] text-[#6e6e73]">还没有 Claw。</p>
          <Button className="mt-4" onClick={() => setResetOpen(true)}>
            重新开始向导
          </Button>
        </div>
      </main>
    );
  }

  const template = templateById(active.template);
  const suggestions = messages.length <= 1 ? SUGGESTIONS[active.template] : [];

  return (
    <div className="flex h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#e5e5ea] bg-white md:flex">
        <div className="px-4 pt-6">
          <div className="text-[13px] text-[#86868b]">OpenClaw Easy</div>
          <div className="mt-4 flex items-center gap-2">
            <HealthPill
              status={status}
              detail={shownHealth.detail}
              mode={shownHealth.mode === "mock" ? "演示" : "OpenClaw"}
            />
            {shownHealth.watchdog.repairAvailable && (
              <button type="button" className="text-[13px] text-[#3d6f99]" onClick={() => void repair()}>
                修复
              </button>
            )}
          </div>
          <p className="mt-2 truncate text-[12px] text-[#86868b]" title={shownHealth.detail}>
            {shownHealth.detail}
          </p>
        </div>
        <div className="mt-8 px-4 pb-2 text-[12px] text-[#86868b]">Claws</div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
          {snapshot.claws.map((claw) => (
            <button
              key={claw.id}
              type="button"
              onClick={() => void selectClaw(claw)}
              className={cn(
                "w-full rounded-xl px-2 py-2 text-left",
                claw.id === active.id ? "bg-[#f5f5f7]" : "hover:bg-[#f5f5f7]",
              )}
            >
              <div className="truncate text-[14px] font-medium">{claw.name}</div>
              <div className="mt-0.5 truncate text-[12px] text-[#86868b]">
                {templateById(claw.template).label}
                {claw.duty ? ` · ${claw.duty}` : ""}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-1 rounded-xl px-2 py-2 text-left text-[13px] text-[#3d6f99] hover:bg-[#f5f5f7]"
          >
            <Plus className="size-3.5" />
            新建 Claw
          </button>
        </div>
        <div className="space-y-4 border-t border-[#e5e5ea] px-4 py-4">
          <label className="block text-[12px] text-[#86868b]">
            模型偏好
            <select
              className="mt-1 h-8 w-full bg-transparent text-[13px] text-[#1d1d1f] outline-none"
              value={snapshot.model ?? "local"}
              onChange={(event) => void changeModel(event.target.value as ModelId)}
            >
              {MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-4 text-[13px]">
            <button type="button" className="text-[#3d6f99]" onClick={() => setConnectOpen(true)}>
              连接
            </button>
            <button type="button" className="text-[#3d6f99]" onClick={() => setTeamOpen(true)}>
              邀请
            </button>
            <div className="relative">
              <button type="button" className="text-[#86868b]" onClick={() => setMoreOpen((open) => !open)}>
                更多
              </button>
              {moreOpen && (
                <div className="absolute bottom-7 left-0 z-20 w-36 rounded-xl bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08),0_0_0_1px_#e5e5ea]">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    onClick={() => {
                      setMoreOpen(false);
                      setExpertOpen(true);
                    }}
                  >
                    Expert
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
                    disabled={shownHealth.watchdog.simulatedDown}
                    onClick={() => {
                      setMoreOpen(false);
                      void trip();
                    }}
                  >
                    模拟中断
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    onClick={() => {
                      setMoreOpen(false);
                      setResetOpen(true);
                    }}
                  >
                    重新开始
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-[12px] leading-5 text-[#86868b]">沙箱开着 · 外发和删除需要确认</p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[#e5e5ea] bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <select
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium"
            value={active.id}
            onChange={(event) => {
              const claw = snapshot.claws.find((item) => item.id === event.target.value);
              if (claw) void selectClaw(claw);
            }}
          >
            {snapshot.claws.map((claw) => (
              <option key={claw.id} value={claw.id}>
                {claw.name}
              </option>
            ))}
          </select>
          <HealthPill
            status={status}
            detail={shownHealth.detail}
            mode={shownHealth.mode === "mock" ? "演示" : "OpenClaw"}
          />
          {shownHealth.watchdog.repairAvailable && (
            <Button size="sm" onClick={() => void repair()}>
              修复
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDeviceOpen(true)}>
            本机
          </Button>
          <Button size="icon" variant="outline" aria-label="新建 Claw" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
          </Button>
        </header>

        <header className="border-b border-[#e5e5ea] px-6 py-5 md:px-10">
          <h1 className="text-[20px] font-semibold tracking-tight">{active.name}</h1>
          <p className="mt-1 text-[13px] text-[#6e6e73]">
            {template.label}
            {active.duty ? ` · ${active.duty}` : ""}
          </p>
          <p className="mt-1 truncate text-[12px] text-[#86868b]">
            {presenceLine(snapshot.team, snapshot.claws).join("   ")}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.length === 0 && (
              <p className="text-[15px] text-[#6e6e73]">还没有对话。写一句职责范围内的事。</p>
            )}
            {messages.map((message) => {
              const mine = message.role === "user";
              return (
                <div key={message.id} className={cn("flex max-w-[78%] flex-col gap-1", mine ? "ml-auto items-end" : "mr-auto items-start")}>
                  {message.via === "openclaw" && (
                    <p className="px-1 text-[11px] text-[#86868b]">OpenClaw</p>
                  )}
                  {message.via === "mock-fallback" && (
                    <p className="rounded-full bg-[#f3eee6] px-2.5 py-0.5 text-[11px] text-[#8a6a3b]">
                      演示顶上 · Gateway 未连通
                    </p>
                  )}
                  <article
                    className={cn(
                      "rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words",
                      mine ? "bg-[#1d1d1f] text-white" : "bg-white text-[#1d1d1f]",
                    )}
                  >
                    {message.content}
                    {message.handoff && <HandoffNote handoff={message.handoff} />}
                    {message.approval && (
                      <ApprovalCard
                        approval={message.approval}
                        pending={pendingId === message.approval.id}
                        onDecide={(decision) => void decide(message.approval?.id ?? "", decision)}
                      />
                    )}
                  </article>
                </div>
              );
            })}
            {pendingText && (
              <article className="ml-auto max-w-[78%] rounded-[20px] bg-[#1d1d1f] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white">
                {pendingText}
              </article>
            )}
            {busy && <p className="text-[13px] text-[#86868b]">在写回复…</p>}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-10">
          <div className="mx-auto max-w-2xl">
            {suggestions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(suggestion)}
                    className="rounded-full bg-white px-3 py-1.5 text-left text-[13px] text-[#1d1d1f] shadow-[0_0_0_1px_#e5e5ea] disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {snapshot.claws.filter((claw) => claw.id !== active.id).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {snapshot.claws
                  .filter((claw) => claw.id !== active.id)
                  .map((claw) => (
                    <button
                      key={claw.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void send(draft.trim() ? `@${claw.name} ${draft.trim()}` : `@${claw.name}`)}
                      className="rounded-full px-3 py-1.5 text-[13px] text-[#3d6f99] disabled:opacity-40"
                    >
                      交给 {claw.name}
                    </button>
                  ))}
              </div>
            )}
            {error && <p className="mb-2 text-[13px] text-[#9a3412]">{error}</p>}
            <p className="mb-2 text-[12px] text-[#86868b]">沙箱开着 · 发送邮件和删除文件需要确认 · 输入 @名字 可交办</p>
            <div className="flex items-end rounded-[22px] bg-white py-1 pr-1 pl-2 shadow-[0_0_0_1px_#e5e5ea]">
              <Textarea
                value={draft}
                rows={2}
                placeholder={`交代${active.name}一件事`}
                className="border-0 bg-transparent shadow-none focus-visible:border-transparent"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                size="icon"
                className="mb-1 size-8 shrink-0"
                aria-label="发送"
                disabled={busy || draft.trim().length === 0}
                onClick={() => void send()}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </footer>
      </section>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="新建 Claw"
        description="名字、一句职责、一个模板。模型沿用向导里的偏好。"
      >
        <ClawFields value={clawDraft} onChange={setClawDraft} />
        <div className="mt-5 flex justify-end">
          <Button
            disabled={busy || clawDraft.name.trim().length === 0 || !clawDraft.template}
            onClick={() => void createClaw()}
          >
            创建并开始聊
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deviceOpen}
        onOpenChange={setDeviceOpen}
        title="这台电脑"
        description={shownHealth.detail}
      >
        <p className="text-[13px] text-[#6e6e73]">数据在 {shownHealth.dataDir}</p>
        <label className="mt-4 block text-[12px] text-[#6e6e73]">
          模型偏好
          <select
            className="mt-1 h-10 w-full rounded-xl border border-[#e5e5ea] bg-white px-2 text-[14px]"
            value={snapshot.model ?? "local"}
            onChange={(event) => void changeModel(event.target.value as ModelId)}
          >
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDeviceOpen(false);
              setConnectOpen(true);
            }}
          >
            连接
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDeviceOpen(false);
              setTeamOpen(true);
            }}
          >
            邀请
          </Button>
          <Button variant="outline" disabled={shownHealth.watchdog.simulatedDown} onClick={() => void trip()}>
            模拟中断
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDeviceOpen(false);
              setExpertOpen(true);
            }}
          >
            Expert
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDeviceOpen(false);
              setResetOpen(true);
            }}
          >
            重新开始
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={expertOpen}
        onOpenChange={setExpertOpen}
        title="终端里的同等入口"
        description="Easy 不改 OpenClaw 的配置，也不把 YAML 放进主路径。"
      >
        <div className="space-y-3 text-[14px] leading-relaxed text-[#3a3a3c]">
          <p>若本机装了 OpenClaw CLI，可以在终端查看同一台 Gateway：</p>
          <pre className="overflow-x-auto rounded-2xl bg-[#f5f5f7] p-3 text-[13px] leading-relaxed">
            {`openclaw gateway status\nopenclaw health`}
          </pre>
          <p>默认端口是 18789。Easy 只调用它的 HTTP 聊天接口。</p>
        </div>
      </Dialog>

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} channels={snapshot.channels} onChange={onChange} />
      <TeamDialog open={teamOpen} onOpenChange={setTeamOpen} snapshot={snapshot} onChange={onChange} />

      <Dialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="清除本机向导"
        description="只删除 Easy 记在这台电脑上的 Claw 和聊天。不会动 OpenClaw 自己的数据。"
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setResetOpen(false)}>
            留下
          </Button>
          <Button disabled={busy} onClick={() => void reset()}>
            清除并重来
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
