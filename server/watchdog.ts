import type { WatchdogView } from "../src/domain/types.ts";

/** Demo auto-heal window. A click on 修复 does not wait for this. */
export const WATCHDOG_AUTO_MS = 12_000;

interface WatchdogMemory {
  simulatedDown: boolean;
  downSince: number | null;
  autoRestarted: boolean;
}

let memory: WatchdogMemory = { simulatedDown: false, downSince: null, autoRestarted: false };

export function resetWatchdogForTests(): void {
  memory = { simulatedDown: false, downSince: null, autoRestarted: false };
}

export function tripWatchdog(now = Date.now()): void {
  memory = { simulatedDown: true, downSince: now, autoRestarted: false };
}

export function repairWatchdog(): void {
  memory = { simulatedDown: false, downSince: null, autoRestarted: false };
}

/**
 * Skeleton watchdog. It does not kill or spawn the Vite process.
 * A simulated outage flips health to 需你确认 until 修复 or the auto recheck.
 * A real unreachable gateway stays 离线 and 修复 only probes again.
 */
export function observeWatchdog(realOffline: boolean, now = Date.now()): WatchdogView {
  if (memory.simulatedDown && memory.downSince !== null && now - memory.downSince >= WATCHDOG_AUTO_MS) {
    memory = { simulatedDown: false, downSince: null, autoRestarted: true };
  }
  const simulatedDown = memory.simulatedDown;
  let note = "";
  if (simulatedDown) note = "演示里的 Gateway 进程停了。点修复会重新检查并拉起。";
  else if (memory.autoRestarted) note = "Watchdog 已自动重新检查，演示进程回到在线。";
  else if (realOffline) note = "点修复会再查一次，不会改 OpenClaw 的配置。";
  return {
    repairAvailable: simulatedDown || realOffline,
    simulatedDown,
    autoRestarted: memory.autoRestarted,
    note,
  };
}
