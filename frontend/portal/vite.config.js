import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: "/portal/",
  // Use the parent public directory for shared assets
  publicDir: resolve(__dirname, "../public"),
  server: {
    proxy: {
      "/api": "http://localhost:7071",
    },
  },
});
