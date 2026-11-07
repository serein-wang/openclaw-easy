import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { handleApi } from "../server/api.ts";
import type { Snapshot } from "../src/domain/types.ts";

export async function invoke(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; json: Snapshot & { error?: string; joinedMemberId?: string } }> {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(payload) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { host: "127.0.0.1" };
  const res = new EventEmitter() as ServerResponse;
  res.statusCode = 200;
  res.setHeader = () => res;
  const done = new Promise<{ status: number; json: Snapshot & { error?: string; joinedMemberId?: string } }>((resolve) => {
    res.end = ((chunk?: unknown) => {
      const text = typeof chunk === "string" ? chunk : "";
      resolve({ status: res.statusCode, json: text ? JSON.parse(text) : {} });
      return res;
    }) as ServerResponse["end"];
  });
  await handleApi(req, res);
  return done;
}
