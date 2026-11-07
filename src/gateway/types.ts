import type {
  ApprovalDecision,
  ChatTurnInput,
  ChatTurnResult,
  GatewayHealth,
  GatewayMode,
} from "../domain/types.ts";

export interface GatewayClient {
  readonly mode: GatewayMode;
  health(): Promise<GatewayHealth>;
  complete(input: ChatTurnInput): Promise<ChatTurnResult>;
  resolveApproval(input: ApprovalDecision): Promise<ChatTurnResult>;
}
