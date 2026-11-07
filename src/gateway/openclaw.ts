import { denialText, gateUserMessage } from "../domain/policy.ts";
import type {
  ApprovalDecision,
  ChatTurnInput,
  ChatTurnResult,
  GatewayHealth,
} from "../domain/types.ts";
import { GatewayRequestError, GatewayUnreachableError } from "./errors.ts";
import type { GatewayClient } from "./types.ts";

export interface SocketProbe {
  opened: boolean;
  challenged: boolean;
}

export interface OpenClawGatewayOptions {
  baseUrl: string;
  token?: string;
  /** Sent as x-openclaw-model only when the operator set OPENCLAW_MODEL. */
  modelHeader?: string;
  fetchImpl?: typeof fetch;
  probeSocket?: (webSocketUrl: string, timeoutMs: number) => Promise<SocketProbe>;
  timeoutMs?: number;
}

interface ChatCompletionBody {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/**
 * Optional client for a local OpenClaw Gateway.
 *
 * Chat uses the documented HTTP surface POST /v1/chat/completions
 * (off unless gateway.http.endpoints.chatCompletions.enabled).
 * The WebSocket control plane is the full operator protocol and needs a
 * device handshake; this stub only listens for the pre-connect
 * connect.challenge frame when checking that a process is up.
 * Easy does not rewrite Gateway config or store provider keys.
 */
export class OpenClawGateway implements GatewayClient {
  readonly mode = "openclaw" as const;
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly modelHeader: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly probeSocket: (webSocketUrl: string, timeoutMs: number) => Promise<SocketProbe>;
  private readonly timeoutMs: number;

  constructor(options: OpenClawGatewayOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token?.trim() || undefined;
    this.modelHeader = options.modelHeader?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.probeSocket = options.probeSocket ?? probeOpenClawSocket;
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  async health(): Promise<GatewayHealth> {
    let origin: string;
    try {
      origin = gatewayOrigin(this.baseUrl);
    } catch {
      return { status: "offline", mode: "openclaw", code: "bad_url", chatReady: false };
    }

    try {
      const response = await this.fetchImpl(new URL("/v1/models", origin), {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        return {
          status: "needs_you",
          mode: "openclaw",
          code: "unauthorized",
          chatReady: false,
          httpStatus: response.status,
        };
      }
      if (response.ok) {
        const data: unknown = await response.json().catch(() => null);
        if (looksLikeModelList(data)) {
          return { status: "online", mode: "openclaw", code: "http_ready", chatReady: true };
        }
      }
      const socket = await this.safeProbe(origin);
      if (socket.challenged || socket.opened) {
        return {
          status: "online",
          mode: "openclaw",
          code: "ws_only",
          chatReady: false,
          httpStatus: response.status,
        };
      }
      return {
        status: "needs_you",
        mode: "openclaw",
        code: "http_unavailable",
        chatReady: false,
        httpStatus: response.status,
      };
    } catch {
      const socket = await this.safeProbe(origin);
      if (socket.challenged) {
        return { status: "online", mode: "openclaw", code: "ws_only", chatReady: false };
      }
      return { status: "offline", mode: "openclaw", code: "offline", chatReady: false };
    }
  }

  async complete(input: ChatTurnInput): Promise<ChatTurnResult> {
    const gated = gateUserMessage(input.claw, input.message);
    if (gated) return gated;
    return this.completeRaw(input);
  }

  async resolveApproval(input: ApprovalDecision): Promise<ChatTurnResult> {
    if (input.decision === "deny") {
      return { text: denialText(input.approval.action) };
    }
    const verb = input.approval.action === "send_email" ? "send the email" : "delete the file";
    return this.completeRaw({
      claw: input.claw,
      model: input.model,
      history: [],
      message: [
        `The user explicitly approved this Easy-mode action (${input.approval.title}).`,
        `Please ${verb} only within the Gateway's own sandbox and tool policy.`,
        `Original request summary: ${input.approval.summary}`,
        "Reply in Chinese. If you did not actually perform an external side effect, say so.",
      ].join("\n"),
    });
  }

  private async completeRaw(input: ChatTurnInput): Promise<ChatTurnResult> {
    let origin: string;
    try {
      origin = gatewayOrigin(this.baseUrl);
    } catch {
      throw new GatewayUnreachableError("OPENCLAW_GATEWAY_URL 不是有效地址");
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "openclaw-easy/0.1.0",
      "x-openclaw-session-key": `easy:${input.claw.id}`,
      ...this.authHeaders(),
    };
    if (this.modelHeader) headers["x-openclaw-model"] = this.modelHeader;

    let response: Response;
    try {
      response = await this.fetchImpl(new URL("/v1/chat/completions", origin), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "openclaw/default",
          messages: [
            { role: "system", content: systemPrompt(input) },
            ...input.history.slice(-20).flatMap((turn) =>
              turn.content.trim() ? [{ role: turn.role, content: turn.content }] : [],
            ),
            { role: "user", content: input.message },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "network";
      throw new GatewayUnreachableError(reason);
    }

    if (!response.ok) {
      throw new GatewayRequestError(response.status, await errorSnippet(response));
    }

    const payload = (await response.json().catch(() => null)) as ChatCompletionBody | null;
    const text = readContent(payload?.choices?.[0]?.message?.content);
    if (!text) throw new GatewayRequestError(502, "Gateway 返回了空回复");
    return { text };
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) return {};
    return { authorization: `Bearer ${this.token}` };
  }

  private async safeProbe(origin: string): Promise<SocketProbe> {
    try {
      return await this.probeSocket(toWebSocketUrl(origin), Math.min(this.timeoutMs, 1200));
    } catch {
      return { opened: false, challenged: false };
    }
  }
}

export function gatewayOrigin(base: string): string {
  const withProtocol = /^https?:\/\//i.test(base) ? base : `http://${base}`;
  const url = new URL(withProtocol);
  if (!url.hostname) throw new Error("missing host");
  return url.origin;
}

export function toWebSocketUrl(origin: string): string {
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function probeOpenClawSocket(webSocketUrl: string, timeoutMs: number): Promise<SocketProbe> {
  return new Promise((resolve) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(webSocketUrl);
    } catch {
      resolve({ opened: false, challenged: false });
      return;
    }

    let settled = false;
    const finish = (value: SocketProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // The socket may already be closed.
      }
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish({ opened: socket.readyState === WebSocket.OPEN, challenged: false });
    }, timeoutMs);

    socket.addEventListener("error", () => finish({ opened: false, challenged: false }));
    socket.addEventListener("message", (event) => {
      const raw = (event as { data?: unknown }).data;
      const data = typeof raw === "string" ? raw : "";
      if (data.includes("connect.challenge")) finish({ opened: true, challenged: true });
    });
  });
}

function looksLikeModelList(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as { data?: unknown; models?: unknown };
  return Array.isArray(record.data) || Array.isArray(record.models);
}

function systemPrompt(input: ChatTurnInput): string {
  return [
    "You are speaking inside OpenClaw Easy, a local shell over the OpenClaw Gateway.",
    `Claw name: ${input.claw.name}`,
    `Template: ${input.claw.template}`,
    `Duty: ${input.claw.duty || "(none)"}`,
    `User model preference (hint only; do not switch providers): ${input.model}`,
    "Reply in Chinese, short and concrete.",
    "Easy mode shows approval cards before sending email or deleting files.",
    "Do not claim those side effects already happened unless this turn says the user approved them.",
    "Do not ask the user to paste API keys into the chat.",
  ].join("\n");
}

function readContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("")
    .trim();
}

async function errorSnippet(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.slice(0, 180) || response.statusText || "request failed";
}
