/** Tray labels for the same four Easy health states the shell already shows. */

const LABELS = {
  online: "在线",
  busy: "在忙",
  needs_you: "需你确认",
  offline: "离线",
};

/**
 * @param {{ status?: string, pendingApprovals?: number } | null | undefined} payload
 * @returns {{ status: "online" | "busy" | "needs_you" | "offline", label: string }}
 */
function trayPresentation(payload) {
  const pending = Number(payload?.pendingApprovals) > 0;
  const raw = typeof payload?.status === "string" ? payload.status : "offline";
  let status = "offline";
  if (raw === "offline" || payload == null) status = "offline";
  else if (raw === "needs_you" || pending) status = "needs_you";
  else if (raw === "busy") status = "busy";
  else if (raw === "online") status = "online";
  return { status, label: LABELS[status] };
}

module.exports = { LABELS, trayPresentation };
