import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { easyApiPlugin } from "./server/plugin.ts";

// One process serves the Easy Shell and the local /api routes.
export default defineConfig({
  plugins: [react(), tailwindcss(), easyApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 4721,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4721,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
});
