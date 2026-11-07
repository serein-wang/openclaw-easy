import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isModelId, isTemplateId } from "../src/domain/catalog.ts";
import { CHANNELS, isChannelId } from "../src/domain/channels.ts";
import type {
  ApprovalCard,
  ChannelRecord,
  ChatMessage,
  Claw,
  EasyState,
  HandoffMark,
  MessageVia,
  PresenceMember,
  TeamState,
} from "../src/domain/types.ts";

interface Cache {
  dir: string;
  state: EasyState;
}

let cache: Cache | null = null;
let queue: Promise<void> = Promise.resolve();

export function easyHome(): string {
  const override = process.env.OPENCLAW_EASY_HOME?.trim();
  return override || join(homedir(), ".openclaw-easy");
}

export function displayDataDir(dir = easyHome()): string {
  const home = homedir();
  return dir === home || dir.startsWith(`${home}/`) ? dir.replace(home, "~") : dir;
}

export function createEmptyState(): EasyState {
  return {
    version: 1,
    onboarded: false,
    model: null,
    safety: { sandbox: true, approvals: true },
    claws: [],
    messages: [],
    activeClawId: null,
    channels: emptyChannels(),
    team: emptyTeam(false, null),
    updatedAt: new Date().toISOString(),
  };
}

function emptyChannels(): ChannelRecord[] {
  return CHANNELS.map((item) => ({
    id: item.id,
    status: "empty",
    markedReady: false,
    updatedAt: null,
  }));
}

function emptyTeam(onboarded: boolean, activeClawId: string | null): TeamState {
  return {
    inviteCode: randomUUID().slice(0, 8),
    members: onboarded ? [ownerMember(activeClawId)] : [],
  };
}

function ownerMember(activeClawId: string | null): PresenceMember {
  return {
    id: createId("mem"),
    name: "你",
    role: "owner",
    viewingClawId: activeClawId,
    lastSeenAt: new Date().toISOString(),
  };
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function loadState(): Promise<EasyState> {
  const dir = easyHome();
  if (cache?.dir === dir) return cache.state;
  const state = await readFromDisk(dir);
  cache = { dir, state };
  return state;
}

export function updateState<T>(fn: (draft: EasyState) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const state = await loadState();
    const backup = structuredClone(state);
    try {
      const result = await fn(state);
      state.updatedAt = new Date().toISOString();
      await persist(state);
      return result;
    } catch (error) {
      cache = { dir: easyHome(), state: backup };
      throw error;
    }
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readFromDisk(dir: string): Promise<EasyState> {
  const file = join(dir, "state.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (isNotFound(error)) return createEmptyState();
    throw error;
  }
  try {
    return parseState(JSON.parse(raw));
  } catch {
    await rename(file, join(dir, `state.broken-${Date.now()}.json`)).catch(() => undefined);
    return createEmptyState();
  }
}

async function persist(state: EasyState): Promise<void> {
  const dir = easyHome();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, "state.json");
  const tmp = join(dir, "state.json.tmp");
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
  cache = { dir, state };
}

function parseState(value: unknown): EasyState {
  if (!isRecord(value) || value.version !== 1) throw new Error("bad version");
  const model = isModelId(value.model) ? value.model : null;
  const claws = parseClaws(value.claws);
  const messages = parseMessages(value.messages, new Set(claws.map((claw) => claw.id)));
  const active = typeof value.activeClawId === "string" ? value.activeClawId : null;
  const activeClawId = active && claws.some((claw) => claw.id === active) ? active : (claws[0]?.id ?? null);
  const onboarded = value.onboarded === true && claws.length > 0;
  return {
    version: 1,
    onboarded,
    model,
    safety: { sandbox: true, approvals: true },
    claws,
    messages,
    activeClawId,
    channels: parseChannels(value.channels),
    team: parseTeam(value.team, onboarded, activeClawId),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  };
}

function parseClaws(value: unknown): Claw[] {
  if (!Array.isArray(value)) throw new Error("bad claws");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      throw new Error("bad claw");
    }
    if (!isTemplateId(item.template)) throw new Error("bad template");
    return {
      id: item.id,
      name: item.name,
      duty: typeof item.duty === "string" ? item.duty : "",
      template: item.template,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    };
  });
}

function parseMessages(value: unknown, clawIds: Set<string>): ChatMessage[] {
  if (!Array.isArray(value)) throw new Error("bad messages");
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.clawId !== "string") {
      throw new Error("bad message");
    }
    if (!clawIds.has(item.clawId)) continue;
    if (item.role !== "user" && item.role !== "assistant") throw new Error("bad role");
    if (typeof item.content !== "string") throw new Error("bad content");
    const message: ChatMessage = {
      id: item.id,
      clawId: item.clawId,
      role: item.role,
      content: item.content,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    };
    if (isVia(item.via)) message.via = item.via;
    const approval = parseApproval(item.approval);
    if (approval) message.approval = approval;
    const handoff = parseHandoff(item.handoff);
    if (handoff) message.handoff = handoff;
    messages.push(message);
  }
  return messages;
}

function parseApproval(value: unknown): ApprovalCard | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("bad approval");
  }
  if (value.action !== "send_email" && value.action !== "delete_file") throw new Error("bad action");
  if (value.status !== "pending" && value.status !== "approved" && value.status !== "denied") {
    throw new Error("bad status");
  }
  return {
    id: value.id,
    action: value.action,
    title: value.title,
    summary: typeof value.summary === "string" ? value.summary : "",
    status: value.status,
  };
}

function parseChannels(value: unknown): ChannelRecord[] {
  const saved = new Map<ChannelRecord["id"], ChannelRecord>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item) || !isChannelId(item.id)) continue;
      saved.set(item.id, {
        id: item.id,
        status: item.status === "placeholder" ? "placeholder" : "empty",
        markedReady: item.markedReady === true,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
      });
    }
  }
  return emptyChannels().map((item) => saved.get(item.id) ?? item);
}

function parseTeam(value: unknown, onboarded: boolean, activeClawId: string | null): TeamState {
  const inviteCode =
    isRecord(value) && typeof value.inviteCode === "string" && value.inviteCode.trim().length >= 4
      ? value.inviteCode.trim()
      : randomUUID().slice(0, 8);
  const members: PresenceMember[] = [];
  if (isRecord(value) && Array.isArray(value.members)) {
    for (const item of value.members) {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") continue;
      if (item.role !== "owner" && item.role !== "guest") continue;
      members.push({
        id: item.id,
        name: item.name.slice(0, 32),
        role: item.role,
        viewingClawId: typeof item.viewingClawId === "string" ? item.viewingClawId : null,
        lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : new Date().toISOString(),
      });
    }
  }
  if (onboarded && !members.some((member) => member.role === "owner")) {
    members.unshift(ownerMember(activeClawId));
  }
  return { inviteCode, members };
}

function parseHandoff(value: unknown): HandoffMark | undefined {
  if (!isRecord(value)) return undefined;
  if (value.direction !== "out" && value.direction !== "in") return undefined;
  if (typeof value.fromId !== "string" || typeof value.toId !== "string") return undefined;
  if (typeof value.fromName !== "string" || typeof value.toName !== "string") return undefined;
  if (typeof value.task !== "string") return undefined;
  return {
    direction: value.direction,
    fromId: value.fromId,
    toId: value.toId,
    fromName: value.fromName,
    toName: value.toName,
    task: value.task,
    contextPreview: typeof value.contextPreview === "string" ? value.contextPreview : "",
  };
}

function isVia(value: unknown): value is MessageVia {
  return value === "mock" || value === "openclaw" || value === "mock-fallback";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
