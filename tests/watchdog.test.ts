import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { clearHealthCache } from "../server/gatewayView.ts";
import { observeWatchdog, resetWatchdogForTests, tripWatchdog, WATCHDOG_AUTO_MS } from "../server/watchdog.ts";
import { invoke } from "./http.ts";

const home = mkdtempSync(join(tmpdir(), "openclaw-easy-watchdog-"));
const previousHome = process.env.OPENCLAW_EASY_HOME;
const previousUrl = process.env.OPENCLAW_GATEWAY_URL;

beforeAll(() => {
  process.env.OPENCLAW_EASY_HOME = home;
  delete process.env.OPENCLAW_GATEWAY_URL;
});

beforeEach(() => {
  resetWatchdogForTests();
  clearHealthCache();
});

afterAll(() => {
  resetWatchdogForTests();
  if (previousHome === undefined) delete process.env.OPENCLAW_EASY_HOME;
  else process.env.OPENCLAW_EASY_HOME = previousHome;
  if (previousUrl === undefined) delete process.env.OPENCLAW_GATEWAY_URL;
  else process.env.OPENCLAW_GATEWAY_URL = previousUrl;
});

describe("watchdog", () => {
  test("a simulated outage asks for 修复 and a click rechecks", async () => {
    const down = await invoke("POST", "/api/watchdog/trip");
    expect(down.json.health.status).toBe("needs_you");
    expect(down.json.health.watchdog.simulatedDown).toBe(true);
    expect(down.json.health.watchdog.repairAvailable).toBe(true);
    expect(down.json.health.detail).toContain("修复");

    const up = await invoke("POST", "/api/watchdog/repair");
    expect(up.json.health.status).toBe("online");
    expect(up.json.health.watchdog.simulatedDown).toBe(false);
    expect(up.json.health.watchdog.repairAvailable).toBe(false);
    expect(up.json.health.mode).toBe("mock");
  });

  test("the skeleton rechecks itself after the auto window", () => {
    tripWatchdog(1_000);
    expect(observeWatchdog(false, 1_000 + 500).simulatedDown).toBe(true);
    const healed = observeWatchdog(false, 1_000 + WATCHDOG_AUTO_MS);
    expect(healed.autoRestarted).toBe(true);
    expect(healed.simulatedDown).toBe(false);
    expect(healed.repairAvailable).toBe(false);
  });
});
