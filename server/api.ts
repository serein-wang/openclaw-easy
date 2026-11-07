import type { IncomingMessage, ServerResponse } from "node:http";
import { isModelId, isTemplateId, templateById } from "../src/domain/catalog.ts";
import type { ModelId, TemplateId } from "../src/domain/catalog.ts";
import { isChannelId } from "../src/domain/channels.ts";
import { clawGreeting } from "../src/domain/greeting.ts";
import { contextPreview, resolveHandoff, type ResolvedHandoff } from "../src/domain/handoff.ts";
import type { ApprovalCard, ChatMessage, Claw, EasyState, HandoffMark, Snapshot } from "../src/domain/types.ts";
import { writeChannelPlaceholder } from "./channelsFile.ts";
import { clearHealthCache, readGatewayHealth, toHealthView, withGatewayFallback } from "./gatewayView.ts";
import { createEmptyState, createId, loadState, updateState } from "./store.ts";
import { repairWatchdog, tripWatchdog } from "./watchdog.ts";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await route(req, res);
  } catch (error) {
    if (res.headersSent) return;
    if (!(error instanceof HttpError)) console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "本机服务出错";
    sendJson(res, status, { error: message });
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && path === "/api/health") {
    const state = await loadState();
    const health = await readGatewayHealth();
    sendJson(res, 200, toHealthView(health, pendingCount(state)));
    return;
  }

  if (method === "GET" && path === "/api/state") {
    sendJson(res, 200, await snapshot());
    return;
  }

  if (method === "POST" && path === "/api/onboarding") {
    const body = await readJson(req);
    sendJson(res, 200, await finishOnboarding(body));
    return;
  }

  if (method === "POST" && path === "/api/claws") {
    const body = await readJson(req);
    sendJson(res, 200, await createClaw(body));
    return;
  }

  if (method === "POST" && path === "/api/model") {
    const body = await readJson(req);
    sendJson(res, 200, await setModel(body));
    return;
  }

  if (method === "POST" && path === "/api/active") {
    const body = await readJson(req);
    sendJson(res, 200, await setActive(body));
    return;
  }

  if (method === "POST" && path === "/api/chat") {
    const body = await readJson(req);
    sendJson(res, 200, await postChat(body));
    return;
  }

  if (method === "POST" && path === "/api/watchdog/trip") {
    tripWatchdog();
    clearHealthCache();
    sendJson(res, 200, await snapshot());
    return;
  }

  if (method === "POST" && path === "/api/watchdog/repair") {
    repairWatchdog();
    clearHealthCache();
    sendJson(res, 200, await snapshot());
    return;
  }

  if (method === "POST" && path === "/api/channels") {
    const body = await readJson(req);
    sendJson(res, 200, await saveChannel(body));
    return;
  }

  if (method === "POST" && path === "/api/team/join") {
    const body = await readJson(req);
    sendJson(res, 200, await joinTeam(body));
    return;
  }

  if (method === "POST" && path === "/api/team/pulse") {
    const body = await readJson(req);
    sendJson(res, 200, await pulseTeam(body));
    return;
  }

  if (method === "POST" && path === "/api/team/mock-guest") {
    sendJson(res, 200, await mockGuest());
    return;
  }

  const approval = path.match(/^\/api\/approvals\/([^/]+)$/);
  if (method === "POST" && approval?.[1]) {
    const body = await readJson(req);
    sendJson(res, 200, await decideApproval(decodeURIComponent(approval[1]), body));
    return;
  }

  if (method === "POST" && path === "/api/reset") {
    sendJson(res, 200, await resetAll());
    return;
  }

  throw new HttpError(404, "没有这个接口");
}

async function snapshot(): Promise<Snapshot> {
  const state = await loadState();
  const health = await readGatewayHealth();
  return {
    onboarded: state.onboarded,
    model: state.model,
    safety: state.safety,
    claws: state.claws,
    messages: state.messages,
    activeClawId: state.activeClawId,
    channels: state.channels,
    team: state.team,
    health: toHealthView(health, pendingCount(state)),
  };
}

async function finishOnboarding(body: unknown): Promise<Snapshot> {
  const model = readModel(body);
  const draft = readClawDraft(body);
  await updateState((state) => {
    if (state.onboarded) throw new HttpError(409, "向导已经完成");
    state.model = model;
    const claw = makeClaw(draft);
    state.claws.push(claw);
    state.messages.push(greetingMessage(claw, model));
    state.activeClawId = claw.id;
    state.onboarded = true;
    ensureOwner(state);
  });
  return snapshot();
}

async function createClaw(body: unknown): Promise<Snapshot> {
  const draft = readClawDraft(body);
  await updateState((state) => {
    if (!state.onboarded || !state.model) throw new HttpError(409, "先完成三步向导");
    const claw = makeClaw(draft);
    state.claws.push(claw);
    state.messages.push(greetingMessage(claw, state.model));
    state.activeClawId = claw.id;
  });
  return snapshot();
}

