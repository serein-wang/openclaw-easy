import { TEMPLATES } from "../domain/catalog.ts";
import type { TemplateId } from "../domain/catalog.ts";
import { cn } from "../lib/utils.ts";
import { Input } from "./ui/input.tsx";

export interface ClawDraft {
  name: string;
  duty: string;
  template: TemplateId | null;
}

export function ClawFields({
  value,
  onChange,
}: {
  value: ClawDraft;
  onChange: (next: ClawDraft) => void;
}) {
  const suggested = TEMPLATES.find((item) => item.id === value.template)?.duty ?? "";
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-[13px] text-[#6e6e73]">名字</span>
        <Input
          value={value.name}
          maxLength={32}
          placeholder="例如：小邮"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-[13px] text-[#6e6e73]">一句职责</span>
        <Input
          value={value.duty}
          maxLength={80}
          placeholder={suggested || "它平时负责什么"}
          onChange={(event) => onChange({ ...value, duty: event.target.value })}
        />
      </label>
      <div>
        <div className="mb-2 text-[13px] text-[#6e6e73]">模板</div>
        <div className="space-y-2">
          {TEMPLATES.map((item) => {
            const selected = value.template === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange({ ...value, template: item.id })}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                  selected ? "border-neutral-900 bg-white" : "border-black/10 bg-white hover:border-black/20",
                )}
              >
                <div className="text-[15px] font-medium text-neutral-900">{item.label}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">{item.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
