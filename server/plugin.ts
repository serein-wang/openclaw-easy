import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handleApi } from "./api.ts";

function attach(middlewares: {
  use: (fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void;
}): void {
  middlewares.use(async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    if (!path.startsWith("/api")) {
      next();
      return;
    }
    await handleApi(req, res);
  });
}

/** Serves /api beside the Vite dev and preview servers. */
export function easyApiPlugin(): Plugin {
  return {
    name: "openclaw-easy-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
