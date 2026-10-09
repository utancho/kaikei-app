import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { registeredKeirioIntro } from "./threeui-intro-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [registeredKeirioIntro(), react()],
  optimizeDeps: { exclude: ["@designcodeio/threeui"] },
  resolve: { alias: [{ find: /^@designcodeio\/threeui$/, replacement: fileURLToPath(new URL("./src/vendor/threeui-public.ts", import.meta.url)) }] },
  build: { emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
