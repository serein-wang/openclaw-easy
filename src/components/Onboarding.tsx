import { useEffect, useState } from "react";
import { MODELS } from "../domain/catalog.ts";
import type { ModelId } from "../domain/catalog.ts";
import type { HealthView, Snapshot } from "../domain/types.ts";
import { api } from "../lib/api.ts";
import { cn } from "../lib/utils.ts";
import { ClawFields, type ClawDraft } from "./ClawFields.tsx";
import { HealthPill } from "./HealthPill.tsx";
import { Button } from "./ui/button.tsx";

const STEPS = ["本机", "模型", "第一只 Claw"] as const;

export function Onboarding({
  snapshot,
  onDone,
}: {
  snapshot: Snapshot;
  onDone: (next: Snapshot) => void;
}) {
  const [step, setStep] = useState(0);
  const [health, setHealth] = useState<HealthView>(snapshot.health);
  const [model, setModel] = useState<ModelId | null>(snapshot.model);
  const [draft, setDraft] = useState<ClawDraft>({ name: "", duty: "", template: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      void api<HealthView>("/api/health")
        .then(setHealth)
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  async function finish() {
    if (!model || !draft.template || draft.name.trim().length === 0) {
      setError("名字和模板都要有。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = await api<Snapshot>("/api/onboarding", {
        model,
        name: draft.name,
        duty: draft.duty,
        template: draft.template,
      });
      onDone(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没能完成向导");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f5f5f7] px-5 py-10 text-neutral-900 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="text-[13px] font-medium tracking-wide text-[#6e6e73]">OpenClaw Easy</div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] text-[#6e6e73]">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-3">
              <span className={cn(index === step && "font-medium text-neutral-900")}>
                {index + 1} {label}
              </span>
              {index < STEPS.length - 1 && <span className="h-px w-6 bg-black/15" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="mt-8">
            <h1 className="text-[34px] leading-tight font-semibold tracking-tight">本机已经就绪</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#6e6e73]">
              Easy Shell 在这台电脑上打开了。Gateway 负责真正应答。没配置 OpenClaw 地址时，用内置演示把聊天先走通。全程不用终端。
            </p>
            <div className="mt-8 rounded-2xl border border-[#e5e5ea] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] text-[#6e6e73]">Gateway</div>
                  <div className="mt-1 text-[15px] font-medium">
                    {health.mode === "mock" ? "演示网关" : "OpenClaw"}
                  </div>
                </div>
                <HealthPill status={health.status} detail={health.detail} />
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-[#6e6e73]">{health.detail}</p>
              <dl className="mt-5 space-y-3 border-t border-[#e5e5ea] pt-4 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6e6e73]">沙箱</dt>
                  <dd>默认开</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6e6e73]">外发 / 删除</dt>
                  <dd>先出确认卡</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6e6e73]">数据</dt>
                  <dd className="truncate" title={health.dataDir}>
                    {health.dataDir}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-8 flex justify-end">
              <Button size="lg" onClick={() => setStep(1)}>
                继续
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="mt-8">
            <h1 className="text-[34px] leading-tight font-semibold tracking-tight">选一个模型偏好</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#6e6e73]">
              这只记在本机。密钥留在 Gateway 里，不会写进聊天。未连接时，演示回复不调用这些模型。真正用哪个模型，由 OpenClaw 上的 agent 决定。
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODELS.map((item) => {
                const selected = model === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModel(item.id)}
                    className={cn(
                      "rounded-2xl border bg-white px-4 py-4 text-left",
                      selected ? "border-[#3d6f99]" : "border-[#e5e5ea] hover:border-[#d2d2d7]",
                    )}
                  >
                    <div className="text-[16px] font-medium">{item.label}</div>
                    <div className="mt-1 text-[12px] text-[#86868b]">{item.vendor}</div>
                    <div className="mt-3 text-[13px] leading-relaxed text-[#6e6e73]">{item.blurb}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(0)}>
                上一步
              </Button>
              <Button size="lg" disabled={!model} onClick={() => setStep(2)}>
                继续
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mt-8">
            <h1 className="text-[34px] leading-tight font-semibold tracking-tight">起第一只 Claw</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#6e6e73]">
              给它名字和一句职责。模板决定它怎么说话。权限是可执行，但发送邮件和删除文件会先问你。
            </p>
            <div className="mt-8">
              <ClawFields value={draft} onChange={setDraft} />
            </div>
            {error && <p className="mt-4 text-[14px] text-[#9a3412]">{error}</p>}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" disabled={saving} onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button
                size="lg"
                disabled={saving || draft.name.trim().length === 0 || !draft.template}
                onClick={() => void finish()}
              >
                {saving ? "正在进入" : "开始聊天"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
