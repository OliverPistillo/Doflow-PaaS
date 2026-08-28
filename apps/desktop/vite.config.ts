import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  clearScreen: false,
  define: {
    "import.meta.env.VITE_DESKTOP_QA": JSON.stringify(mode === "qa" ? "1" : ""),
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_"],
  build: {
    target: "es2022",
    sourcemap: false,
    minify: "esbuild",
  },
}));
