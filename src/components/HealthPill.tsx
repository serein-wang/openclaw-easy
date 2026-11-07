import type { HealthStatus } from "../domain/types.ts";
import { STATUS_LABEL } from "../lib/status.ts";
import { cn } from "../lib/utils.ts";

const DOT: Record<HealthStatus, string> = {
  online: "bg-[#3d6f99]",
  busy: "bg-[#c4a15a] motion-safe:animate-pulse",
  needs_you: "bg-[#c45c4a]",
  offline: "bg-[#c7c7cc]",
};

export function HealthPill({
  status,
  detail,
  mode,
}: {
  status: HealthStatus;
  detail?: string;
  mode?: string;
}) {
  return (
    <span
      title={detail}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[12px] font-medium text-[#1d1d1f]"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} />
      <span className="truncate">
        {STATUS_LABEL[status]}
        {mode ? <span className="font-normal text-[#86868b]"> · {mode}</span> : null}
      </span>
    </span>
  );
}
