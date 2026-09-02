import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Without this, tanstackStart's own build only emits dist/server/server.js,
    // a bare {fetch} handler with no HTTP listener - not runnable as
    // `node dist/server/server.js`. The node-server Nitro preset makes the
    // build emit a self-starting Node server at .output/server/index.mjs
    // instead, with all runtime deps bundled in - no node_modules needed at
    // runtime. Same fix applied to synkra--web-main and synkra-client-hub
    // after discovering both had the same latent bug.
    nitro({ preset: "node-server" }),
    react(),
    tsConfigPaths(),
  ],
});
