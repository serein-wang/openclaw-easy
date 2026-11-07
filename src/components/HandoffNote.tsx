import type { HandoffMark } from "../domain/types.ts";

export function HandoffNote({ handoff }: { handoff: HandoffMark }) {
  const outgoing = handoff.direction === "out";
  return (
    <div className="mt-3 border-t border-[#e5e5ea] pt-3">
      <div className="text-[12px] text-[#86868b]">
        {outgoing ? `交给 ${handoff.toName}` : `来自 ${handoff.fromName}`}
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-[#1d1d1f]">{handoff.task}</p>
      <p className="mt-2 text-[12px] leading-relaxed whitespace-pre-wrap text-[#6e6e73]">{handoff.contextPreview}</p>
      <p className="mt-2 text-[12px] text-[#86868b]">同一只 Gateway 里直接交办，没有另写转发规则。</p>
    </div>
  );
}
