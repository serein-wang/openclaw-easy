import { MockGateway } from "./mock.ts";
import { OpenClawGateway } from "./openclaw.ts";
import type { GatewayClient } from "./types.ts";

export interface GatewayEnv {
  OPENCLAW_GATEWAY_URL?: string;
  OPENCLAW_GATEWAY_TOKEN?: string;
  OPENCLAW_GATEWAY_PASSWORD?: string;
  OPENCLAW_MODEL?: string;
}

/** Mock when no URL is set. Otherwise the optional OpenClaw HTTP/WS client. */
export function createGateway(env: GatewayEnv): GatewayClient {
  const url = env.OPENCLAW_GATEWAY_URL?.trim();
  if (!url) return new MockGateway();
  const token = env.OPENCLAW_GATEWAY_TOKEN?.trim() || env.OPENCLAW_GATEWAY_PASSWORD?.trim();
  return new OpenClawGateway({
    baseUrl: url,
    token: token || undefined,
    modelHeader: env.OPENCLAW_MODEL?.trim() || undefined,
  });
}

export { GatewayRequestError, GatewayUnreachableError } from "./errors.ts";
export { MockGateway } from "./mock.ts";
export { OpenClawGateway } from "./openclaw.ts";
export type { GatewayClient } from "./types.ts";
