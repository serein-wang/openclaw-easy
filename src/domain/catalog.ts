export const MODELS = [
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    blurb: "适合长文和仔细起草",
  },
  {
    id: "gpt",
    label: "GPT",
    vendor: "OpenAI",
    blurb: "适合通用对话和工具",
  },
  {
    id: "grok",
    label: "Grok",
    vendor: "xAI",
    blurb: "适合短问快答",
  },
  {
    id: "local",
    label: "本地",
    vendor: "本机模型",
    blurb: "偏好留在这台电脑上",
  },
] as const;

export const TEMPLATES = [
  {
    id: "inbox",
    label: "收件箱管家",
    duty: "盯邮件，起草回复",
    blurb: "看未读、写草稿。真正发信前会问你。",
  },
  {
    id: "calendar",
    label: "日历助理",
    duty: "看日程，提醒冲突",
    blurb: "帮你看时间和空档。不直接改日历。",
  },
  {
    id: "coding",
    label: "研发跑腿",
    duty: "看仓库，起草下一步",
    blurb: "读代码、写补丁。删文件会先问你。",
  },
  {
    id: "family",
    label: "家庭日程",
    duty: "记家里的接送和待办",
    blurb: "接送、晚饭、谁有空。只服务这个家。",
  },
  {
    id: "blank",
    label: "空白",
    duty: "",
    blurb: "不套模板，只按你写的一句职责。",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && MODELS.some((item) => item.id === value);
}

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && TEMPLATES.some((item) => item.id === value);
}

export function modelById(id: ModelId) {
  return MODELS.find((item) => item.id === id) ?? MODELS[0];
}

export function templateById(id: TemplateId) {
  return TEMPLATES.find((item) => item.id === id) ?? TEMPLATES[0];
}

export const SUGGESTIONS: Record<TemplateId, readonly string[]> = {
  inbox: ["今天要回哪些信？", "帮我发一封邮件给同事，说会议改到三点"],
  calendar: ["明天有什么安排？", "这周哪天适合约一个小时？"],
  coding: ["下一步该先看哪？", "帮我删除文件 dist/old.log"],
  family: ["今天谁接孩子？", "周六上午家里有空吗？"],
  blank: ["你现在能帮我做什么？", "帮我发一封邮件，先别真的发"],
};
