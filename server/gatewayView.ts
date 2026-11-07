import type { GatewayHealth, HealthView } from "../src/domain/types.ts";
import { createGateway, GatewayRequestError, GatewayUnreachableError } from "../src/gateway/index.ts";
import type { GatewayClient } from "../src/gateway/types.ts";
import { MockGateway } from "../src/gateway/mock.ts";
import { displayDataDir } from "./store.ts";
import { observeWatchdog } from "./watchdog.ts";

let healthCache: { at: number; key: string; value: GatewayHealth } | null = null;

export function clearHealthCache(): void {
  healthCache = null;
}

export function currentGateway(): GatewayClient {
  return createGateway({
    OPENCLAW_GATEWAY_URL: process.env.OPENCLAW_GATEWAY_URL,
    OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN,
    OPENCLAW_GATEWAY_PASSWORD: process.env.OPENCLAW_GATEWAY_PASSWORD,
    OPENCLAW_MODEL: process.env.OPENCLAW_MODEL,
  });
}

export async function readGatewayHealth(): Promise<GatewayHealth> {
  const key = [
    process.env.OPENCLAW_GATEWAY_URL ?? "",
    process.env.OPENCLAW_GATEWAY_TOKEN ? "token" : "",
    process.env.OPENCLAW_GATEWAY_PASSWORD ? "password" : "",
    process.env.OPENCLAW_MODEL ?? "",
  ].join("|");
  const now = Date.now();
  if (healthCache && healthCache.key === key && now - healthCache.at < 3000) {
    return healthCache.value;
  }
  const value = await currentGateway().health();
  healthCache = { at: now, key, value };
  return value;
}

export function toHealthView(health: GatewayHealth, pendingApprovals: number): HealthView {
  const realOffline = health.code === "offline" || health.code === "bad_url";
  const watchdog = observeWatchdog(realOffline);
  let status = health.status;
  let detail = healthDetail(health);
  if (watchdog.simulatedDown) {
    status = "needs_you";
    detail = watchdog.note;
  } else if (watchdog.note) {
    detail = `${detail} ${watchdog.note}`;
  }
  return {
    status,
    mode: health.mode,
    detail,
    chatReady: watchdog.simulatedDown ? false : health.chatReady,
    sandbox: true,
    approvals: true,
    dataDir: displayDataDir(),
    pendingApprovals,
    watchdog,
  };
}

export async function withGatewayFallback<T extends { text: string }>(
  run: (gateway: GatewayClient) => Promise<T>,
): Promise<{ result: T; via: "mock" | "openclaw" | "mock-fallback" }> {
  const gateway = currentGateway();
  try {
    const result = await run(gateway);
    return { result, via: gateway.mode };
  } catch (error) {
    if (gateway.mode === "openclaw" && error instanceof GatewayUnreachableError) {
      const result = await run(new MockGateway());
      return {
        result: {
          ...result,
          text: `OpenClaw Gateway 这次没连上。下面是演示回复，不会当作真实执行。\n\n${result.text}`,
        },
        via: "mock-fallback",
      };
    }
    if (error instanceof GatewayRequestError) {
      return {
        result: { text: gatewayErrorText(error) } as T,
        via: "openclaw",
      };
    }
    throw error;
  }
}

function healthDetail(health: GatewayHealth): string {
  switch (health.code) {
    case "mock":
      return "演示网关在本机应答。没有连接 OpenClaw，也不会调用外部模型。";
    case "http_ready":
      return "已连上本机 OpenClaw 的 HTTP 接口。模型仍由 Gateway 上的 agent 决定。";
    case "unauthorized":
      return "Gateway 要求令牌。设置 OPENCLAW_GATEWAY_TOKEN（或 OPENCLAW_GATEWAY_PASSWORD）后重启 Easy。";
    case "http_unavailable":
      return `Gateway 有 HTTP 响应${health.httpStatus ? `（${health.httpStatus}）` : ""}，但 /v1/models 不可用。聊天需要打开 gateway.http.endpoints.chatCompletions.enabled。`;
    case "ws_only":
      return "WebSocket 已出现 connect.challenge，或端口有响应，但 HTTP 聊天接口还不可用。";
    case "bad_url":
      return "OPENCLAW_GATEWAY_URL 不是有效地址。";
    case "offline":
      return "连不上 OPENCLAW_GATEWAY_URL。聊天会暂时改用演示回复，并标明这不是真实执行。";
  }
}

function gatewayErrorText(error: GatewayRequestError): string {
  if (error.status === 401 || error.status === 403) {
    return "Gateway 拒绝了这次请求。检查 OPENCLAW_GATEWAY_TOKEN 是否与本机 gateway.auth.token 一致。这条没有执行。";
  }
  if (error.status === 404) {
    return "Gateway 在，但没有打开聊天接口。把 gateway.http.endpoints.chatCompletions.enabled 设为 true，然后重启 Gateway。";
  }
  return `Gateway 返回了 ${error.status}。这条没有当成已执行。`;
}
