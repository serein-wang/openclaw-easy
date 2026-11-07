export const CHANNELS = [
  {
    id: "telegram",
    label: "Telegram",
    summary: "最快的一个渠道。需要 BotFather 的 bot token，Easy 不连接 Telegram。",
    steps: ["在 BotFather 创建 bot，拿到 token", "用下面的命令写进 OpenClaw", "Easy 只在本机留下一份未启用的占位"],
    command: "openclaw channels add --channel telegram --token <bot-token>",
    docs: "https://docs.openclaw.ai/channels/telegram/setup",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    summary: "走 WhatsApp Web 扫码，没有 bot token。Easy 不显示二维码，也不代你登录。",
    steps: ["确认已装 WhatsApp 渠道插件", "在终端扫码登录", "Easy 只记下 pairing 占位"],
    command: "openclaw channels login --channel whatsapp",
    docs: "https://docs.openclaw.ai/channels/whatsapp/",
  },
  {
    id: "slack",
    label: "Slack",
    summary: "Socket Mode 要用 App-Level Token 和 Bot Token。Easy 只写 SecretRef 占位，不保存令牌。",
    steps: ["在 Slack App 里打开 Socket Mode", "把两个 token 放到 Gateway 进程的环境变量", "Easy 写下 channels.slack 的形状"],
    command: "openclaw config patch  # channels.slack mode socket，token 用 SecretRef",
    docs: "https://docs.openclaw.ai/channels/slack/setup",
  },
] as const;

export type ChannelId = (typeof CHANNELS)[number]["id"];

export function isChannelId(value: unknown): value is ChannelId {
  return typeof value === "string" && CHANNELS.some((item) => item.id === value);
}

export function channelById(id: ChannelId) {
  const found = CHANNELS.find((item) => item.id === id);
  if (!found) throw new Error(`unknown channel ${id}`);
  return found;
}
