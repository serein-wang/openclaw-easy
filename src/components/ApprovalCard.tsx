import type { ApprovalCard as Approval } from "../domain/types.ts";
import { Button } from "./ui/button.tsx";

export function ApprovalCard({
  approval,
  pending,
  onDecide,
}: {
  approval: Approval;
  pending: boolean;
  onDecide: (decision: "approve" | "deny") => void;
}) {
  const confirmLabel = approval.action === "send_email" ? "确认发送" : "确认删除";
  return (
    <div className="mt-3 border-t border-[#e5e5ea] pt-3">
      <div className="text-[12px] text-[#86868b]">需要你确认</div>
      <div className="mt-1 text-[15px] font-semibold text-[#1d1d1f]">{approval.title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6e6e73]">{approval.summary}</p>
      {approval.status === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => onDecide("deny")}>
            拒绝
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onDecide("approve")}>
            {pending ? "处理中" : confirmLabel}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[#6e6e73]">
          {approval.status === "approved" ? "你已确认" : "你已拒绝"}
        </p>
      )}
    </div>
  );
}
