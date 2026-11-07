import { modelById, templateById } from "./catalog.ts";
import type { ClawProfile } from "./types.ts";
import type { ModelId } from "./catalog.ts";

export function clawGreeting(claw: ClawProfile, model: ModelId): string {
  const template = templateById(claw.template);
  const duty = claw.duty.trim() || template.duty || "你还没写职责，我就先听你交代。";
  return `我是${claw.name}，${template.label}。${duty}。模型偏好是${modelById(model).label}，密钥不进这则对话。沙箱开着；发送邮件和删除文件会先请你确认。`;
}