async function setModel(body: unknown): Promise<Snapshot> {
  const model = readModel(body);
  await updateState((state) => {
    if (!state.onboarded) throw new HttpError(409, "先完成三步向导");
    state.model = model;
  });
  return snapshot();
}

async function setActive(body: unknown): Promise<Snapshot> {
  if (!isRecord(body) || typeof body.clawId !== "string") throw new HttpError(400, "缺少 Claw");
  const clawId = body.clawId;
  await updateState((state) => {
    if (!state.claws.some((claw) => claw.id === clawId)) throw new HttpError(404, "没有这只 Claw");
    state.activeClawId = clawId;
  });
  return snapshot();
}

async function postChat(body: unknown): Promise<Snapshot> {
  if (!isRecord(body) || typeof body.clawId !== "string") throw new HttpError(400, "缺少 Claw");
  const text = readMessage(body.text);
  const clawId = body.clawId;

  await updateState(async (state) => {
    const claw = state.claws.find((item) => item.id === clawId);
    if (!claw) throw new HttpError(404, "没有这只 Claw");
    if (!state.model) throw new HttpError(409, "还没有模型偏好");
    state.activeClawId = claw.id;
    const userMessageId = createId("msg");
    state.messages.push({
      id: userMessageId,
      clawId: claw.id,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    });
    const handoff = resolveHandoff(text, state.claws, claw.id);
    if (handoff) {
      await deliverHandoff(state, claw, userMessageId, handoff);
      return;
    }
    const history = state.messages
      .filter((message) => message.clawId === claw.id)
      .slice(0, -1)
      .map((message) => ({ role: message.role, content: message.content }));
    const { result, via } = await withGatewayFallback((gateway) =>
      gateway.complete({
        claw,
        model: state.model ?? "local",
        history,
        message: text,
      }),
    );
    state.messages.push(assistantMessage(claw.id, result.text, via, result.approval));
  });
  return snapshot();
}

async function deliverHandoff(
  state: EasyState,
  claw: Claw,
  userMessageId: string,
  handoff: ResolvedHandoff,
): Promise<void> {
  const preview = contextPreview(
    state.messages.filter((message) => message.id !== userMessageId),
    claw.id,
  );
  const shared = {
    fromId: claw.id,
    toId: handoff.target.id,
    fromName: claw.name,
    toName: handoff.target.name,
    task: handoff.task,
    contextPreview: preview,
  };
  const { result, via } = await withGatewayFallback((gateway) =>
    gateway.complete({
      claw: handoff.target,
      model: state.model ?? "local",
      history: [
        { role: "user", content: `来自「${claw.name}」的交办上下文：\n${preview}` },
        {
          role: "assistant",
          content: "收到。我会按自己的职责处理。发送邮件和删除文件仍会先请你确认。",
        },
      ],
      message: handoff.task,
    }),
  );
  const sourceText = result.approval
    ? `已交给${handoff.target.name}，并带上刚才的对话。不用另写转发规则。\n这一步要确认，请到${handoff.target.name}的对话里点。`
    : `已交给${handoff.target.name}，并带上刚才的对话。不用另写转发规则。`;
  state.messages.push({
    id: createId("msg"),
    clawId: claw.id,
    role: "assistant",
    content: sourceText,
    createdAt: new Date().toISOString(),
    via,
    handoff: { direction: "out", ...shared },
  });
  state.messages.push(
    assistantMessage(handoff.target.id, result.text, via, result.approval, { direction: "in", ...shared }),
  );
}

async function decideApproval(id: string, body: unknown): Promise<Snapshot> {
  if (!isRecord(body) || (body.decision !== "approve" && body.decision !== "deny")) {
    throw new HttpError(400, "需要 approve 或 deny");
  }
  const decision = body.decision;

  await updateState(async (state) => {
    const message = state.messages.find((item) => item.approval?.id === id);
    if (!message?.approval) throw new HttpError(404, "没有这张确认卡");
    if (message.approval.status !== "pending") throw new HttpError(409, "这张卡已经处理过了");
    const claw = state.claws.find((item) => item.id === message.clawId);
    if (!claw || !state.model) throw new HttpError(409, "Claw 已不在");
    message.approval.status = decision === "approve" ? "approved" : "denied";
    const approval = message.approval;
    const { result, via } = await withGatewayFallback((gateway) =>
      gateway.resolveApproval({
        claw,
        model: state.model ?? "local",
        approval: {
          id: approval.id,
          action: approval.action,
          title: approval.title,
          summary: approval.summary,
        },
        decision,
      }),
    );
    state.messages.push(assistantMessage(claw.id, result.text, via));
  });
  return snapshot();
}

async function resetAll(): Promise<Snapshot> {
  await updateState((state) => {
    const fresh = createEmptyState();
    fresh.updatedAt = state.updatedAt;
    Object.assign(state, fresh);
  });
  return snapshot();
}

