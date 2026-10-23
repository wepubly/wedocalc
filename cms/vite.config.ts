import { defineConfig } from "vite";
export default defineConfig({
  base: "/admin-assets/",
  build: { outDir: "dist/admin-assets", emptyOutDir: true },
});
