const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { trayPresentation } = require("./health.cjs");
const { iconFor } = require("./icon.cjs");

if (process.platform === "win32") app.setAppUserModelId("ai.openclaw.easy");

const PORT = 4721;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, "..");

/** @type {import("electron").BrowserWindow | null} */
let windowRef = null;
/** @type {import("electron").Tray | null} */
let tray = null;
/** @type {import("node:child_process").ChildProcess | null} */
let serverChild = null;
let ownsServer = false;
let externalServer = false;
let quitting = false;
/** @type {{ status?: string, pendingApprovals?: number } | null} */
let healthPayload = null;
/** @type {NodeJS.Timeout | null} */
let pollTimer = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());
  app.whenReady().then(() => {
    void boot();
  });
}

app.on("window-all-closed", () => {
  // Stay in the tray until 退出.
});

app.on("before-quit", (event) => {
  if (quitting || !ownsServer || !serverChild?.pid) return;
  event.preventDefault();
  quitting = true;
  void stopOwnedServer().finally(() => app.quit());
});

async function boot() {
  createWindow();
  createTray();
  const alreadyUp = await probeHealth();
  if (alreadyUp) {
    externalServer = true;
    healthPayload = alreadyUp;
    await loadEasy();
  } else {
    startServer();
    const ready = await waitForHealth(30_000);
    if (ready) await loadEasy();
    else showMessage("本机服务没有在 30 秒内起来。看终端里的 npm run dev 输出。");
  }
  rebuildTray();
  pollTimer = setInterval(() => {
    void refreshHealth();
  }, 4000);
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 720,
    minHeight: 520,
    title: "OpenClaw Easy",
    backgroundColor: "#f5f5f7",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windowRef.once("ready-to-show", () => windowRef?.show());
  windowRef.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    windowRef?.hide();
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromBuffer(iconFor("offline")));
  tray.setToolTip("OpenClaw Easy · 离线");
  tray.on("click", () => showWindow());
  tray.on("double-click", () => showWindow());
  rebuildTray();
}

function showWindow() {
  if (!windowRef) createWindow();
  windowRef?.show();
  windowRef?.focus();
}

async function loadEasy() {
  await windowRef?.loadURL(ORIGIN);
}

function showMessage(text) {
  const html = `<!doctype html><meta charset="utf-8"><title>OpenClaw Easy</title>
    <body style="margin:0;display:grid;place-items:center;height:100vh;background:#f5f5f7;color:#1d1d1f;font-family:sans-serif">
      <p style="max-width:28rem;line-height:1.6;padding:1.5rem">${escapeHtml(text)}</p>
    </body>`;
  void windowRef?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function startServer() {
  if (serverChild || externalServer) return;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    serverChild = spawn(npm, ["run", "dev"], {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      shell: process.platform === "win32",
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    serverChild = null;
    ownsServer = false;
    const message = error instanceof Error ? error.message : "没能启动 npm run dev";
    showMessage(message);
    return;
  }
  ownsServer = true;
  const child = serverChild;
  const note = (chunk) => {
    const text = chunk.toString();
    if (text.includes("already in use") || text.includes("EADDRINUSE")) {
      externalServer = true;
      ownsServer = false;
    }
  };
  child.stdout?.on("data", note);
  child.stderr?.on("data", note);
  child.on("exit", () => {
    if (serverChild === child) serverChild = null;
    if (!externalServer) ownsServer = false;
    rebuildTray();
  });
}

async function stopOwnedServer() {
  const pid = serverChild?.pid;
  const owned = ownsServer;
  ownsServer = false;
  serverChild = null;
  if (owned && pid) await killTree(pid);
  if (!externalServer) healthPayload = null;
  rebuildTray();
}

function killTree(pid) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
      return;
    }
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        resolve();
        return;
      }
    }
    setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // The dev server is already gone.
      }
      resolve();
    }, 800);
  });
}

function probeHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${ORIGIN}/api/health`, { timeout: 800 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function waitForHealth(limitMs) {
  const started = Date.now();
  while (Date.now() - started < limitMs) {
    const health = await probeHealth();
    if (health) {
      healthPayload = health;
      return health;
    }
    await delay(400);
  }
  return null;
}

async function refreshHealth() {
  const health = await probeHealth();
  healthPayload = health;
  if (!health && externalServer) externalServer = false;
  rebuildTray();
}

function rebuildTray() {
  if (!tray) return;
  const view = trayPresentation(healthPayload);
  const running = Boolean(healthPayload) || Boolean(serverChild) || externalServer;
  tray.setImage(nativeImage.createFromBuffer(iconFor(view.status)));
  tray.setToolTip(`OpenClaw Easy · ${view.label}`);
  const startEnabled = !running;
  const stopEnabled = ownsServer && Boolean(serverChild);
  const template = [
    { label: "打开 Easy", click: () => showWindow() },
    { label: `状态：${view.label}`, enabled: false },
    { type: "separator" },
    {
      label: externalServer ? "服务已在外部运行" : "启动服务",
      enabled: startEnabled && !externalServer,
      click: () => {
        startServer();
        void waitForHealth(30_000).then((ready) => {
          if (ready) void loadEasy();
          rebuildTray();
        });
      },
    },
    {
      label: "停止服务",
      enabled: stopEnabled,
      click: () => {
        void stopOwnedServer();
      },
    },
    {
      label: "在浏览器中打开",
      enabled: Boolean(healthPayload),
      click: () => {
        void shell.openExternal(ORIGIN);
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        quitting = true;
        void stopOwnedServer().finally(() => app.quit());
      },
    },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.on("will-quit", () => {
  if (pollTimer) clearInterval(pollTimer);
});
