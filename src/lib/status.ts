import type { HealthStatus, HealthView } from "../domain/types.ts";

export function displayStatus(health: HealthView, busy: boolean, pending: number): HealthStatus {
  if (health.status === "offline") return "offline";
  if (health.status === "needs_you" || pending > 0) return "needs_you";
  if (busy || health.status === "busy") return "busy";
  return "online";
}

export const STATUS_LABEL: Record<HealthStatus, string> = {
  online: "在线",
  busy: "在忙",
  needs_you: "需你确认",
  offline: "离线",
};
