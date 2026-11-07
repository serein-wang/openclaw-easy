import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { trayPresentation } = require("../desktop/health.cjs") as {
  trayPresentation: (payload: { status?: string; pendingApprovals?: number } | null) => {
    status: string;
    label: string;
  };
};
const { iconFor } = require("../desktop/icon.cjs") as {
  iconFor: (status: string) => Buffer;
};

describe("desktop tray", () => {
  test("maps gateway health onto the four Easy labels", () => {
    expect(trayPresentation(null)).toEqual({ status: "offline", label: "离线" });
    expect(trayPresentation({ status: "online", pendingApprovals: 0 })).toEqual({
      status: "online",
      label: "在线",
    });
    expect(trayPresentation({ status: "busy", pendingApprovals: 0 }).label).toBe("在忙");
    expect(trayPresentation({ status: "online", pendingApprovals: 1 }).label).toBe("需你确认");
    expect(trayPresentation({ status: "needs_you", pendingApprovals: 0 }).label).toBe("需你确认");
    expect(trayPresentation({ status: "offline", pendingApprovals: 3 }).label).toBe("离线");
    expect(trayPresentation({ status: "nope" }).label).toBe("离线");
  });

  test("status icons are 16px pngs", () => {
    for (const status of ["online", "busy", "needs_you", "offline"]) {
      const png = iconFor(status);
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(16);
      expect(png.readUInt32BE(20)).toBe(16);
    }
  });
});

describe("windows one-click launchers", () => {
  test("ps1 and cmd install when needed, start dev, and open the Easy URL", () => {
    const ps1 = readFileSync(new URL("../scripts/dev.ps1", import.meta.url), "utf8");
    const cmd = readFileSync(new URL("../scripts/dev.cmd", import.meta.url), "utf8");
    for (const text of [ps1, cmd]) {
      expect(text).toContain("npm install");
      expect(text).toContain("npm run dev");
      expect(text).toContain("http://127.0.0.1:4721");
      expect(text).toContain("/api/health");
    }
  });
});
