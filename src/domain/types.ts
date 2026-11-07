import type { ModelId, TemplateId } from "./catalog.ts";
import type { ChannelId } from "./channels.ts";

export type HealthStatus = "online" | "busy" | "needs_you" | "offline";
export type GatewayMode = "mock" | "openclaw";
export type ApprovalAction = "send_email" | "delete_file";
export type ApprovalStatus = "pending" | "approved" | "denied";
export type MessageVia = "mock" | "openclaw" | "mock-fallback";

export interface ApprovalCard {
  id: string;
  action: ApprovalAction;
  title: string;
  summary: string;
  status: ApprovalStatus;
}

export interface Claw {
  id: string;
  name: string;
  duty: string;
  template: TemplateId;
  createdAt: string;
}

export interface HandoffMark {
  direction: "out" | "in";
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  task: string;
  contextPreview: string;
}

export interface ChatMessage {
  id: string;
  clawId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  via?: MessageVia;
  approval?: ApprovalCard;
  handoff?: HandoffMark;
}

export interface ChannelRecord {
  id: ChannelId;
  status: "empty" | "placeholder";
  markedReady: boolean;
  updatedAt: string | null;
}

export interface PresenceMember {
  id: string;
  name: string;
  role: "owner" | "guest";
  viewingClawId: string | null;
  lastSeenAt: string;
}

export interface TeamState {
  inviteCode: string;
  members: PresenceMember[];
}

export interface SafetyDefaults {
  sandbox: true;
  approvals: true;
}

export interface EasyState {
  version: 1;
  onboarded: boolean;
  model: ModelId | null;
  safety: SafetyDefaults;
  claws: Claw[];
  messages: ChatMessage[];
  activeClawId: string | null;
  channels: ChannelRecord[];
  team: TeamState;
  updatedAt: string;
}

export interface HealthView {
  status: HealthStatus;
  mode: GatewayMode;
  detail: string;
  chatReady: boolean;
  sandbox: true;
  approvals: true;
  dataDir: string;
  pendingApprovals: number;
  watchdog: WatchdogView;
}

export interface WatchdogView {
  repairAvailable: boolean;
  simulatedDown: boolean;
  autoRestarted: boolean;
  note: string;
}

export interface Snapshot {
  onboarded: boolean;
  model: ModelId | null;
  safety: SafetyDefaults;
  claws: Claw[];
  messages: ChatMessage[];
  activeClawId: string | null;
  channels: ChannelRecord[];
  team: TeamState;
  health: HealthView;
}

export interface ClawProfile {
  id: string;
  name: string;
  duty: string;
  template: TemplateId;
}

export interface ChatHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurnInput {
  claw: ClawProfile;
  model: ModelId;
  history: ChatHistoryTurn[];
  message: string;
}

export interface ChatTurnResult {
  text: string;
  approval?: Omit<ApprovalCard, "status">;
}

export type GatewayHealthCode =
  | "mock"
  | "http_ready"
  | "unauthorized"
  | "http_unavailable"
  | "ws_only"
  | "offline"
  | "bad_url";

export interface GatewayHealth {
  status: HealthStatus;
  mode: GatewayMode;
  code: GatewayHealthCode;
  chatReady: boolean;
  httpStatus?: number;
}

export interface ApprovalDecision {
  claw: ClawProfile;
  model: ModelId;
  approval: Omit<ApprovalCard, "status">;
  decision: "approve" | "deny";
}