async function saveChannel(body: unknown): Promise<Snapshot> {
  if (!isRecord(body) || !isChannelId(body.id)) throw new HttpError(400, "没有这个渠道");
  const id = body.id;
  const markReady = body.markReady === true;
  await updateState(async (state) => {
    if (!state.onboarded) throw new HttpError(409, "先完成三步向导");
    const row = state.channels.find((item) => item.id === id);
    if (!row) throw new HttpError(404, "没有这个渠道");
    await writeChannelPlaceholder(id);
    row.status = "placeholder";
    row.updatedAt = new Date().toISOString();
    if (markReady) row.markedReady = true;
  });
  return snapshot();
}

async function joinTeam(body: unknown): Promise<Snapshot & { joinedMemberId: string }> {
  if (!isRecord(body) || typeof body.code !== "string" || typeof body.name !== "string") {
    throw new HttpError(400, "需要邀请码和名字");
  }
  const code = body.code.trim();
  const name = body.name.trim();
  if (name.length === 0 || name.length > 32) throw new HttpError(400, "名字不合适");
  let joinedMemberId = "";
  await updateState((state) => {
    if (!state.onboarded) throw new HttpError(409, "先完成三步向导");
    if (code !== state.team.inviteCode) throw new HttpError(403, "邀请码不对");
    const existing = state.team.members.find((member) => member.role === "guest" && member.name === name);
    if (existing) {
      existing.lastSeenAt = new Date().toISOString();
      joinedMemberId = existing.id;
      return;
    }
    joinedMemberId = createId("mem");
    state.team.members.push({
      id: joinedMemberId,
      name,
      role: "guest",
      viewingClawId: state.activeClawId,
      lastSeenAt: new Date().toISOString(),
    });
  });
  return { ...(await snapshot()), joinedMemberId };
}

async function pulseTeam(body: unknown): Promise<Snapshot> {
  if (!isRecord(body) || typeof body.memberId !== "string") throw new HttpError(400, "缺少成员");
  const memberId = body.memberId;
  const clawId = typeof body.clawId === "string" ? body.clawId : null;
  await updateState((state) => {
    const member = state.team.members.find((item) => item.id === memberId);
    if (!member) throw new HttpError(404, "没有这个成员");
    member.lastSeenAt = new Date().toISOString();
    if (clawId && state.claws.some((claw) => claw.id === clawId)) member.viewingClawId = clawId;
  });
  return snapshot();
}

async function mockGuest(): Promise<Snapshot> {
  await updateState((state) => {
    if (!state.onboarded) throw new HttpError(409, "先完成三步向导");
    const base = "同事";
    const name = state.team.members.some((member) => member.name === base) ? `${base}${state.team.members.length}` : base;
    state.team.members.push({
      id: createId("mem"),
      name,
      role: "guest",
      viewingClawId: state.activeClawId,
      lastSeenAt: new Date().toISOString(),
    });
  });
  return snapshot();
}

function ensureOwner(state: EasyState): void {
  if (state.team.members.some((member) => member.role === "owner")) return;
  state.team.members.unshift({
    id: createId("mem"),
    name: "你",
    role: "owner",
    viewingClawId: state.activeClawId,
    lastSeenAt: new Date().toISOString(),
  });
}

function makeClaw(draft: { name: string; duty: string; template: TemplateId }): Claw {
  const template = templateById(draft.template);
  return {
    id: createId("claw"),
    name: draft.name,
    duty: draft.duty || template.duty,
    template: draft.template,
    createdAt: new Date().toISOString(),
  };
}

function greetingMessage(claw: Claw, model: ModelId): ChatMessage {
  return {
    id: createId("msg"),
    clawId: claw.id,
    role: "assistant",
    content: clawGreeting(claw, model),
    createdAt: new Date().toISOString(),
  };
}

function assistantMessage(
  clawId: string,
  content: string,
  via: ChatMessage["via"],
  approval?: Omit<ApprovalCard, "status">,
  handoff?: HandoffMark,
): ChatMessage {
  const message: ChatMessage = {
    id: createId("msg"),
    clawId,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    via: approval ? undefined : via,
  };
  if (approval) message.approval = { ...approval, status: "pending" };
  if (handoff) message.handoff = handoff;
  return message;
}

function pendingCount(state: EasyState): number {
  return state.messages.filter((message) => message.approval?.status === "pending").length;
}

function readModel(body: unknown): ModelId {
  if (!isRecord(body) || !isModelId(body.model)) throw new HttpError(400, "先选一个模型偏好");
  return body.model;
}

function readClawDraft(body: unknown): { name: string; duty: string; template: TemplateId } {
  if (!isRecord(body)) throw new HttpError(400, "缺少 Claw 资料");
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new HttpError(400, "先给这只 Claw 起个名字");
  }
  if (body.name.trim().length > 32) throw new HttpError(400, "名字太长了");
  const duty = typeof body.duty === "string" ? body.duty.trim() : "";
  if (duty.length > 80) throw new HttpError(400, "职责写短一点");
  if (!isTemplateId(body.template)) throw new HttpError(400, "选一个模板");
  return { name: body.name.trim(), duty, template: body.template };
}

function readMessage(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new HttpError(400, "先写一句话");
  if (value.trim().length > 4000) throw new HttpError(400, "这条太长了");
  return value.trim();
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new HttpError(413, "内容太大");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "请求不是 JSON");
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
