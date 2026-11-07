import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChannelId } from "../src/domain/channels.ts";
import { easyHome } from "./store.ts";

export interface ChannelPlaceholderFile {
  _easy: string;
  channels: Record<string, unknown>;
}

/** Local skeleton only. Easy never patches ~/.openclaw/openclaw.json and never stores channel secrets. */
export function placeholderFor(id: ChannelId): Record<string, unknown> {
  switch (id) {
    case "telegram":
      return {
        enabled: false,
        dmPolicy: "pairing",
        botToken: "<openclaw channels add --channel telegram --token>",
        groups: { "*": { requireMention: true } },
      };
    case "whatsapp":
      return {
        dmPolicy: "pairing",
        allowFrom: ["<E.164 phone>"],
        groupPolicy: "allowlist",
      };
    case "slack":
      return {
        enabled: false,
        mode: "socket",
        appToken: { source: "env", provider: "default", id: "SLACK_APP_TOKEN" },
        botToken: { source: "env", provider: "default", id: "SLACK_BOT_TOKEN" },
      };
  }
}

export async function writeChannelPlaceholder(id: ChannelId): Promise<string> {
  const dir = easyHome();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, "channels.json");
  const current = await readPlaceholder(file);
  current.channels[id] = placeholderFor(id);
  current._easy = "Placeholder only. Not applied to the OpenClaw gateway. Tokens stay in OpenClaw SecretRefs or env.";
  const tmp = join(dir, "channels.json.tmp");
  await writeFile(tmp, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
  return file;
}

async function readPlaceholder(file: string): Promise<ChannelPlaceholderFile> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "channels" in parsed) {
      const channels = (parsed as { channels?: unknown }).channels;
      if (channels && typeof channels === "object" && !Array.isArray(channels)) {
        return {
          _easy: "",
          channels: { ...(channels as Record<string, unknown>) },
        };
      }
    }
  } catch {
    // Missing or unreadable files start a new placeholder document.
  }
  return { _easy: "", channels: {} };
}
