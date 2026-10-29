import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run build:demo` gera a demonstração (sem servidor) num único arquivo HTML.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "demo" ? "./" : "/",
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
  build:
    mode === "demo"
      ? { outDir: "dist-demo", rollupOptions: { output: { inlineDynamicImports: true } } }
      : undefined,
}));
